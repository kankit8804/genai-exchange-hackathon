import os, json, uuid, re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import traceability
import requests

# Vertex AI / BigQuery
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.cloud import bigquery

# Optional parsers for uploads
from pypdf import PdfReader
from docx import Document
from io import BytesIO

# -------------------- Config --------------------
PROJECT_ID   = os.getenv("PROJECT_ID", "orbit-ai-472708")
LOCATION     = os.getenv("LOCATION", "us-central1")
MODEL_NAME   = os.getenv("MODEL_NAME", "gemini-2.0-flash-001")
DATASET      = os.getenv("DATASET", "orbit_ai_poc")
PROMPT_PATH  = os.getenv("PROMPT_PATH", "prompts/prompt_poc_v1.txt")
PROMPT_VER   = os.getenv("PROMPT_VERSION", "poc-v1")
CREATED_BY   = os.getenv("CREATED_BY", "demo@orbit-ai")

# Jira (set these in Cloud Run env)
JIRA_BASE = os.getenv("JIRA_BASE")                 # e.g. https://your-site.atlassian.net
JIRA_USER = os.getenv("JIRA_USER")                 # Atlassian account email
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")       # API token from https://id.atlassian.com
JIRA_PROJECT_KEY = os.getenv("JIRA_PROJECT_KEY")   # e.g. TEST
JIRA_ISSUE_TYPE = os.getenv("JIRA_ISSUE_TYPE", "Task")  # "Task" works on free plan

# Tables / Views
TABLE_REQ  = f"{PROJECT_ID}.{DATASET}.requirements"
TABLE_TC   = f"{PROJECT_ID}.{DATASET}.generated_testcases"
TABLE_TRL  = f"{PROJECT_ID}.{DATASET}.trace_links"

# -------------------- Lazy Clients --------------------
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

# -------------------- FastAPI App --------------------
app = FastAPI(title="Orbit AI Test Case Generator API", version="0.3")

# Open CORS for PoC; restrict to your web origin later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Helpers --------------------
def load_prompt() -> str:
    try:
        with open(PROMPT_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        # Minimal safe fallback
        return (
            "You are an expert QA engineer for healthcare software.\n"
            "Requirement ID: {{req_id}}\n"
            "Requirement Text:\n{{requirement_text}}\n\n"
            "Return STRICT JSON with key 'test_cases' as an array. Each item has:\n"
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
    # Strip markdown fences and pull the first JSON object
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

def save_testcases(req_id: str, tcs: List[dict], project_id: Optional[str] = None) -> List[dict]:
    rows = []
    BASE_URL = "http://localhost:3000"
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
            "trace_link" : tc.get("trace_link") or f"{BASE_URL}/traceability/{req_id}",
            "model_version": MODEL_NAME,
            "prompt_version": PROMPT_VER,
            "created_at": now_ts(),
            "created_by": CREATED_BY,
            "project_id": project_id or tc.get("project_id") or PROJECT_ID,
        })
    errs = get_bq().insert_rows_json(TABLE_TC, rows)
    if errs:
        raise HTTPException(500, f"BigQuery insert errors: {errs}")
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
        # ignore duplicates by req_id
        msg = " ".join(str(e) for e in errs)
        if "duplicate" not in msg.lower():
            raise HTTPException(500, f"Requirement upsert failed: {errs}")

def save_trace_link(req_id: str, test_id: str, system: str, key: str, url: str):
    rows = [{
        "req_id": req_id,
        "test_id": test_id,
        "external_system": system,
        "external_key": key,
        "external_url": url,
        "created_at": now_ts(),
        "created_by": CREATED_BY,
    }]
    errs = get_bq().insert_rows_json(TABLE_TRL, rows)
    if errs:
        raise HTTPException(500, f"Trace insert failed: {errs}")

# -------------------- Schemas --------------------
class GenerateBody(BaseModel):
    req_id: Optional[str] = None
    text: Optional[str] = None
    compliance: Optional[List[str]] = None
    project_id: Optional[str] = None


class PushBody(BaseModel):
    req_id: str
    test_id: str
    summary: str
    steps: Optional[List[str]] = None


def build_adf_description(summary: str, steps: Optional[List[str]] = None, expected: Optional[str] = None) -> dict:
    """
    Build an Atlassian Document Format (ADF) description.
    https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
    """
    doc = {
        "version": 1,
        "type": "doc",
        "content": []
    }

    # Summary paragraph
    if summary:
        doc["content"].append({
            "type": "paragraph",
            "content": [{"type": "text", "text": summary}]
        })

    # Steps list
    if steps:
        # Heading "Steps"
        doc["content"].append({
            "type": "heading",
            "attrs": {"level": 3},
            "content": [{"type": "text", "text": "Steps"}]
        })
        # Ordered list
        ol = {"type": "orderedList", "attrs": {"order": 1}, "content": []}
        for s in steps:
            ol["content"].append({
                "type": "listItem",
                "content": [{
                    "type": "paragraph",
                    "content": [{"type": "text", "text": s}]
                }]
            })
        doc["content"].append(ol)

    if expected:
        doc["content"].append({
            "type": "heading",
            "attrs": {"level": 3},
            "content": [{"type": "text", "text": "Expected Result"}]
        })
        doc["content"].append({
            "type": "paragraph",
            "content": [{"type": "text", "text": expected}]
        })

    # Fallback if empty
    if not doc["content"]:
        doc["content"].append({"type": "paragraph", "content": [{"type": "text", "text": ""}]})

    return doc



# -------------------- Routes --------------------
app.include_router(traceability.router)
@app.get("/health")
def health():
    return {
        "ok": True,
        "project": PROJECT_ID,
        "model": MODEL_NAME,
        "bq": TABLE_TC,
        "jira": bool(JIRA_BASE and JIRA_USER and JIRA_API_TOKEN and JIRA_PROJECT_KEY),
    }

@app.post("/generate")
def generate(body: GenerateBody):
    rid = (body.req_id or f"REQ-{uuid.uuid4().hex[:6].upper()}").strip()

    if not body.text and body.req_id:
        # fetch requirement text from BQ by req_id
        job = get_bq().query(
            f"SELECT text FROM `{TABLE_REQ}` WHERE req_id=@rid",
            job_config=bigquery.QueryJobConfig(
                query_parameters=[bigquery.ScalarQueryParameter("rid", "STRING", body.req_id)]
            ),
        )
        row = next(iter(job.result()), None)
        if not row:
            raise HTTPException(404, f"Requirement {body.req_id} not found")
        text = (row["text"] or "").strip()
        rid = body.req_id
    else:
        text = (body.text or "").strip()

    if not text:
        raise HTTPException(400, "Provide either 'text' or a valid 'req_id'.")

    upsert_requirement(rid, f"Generated Requirement {rid}", text, project_id=body.project_id)

    prompt = fill_prompt(load_prompt(), rid, text, body.compliance)
    out = call_model(prompt)

    try:
        payload = json.loads(extract_json(out))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Model output invalid JSON: {e}")

    tcs = payload.get("test_cases", [])
    if not isinstance(tcs, list) or not tcs:
        raise HTTPException(500, "Model returned no test_cases")

    saved = save_testcases(rid, tcs, project_id=body.project_id)
    return {"req_id": rid, "generated": len(saved), "test_cases": saved}

@app.post("/generate/{req_id}")
def generate_by_id(req_id: str):
    return generate(GenerateBody(req_id=req_id))

@app.post("/ingest")
async def ingest_requirement(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    req_id: Optional[str] = Form(None),
    compliance: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None), 
):
    content = await file.read()
    text = sniff_extract_text(file.filename, content)
    if not text.strip():
        raise HTTPException(400, "No text extracted from file.")

    rid = (req_id or f"REQ-{uuid.uuid4().hex[:6].upper()}").strip()
    upsert_requirement(rid, title or file.filename, text, project_id=project_id)

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

    saved = save_testcases(rid, tcs, project_id=project_id)
    return {"req_id": rid, "generated": len(saved), "test_cases": saved, "title": title or file.filename}

@app.post("/push/jira")
def push_jira(body: PushBody):
    # Validate config
    if not (JIRA_BASE and JIRA_USER and JIRA_API_TOKEN and JIRA_PROJECT_KEY):
        raise HTTPException(
            500,
            "Jira env vars missing. Set JIRA_BASE, JIRA_USER, JIRA_API_TOKEN, JIRA_PROJECT_KEY (and optional JIRA_ISSUE_TYPE)."
        )

    # Build ADF description (we don’t have expected here; you could extend PushBody to include it)
    adf = build_adf_description(
        summary=body.summary or f"Test Case {body.test_id}",
        steps=body.steps or None,
        expected=None
    )

    url = f"{JIRA_BASE}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": JIRA_PROJECT_KEY},
            "summary": body.summary or f"Test Case {body.test_id}",
            "description": adf,  # ADF document (required by v3)
            "labels": ["orbit-ai", "test-case"],
            "issuetype": {"name": JIRA_ISSUE_TYPE}  # "Task" works on free Jira
        }
    }

    # Using basic auth (email + API token)
    r = requests.post(
        url,
        json=payload,
        auth=(JIRA_USER, JIRA_API_TOKEN),
        headers={"Accept": "application/json", "Content-Type": "application/json"}
    )
    if r.status_code not in (200, 201):
        raise HTTPException(500, f"Jira push failed: {r.text}")

    data = r.json()
    issue_key = data.get("key")
    issue_url = f"{JIRA_BASE}/browse/{issue_key}"

    save_trace_link(body.req_id, body.test_id, "Jira", issue_key, issue_url)
    return {"ok": True, "external_key": issue_key, "external_url": issue_url}
