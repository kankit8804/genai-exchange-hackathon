import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone

from google.cloud import bigquery
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig

# --------- Config helpers ----------
def getenv(key, default=None, required=False):
    val = os.environ.get(key, default)
    if required and not val:
        print(f"Missing required env var: {key}", file=sys.stderr)
        sys.exit(1)
    return val

try:
    # Optional .env loader
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

PROJECT_ID = getenv("PROJECT_ID", "orbit-ai-472708")
LOCATION = getenv("LOCATION", "us-central1")
MODEL_NAME = getenv("MODEL_NAME", "gemini-2.0-flash-001")
PROMPT_PATH = getenv("PROMPT_PATH", "prompts/prompt_poc_v1.txt")
PROMPT_VERSION = getenv("PROMPT_VERSION", "poc-v1")
CREATED_BY = getenv("CREATED_BY", "demo@orbit-ai")
DATASET = getenv("DATASET", "orbit_ai_poc")

TABLE_REQ = f"{PROJECT_ID}.{DATASET}.requirements"
TABLE_TC = f"{PROJECT_ID}.{DATASET}.generated_testcases"
TABLE_TR = f"{PROJECT_ID}.{DATASET}.trace_links"

SEVERITY_ALLOWED = {"Critical", "High", "Medium", "Low"}

# --------- Utils ----------
def now_ts():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def make_test_id():
    return "TEST-" + uuid.uuid4().hex[:8].upper()

def load_prompt_template():
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        return f.read()

def fill_prompt(tmpl: str, req_id: str, text: str) -> str:
    return tmpl.replace("{{req_id}}", req_id).replace("{{requirement_text}}", text)

def extract_json(text: str) -> str:
    """
    Try to extract a JSON object from model output (handles accidental text around it).
    """
    # Remove code fences if present
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE)
    # Find first { ... } block
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if m:
        return m.group(0)
    return text  # hope it's already clean JSON

def validate_and_normalize_payload(req_id: str, raw_json: str):
    data = json.loads(raw_json)

    # Minimal schema checks
    if "req_id" not in data:
        data["req_id"] = req_id
    if data["req_id"] != req_id:
        data["req_id"] = req_id  # enforce

    tcs = data.get("test_cases", [])
    if not isinstance(tcs, list) or len(tcs) == 0:
        raise ValueError("No test_cases returned")

    rows = []
    for tc in tcs:
        title = tc.get("title") or "(no title)"
        steps = tc.get("steps") or []
        if isinstance(steps, str):
            steps = [steps]
        steps = [str(s) for s in steps]

        expected_result = tc.get("expected_result") or ""
        preconditions = tc.get("preconditions") or ""
        severity = tc.get("severity") or "Medium"
        if severity not in SEVERITY_ALLOWED:
            severity = "Medium"

        tags = tc.get("compliance_tags") or ["IEC62304:SW_VER", "ISO13485:DocCtrl", "ISO27001:AccessCtrl"]
        if isinstance(tags, str):
            tags = [tags]
        tags = [str(t) for t in tags]

        trace_link = tc.get("trace_link") or f"https://demo.trace/{req_id}"

        # If model returned an id, keep it; else generate
        test_id = tc.get("test_id") or make_test_id()

        rows.append({
            "test_id": test_id,
            "req_id": req_id,
            "title": title,
            "steps": steps,
            "expected_result": expected_result,
            "preconditions": preconditions,
            "severity": severity,
            "compliance_tags": tags,
            "trace_link": trace_link,
            "model_version": MODEL_NAME,
            "prompt_version": PROMPT_VERSION,
            "created_at": now_ts(),
            "created_by": CREATED_BY
        })
    return rows

# --------- BigQuery ----------
bq_client = bigquery.Client(project=PROJECT_ID)

def fetch_requirements(limit: int = 3, req_id: str = None):
    if req_id:
        query = f"""
        SELECT req_id, title, text
        FROM `{TABLE_REQ}`
        WHERE req_id = @req_id
        """
        job = bq_client.query(query, job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("req_id", "STRING", req_id)]
        ))
    else:
        # fetch those without any testcases yet (left anti join)
        query = f"""
        SELECT r.req_id, r.title, r.text
        FROM `{TABLE_REQ}` r
        LEFT JOIN `{TABLE_TC}` g ON r.req_id = g.req_id
        WHERE g.req_id IS NULL
        ORDER BY r.req_id
        LIMIT @lim
        """
        job = bq_client.query(query, job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("lim", "INT64", limit)]
        ))
    return list(job.result())

def insert_testcases(rows):
    errors = bq_client.insert_rows_json(TABLE_TC, rows)
    if errors:
        raise RuntimeError(f"BigQuery insert errors: {errors}")

# --------- Vertex AI ----------
def init_vertex():
    vertexai.init(project=PROJECT_ID, location=LOCATION)

# Before:
# def call_gemini(prompt_text: str, temperature: float = 0.2, max_tokens: int = 2048) -> str:
#     model = GenerativeModel(MODEL_NAME)

def call_gemini(model_name: str, prompt_text: str, temperature: float = 0.2, max_tokens: int = 2048) -> str:
    model = GenerativeModel(model_name)
    cfg = GenerationConfig(temperature=temperature, max_output_tokens=max_tokens)
    resp = model.generate_content(prompt_text, generation_config=cfg)
    if hasattr(resp, "text") and resp.text:
        return resp.text
    try:
        parts = resp.candidates[0].content.parts
        return "".join(getattr(p, "text", "") for p in parts)
    except Exception:
        return str(resp)


# --------- Main flow ----------
# Before:
# def process_requirement(req_id: str, text: str, retries: int = 2):

def process_requirement(model_name: str, req_id: str, text: str, retries: int = 2):
    tmpl = load_prompt_template()
    prompt = fill_prompt(tmpl, req_id=req_id, text=text)

    last_err = None
    for attempt in range(retries + 1):
        out = call_gemini(model_name, prompt)
        try:
            json_str = extract_json(out)
            rows = validate_and_normalize_payload(req_id, json_str)
            # ensure we stamp the chosen model name on each row
            for r in rows:
                r["model_version"] = model_name
            return rows
        except Exception as e:
            last_err = e
            prompt = prompt + "\n\nIMPORTANT: Return ONLY valid JSON object with no extra text or code fences."
    raise RuntimeError(f"Failed to parse/validate Gemini output after retries: {last_err}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--req-id", help="Single requirement ID to process (e.g., REQ-0001)")
    parser.add_argument("--limit", type=int, default=3, help="How many requirements to process if --req-id not set")
    parser.add_argument("--model", default=getenv("MODEL_NAME", "gemini-2.0-flash-001"),
                        help="Model name, e.g., gemini-2.0-flash-001 or gemini-2.0-pro-001")
    args = parser.parse_args()

    model_name = args.model
    print(f"Using model: {model_name}")

    init_vertex()

    reqs = fetch_requirements(limit=args.limit, req_id=args.req_id)
    if not reqs:
        print("No matching requirements found (or all already have test cases).")
        return

    total_rows = 0
    for r in reqs:
        rid = r["req_id"]
        text = r["text"]
        print(f"Generating for {rid}...")
        rows = process_requirement(model_name, rid, text)
        insert_testcases(rows)
        print(f"Inserted {len(rows)} test case(s) for {rid}.")
        total_rows += len(rows)

    print(f"Done. Inserted {total_rows} test case(s).")

if __name__ == "__main__":
    main()
