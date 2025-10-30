import json
import csv
from phase1_generate_with_gemini import process_requirement, validate_and_normalize_payload, load_prompt_template

# Local mock data source
CSV_PATH = "data/requirements.csv"
OUTPUT_PATH = "data/testcases.json"
MODEL_NAME = "gemini-2.0-flash-001"

def load_requirements():
    reqs = []
    with open(CSV_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            reqs.append({
                "req_id": row["req_id"],
                "title": row["title"],
                "text": row["text"]
            })
    return reqs

def main():
    reqs = load_requirements()
    print(f"Found {len(reqs)} local requirements.")
    
    all_rows = []
    tmpl = load_prompt_template()
    for r in reqs[-3:]:  # only last 3 for test
        print(f"Generating locally for {r['req_id']} — {r['title']}")
        try:
            prompt = tmpl.replace("{{req_id}}", r["req_id"]).replace("{{requirement_text}}", r["text"])
            # Instead of calling Gemini, simulate an output
            dummy_out = {
                "req_id": r["req_id"],
                "test_cases": [
                    {
                        "title": f"Verify: {r['title']}",
                        "steps": ["Step 1: Setup", "Step 2: Execute", "Step 3: Validate"],
                        "expected_result": "Expected system to behave per requirement.",
                        "severity": "High",
                    }
                ]
            }
            rows = validate_and_normalize_payload(r["req_id"], json.dumps(dummy_out))
            all_rows.extend(rows)
            print(f"✅ Generated 1 test case for {r['req_id']}")
        except Exception as e:
            print(f"❌ Error generating for {r['req_id']}: {e}")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_rows, f, indent=2)
    print(f"\n✅ Local testcases written to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
