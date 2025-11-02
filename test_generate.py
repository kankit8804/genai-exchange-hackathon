import requests
import json

url = "https://orbit-api-938180057345.us-central1.run.app/generate"

payload = {
    "req_id": "REQ-888888",
    "text": "Rohit shall be able to update a patient's fungus record. The system must validate that MLA medications are flagged and warns the ward prior to saving."
}

headers = {"Content-Type": "application/json"}

response = requests.post(url, headers=headers, data=json.dumps(payload))

print("Status Code:", response.status_code)
print("Response JSON:", response.json())
