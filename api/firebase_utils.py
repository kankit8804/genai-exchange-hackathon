# /api/firebase_utils.py
import os, json, firebase_admin
from firebase_admin import credentials, firestore

def get_firestore_client():
    """
    Initialize Firebase Admin and return a Firestore client.

    Priority:
    1) If FIREBASE_SERVICE_ACCOUNT is set (JSON), use it.
    2) Otherwise, fall back to Application Default Credentials (ADC).

    This makes Cloud Run deployments simpler because the runtime
    service account can be granted Firestore/Datastore permissions
    without injecting a service-account key as a secret.
    """
    if not firebase_admin._apps:
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
        if sa_json:
            cred_data = json.loads(sa_json)
            cred = credentials.Certificate(cred_data)
            firebase_admin.initialize_app(cred)
        else:
            # Fall back to ADC (uses the Cloud Run service account)
            try:
                firebase_admin.initialize_app()
            except Exception as e:
                raise RuntimeError(
                    "Failed to initialize Firebase Admin. Set FIREBASE_SERVICE_ACCOUNT or grant the service account ADC permissions."
                ) from e
    return firestore.client()
