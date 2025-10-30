# api/traceability.py
from fastapi import APIRouter, HTTPException
from google.cloud import bigquery
from datetime import datetime, timezone
import os

PROJECT_ID = os.getenv("PROJECT_ID", "orbit-ai-472708")
DATASET = os.getenv("DATASET", "orbit_ai_poc")
TABLE_REQ = f"{PROJECT_ID}.{DATASET}.requirements"
TABLE_TC  = f"{PROJECT_ID}.{DATASET}.generated_testcases"

router = APIRouter(prefix="/api/traceability", tags=["traceability"])

bq = bigquery.Client(project=PROJECT_ID)

def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

@router.get("/{req_id}")
def get_traceability(req_id: str):
    # --- fetch requirement text/title ---
    q1 = f"SELECT title, text FROM `{TABLE_REQ}` WHERE req_id=@rid LIMIT 1"
    job1 = bq.query(
        q1,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("rid", "STRING", req_id)]
        ),
    )
    row = next(iter(job1.result()), None)
    if not row:
        raise HTTPException(404, f"Requirement {req_id} not found")

    # --- fetch related testcases ---
    q2 = f"SELECT test_id, title, severity FROM `{TABLE_TC}` WHERE req_id=@rid ORDER BY created_at DESC"
    job2 = bq.query(
        q2,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("rid", "STRING", req_id)]
        ),
    )
    tests = [{"id": r["test_id"], "title": r["title"], "severity": r["severity"]} for r in job2.result()]

    return {
        "req_id": req_id,
        "title": row["title"],
        "text": row["text"],
        "related_tests": tests,
        "fetched_at": now(),
    }
