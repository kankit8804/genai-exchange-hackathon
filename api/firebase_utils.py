# /api/firebase_utils.py
import os, json, firebase_admin
from firebase_admin import credentials, firestore

def get_firestore_client():
    if not firebase_admin._apps:
        # Load from FIREBASE_SERVICE_ACCOUNT env var
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
        if not sa_json:
            raise RuntimeError("Missing FIREBASE_SERVICE_ACCOUNT")
        cred_data = json.loads(sa_json)
        cred = credentials.Certificate(cred_data)
        firebase_admin.initialize_app(cred)
    return firestore.client()
