import os, json, uuid, re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.cloud import bigquery

# Optional parsers
from pypdf import PdfReader
from docx import Document
from io import BytesIO

# ----------- Config -----------
PROJECT_ID   = os.getenv("PROJECT_ID", "orbit-ai-472708")
LOCATION     = os.getenv("LOCATION", "us-central1")
MODEL_NAME   = os.getenv("MODEL_NAME", "gemini-2.0-flash-001")
DATASET      = os.getenv("DATASET", "orbit_ai_poc")
PROMPT_PATH  = os.getenv("PROMPT_PATH", "prompts/prompt_poc_v1.txt")
PROMPT_VER   = os.getenv("PROMPT_VERSION", "poc-v1")
CREATED_BY   = os.getenv("CREATED_BY", "demo@orbit-ai")

TABLE_REQ = f"{PROJECT_ID}.{DATASET}.requirements"
TABLE_TC  = f"{PROJECT_ID}.{DATASET}.generated_testcases"

# ----------- Lazy Clients -----------
_bq = None
_vertex_ready = False

def now_ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00","Z")

def get_bq():
    global _bq
    if _bq is None:
        _bq = bigquery.Client(project=PROJECT_ID)
    return _bq

def ensure_vertex():
    global _vertex_ready
    if not _vertex_ready:
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        _vertex_ready = True

# ----------- FastAPI App -----------
app = FastAPI(title="Orbit AI Test Case Generator API", version="0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten later to your orbit-web URL
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------- Helpers -----------
def load_prompt() -> str:
    try:
        with open(PROMPT_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return (
            "You are an expert QA engineer for healthcare software.\n"
            "Requirement ID: {{req_id}}\n"
            "Requirement Text:\n{{requirement_text}}\n\n"
            "Return JSON with field 'test_cases' as an array of objects having:\n"
            "test_id, title, steps (array), expected_result, preconditions, severity,\n"
            "compliance_tags (array), trace_link.\n"
        )

def fill_prompt(template: str, req_id: str, text: str, compliance: Optional[List[str]] = None) -> str:
    tip = ""
    if compliance:
        tip = "\nEmphasize compliance with: " + ", ".join(compliance) + \
              ". Reflect this in severity, steps, expected results, and tags."
    return template.replace("{{req_id}}", req_id).replace("{{requirement_text}}", text + tip)

def extract_json(text: str) -> str:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE)
    m = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    return m.group(0) if m else cleaned

def call_model(prompt: str) -> str:
    ensure_vertex()
    model = GenerativeModel(MODEL_NAME)
    cfg = GenerationConfig(temperature=0.2, max_output_tokens=2048)
    resp = model.generate_content(prompt, generation_config=cfg)
    if getattr(resp, "text", None):
        return resp.text
    parts = resp.candidates[0].content.parts if resp.candidates else []
    return "".join(getattr(p, "text", "") for p in parts)

def save_rows(req_id: str, tcs: List[dict]) -> List[dict]:
    rows = []
    for tc in tcs:
        rows.append({
            "test_id": tc.get("test_id") or "TEST-" + uuid.uuid4().hex[:8].upper(),
            "req_id": req_id,
            "title": tc.get("title") or "(no title)",
            "steps": tc.get("steps") or [],
            "expected_result": tc.get("expected_result") or "",
            "preconditions": tc.get("preconditions") or "",
            "severity": tc.get("severity") or "Medium",
            "compliance_tags": tc.get("compliance_tags") or [
                "IEC62304:SW_VER","ISO13485:DocCtrl","ISO27001:AccessCtrl"
            ],
            "trace_link": tc.get("trace_link") or f"https://demo.trace/{req_id}",
            "model_version": MODEL_NAME,
            "prompt_version": PROMPT_VER,
            "created_at": now_ts(),
            "created_by": CREATED_BY,
        })
    errs = get_bq().insert_rows_json(TABLE_TC, rows)
    if errs:
        raise RuntimeError(f"BigQuery insert errors: {errs}")
    return rows

def sniff_extract_text(filename: str, content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        reader = PdfReader(BytesIO(content))
        return "\n\n".join(p.extract_text() or "" for p in reader.pages)
    if name.endswith(".docx"):
        doc = Document(BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    if name.endswith(".md") or name.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")
    return content.decode("utf-8", errors="ignore")

def upsert_requirement(req_id: str, title: str, text: str):
    row = [{
        "req_id": req_id,
        "source_type": "upload",
        "source_uri": f"upload://{req_id}",
        "title": title or "(Uploaded)",
        "text": text,
        "checksum": "",
        "created_at": now_ts(),
        "created_by": CREATED_BY
    }]
    errs = get_bq().insert_rows_json(TABLE_REQ, row)
    if errs:
        # ignore duplicates
        if not any("duplicate" in str(e).lower() for e in errs):
            raise RuntimeError(errs)

# ----------- Schemas -----------
class GenerateBody(BaseModel):
    req_id: Optional[str] = None
    text: Optional[str] = None
    compliance: Optional[List[str]] = None

# ----------- Routes -----------
@app.get("/health")
def health():
    return {"ok": True, "project": PROJECT_ID, "model": MODEL_NAME}

@app.post("/generate")
def generate(body: GenerateBody):
    rid = (body.req_id or f"REQ-{uuid.uuid4().hex[:6].upper()}").strip()

    if not body.text and body.req_id:
        job = get_bq().query(
            f"SELECT text FROM `{TABLE_REQ}` WHERE req_id=@rid",
            job_config=bigquery.QueryJobConfig(
                query_parameters=[bigquery.ScalarQueryParameter("rid","STRING", body.req_id)]
            ),
        )
        row = next(iter(job.result()), None)
        if not row:
            raise HTTPException(404, f"Requirement {body.req_id} not found")
        text = (row["text"] or "").strip()
    else:
        text = (body.text or "").strip()

    if not text:
        raise HTTPException(400, "Provide either 'text' or a valid 'req_id'.")

    prompt = fill_prompt(load_prompt(), rid, text, body.compliance)
    out = call_model(prompt)

    try:
        payload = json.loads(extract_json(out))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Model output invalid JSON: {e}")

    tcs = payload.get("test_cases", [])
    if not isinstance(tcs, list) or not tcs:
        raise HTTPException(500, "Model returned no test_cases")

    saved = save_rows(rid, tcs)
    return {"req_id": rid, "generated": len(saved), "test_cases": saved}

@app.post("/generate/{req_id}")
def generate_by_id(req_id: str):
    return generate(GenerateBody(req_id=req_id))

@app.post("/ingest")
async def ingest_requirement(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    req_id: Optional[str] = Form(None),
    compliance: Optional[str] = Form(None)
):
    content = await file.read()
    text = sniff_extract_text(file.filename, content)
    if not text.strip():
        raise HTTPException(400, "No text extracted from file.")

    rid = (req_id or f"REQ-{uuid.uuid4().hex[:6].upper()}").strip()
    upsert_requirement(rid, title or file.filename, text)

    comp_list = None
    if compliance:
        try:
            comp_list = json.loads(compliance)
        except Exception:
            comp_list = None

    prompt = fill_prompt(load_prompt(), rid, text, comp_list)
    out = call_model(prompt)

    try:
        payload = json.loads(extract_json(out))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Model output invalid JSON: {e}")

    tcs = payload.get("test_cases", [])
    if not isinstance(tcs, list) or not tcs:
        raise HTTPException(500, "Model returned no test_cases")

    saved = save_rows(rid, tcs)
    return {"req_id": rid, "generated": len(saved), "test_cases": saved, "title": title or file.filename}
