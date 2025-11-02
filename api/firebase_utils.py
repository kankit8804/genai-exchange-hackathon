# /api/firebase_utils.py
import os, json, firebase_admin
from firebase_admin import credentials, firestore

def get_firestore_client():
    """
    Initialize Firebase Admin and return a Firestore client.

    Priority:
    1) If FIREBASE_SERVICE_ACCOUNT is set (JSON), use it.
    2) Otherwise, fall back to Application Default Credentials (ADC), but
       target the Firebase project specified via FIREBASE_PROJECT_ID if provided.

    This supports cross-project usage where Firebase (Firestore) lives in a
    different project than other GCP resources. In that case, grant the Cloud
    Run service account permissions in the Firebase project.
    """
    firebase_project_id = (os.getenv("FIREBASE_PROJECT_ID") or "").strip()

    if not firebase_admin._apps:
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
        if sa_json:
            cred_data = json.loads(sa_json)
            cred = credentials.Certificate(cred_data)
            # If firebase_project_id is not provided, it will be inferred from the SA
            if firebase_project_id:
                firebase_admin.initialize_app(cred, {"projectId": firebase_project_id})
            else:
                firebase_admin.initialize_app(cred)
        else:
            # Fall back to ADC (uses the Cloud Run service account)
            try:
                if firebase_project_id:
                    firebase_admin.initialize_app(options={"projectId": firebase_project_id})
                else:
                    firebase_admin.initialize_app()
            except Exception as e:
                raise RuntimeError(
                    "Failed to initialize Firebase Admin. Set FIREBASE_SERVICE_ACCOUNT or grant the service account ADC permissions."
                ) from e

    return firestore.client()
