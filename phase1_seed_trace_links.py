import uuid
from datetime import datetime, timezone
from google.cloud import bigquery

PROJECT_ID = "orbit-ai-472708"
DATASET = "orbit_ai_poc"
TABLE_TC = f"{PROJECT_ID}.{DATASET}.generated_testcases"
TABLE_TR = f"{PROJECT_ID}.{DATASET}.trace_links"

def now():
    return datetime.now(timezone.utc)

bq = bigquery.Client(project=PROJECT_ID)

# pick a small sample of recent testcases to link
rows = list(bq.query(f"""
  SELECT req_id, test_id
  FROM `{TABLE_TC}`
  ORDER BY created_at DESC
  LIMIT 12
""").result())

out = []
for i, r in enumerate(rows, start=1):
    sys = ["jira","azure_devops","polarion"][i % 3]
    ext_id = {
        "jira": f"JIRA-{1000+i}",
        "azure_devops": f"ADO-{2000+i}",
        "polarion": f"POL-{3000+i}",
    }[sys]
    link = {
        "jira": f"https://demo.jira/browse/{ext_id}",
        "azure_devops": f"https://dev.azure.com/demo/{ext_id}",
        "polarion": f"https://polarion.demo/workitem?id={ext_id}",
    }[sys]
    out.append({
        "req_id": r["req_id"],
        "test_id": r["test_id"],
        "external_system": sys,
        "external_id": ext_id,
        "link": link,
        "created_at": now(),
        "created_by": "demo@orbit-ai"
    })

errors = bq.insert_rows_json(TABLE_TR, out)
if errors:
    raise RuntimeError(errors)
print(f"Inserted {len(out)} mock trace links.")