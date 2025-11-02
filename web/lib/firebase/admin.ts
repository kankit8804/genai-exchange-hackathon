// web/lib/firebase/admin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * We support TWO env layouts:
 *
 * A) Single JSON string (preferred):
 *    FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ... "private_key":"-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n", ...}
 *
 * B) Three separate vars:
 *    FIREBASE_PROJECT_ID=...
 *    FIREBASE_CLIENT_EMAIL=...
 *    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *    (Note: keep the \n escapes in the .env file)
 */

function getCredentialFromEnv():
	| { projectId: string; clientEmail: string; privateKey: string }
	| null {
	// Try the single JSON blob first
	const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
	if (raw) {
		try {
			const json = JSON.parse(raw as string);
			const projectId = json.project_id as string | undefined;
			const clientEmail = json.client_email as string | undefined;
			const privateKey = String(json.private_key || "").replace(/\\n/g, "\n");
			if (projectId && clientEmail && privateKey) {
				return { projectId, clientEmail, privateKey };
			}
			console.error(
				"[admin] FIREBASE_SERVICE_ACCOUNT JSON is missing required fields (project_id, client_email, private_key)."
			);
		} catch (e) {
			console.error("[admin] Could not parse FIREBASE_SERVICE_ACCOUNT JSON:", e);
		}
	}

	// Fallback: separate env vars
	const projectId = process.env.FIREBASE_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
	const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

	if (projectId && clientEmail && privateKey) {
		return { projectId, clientEmail, privateKey };
	}

	// Nothing usable — don’t throw here; let caller handle gracefully.
	return null;
}

function ensureAdminInitialized() {
	if (getApps().length) return;

	const creds = getCredentialFromEnv();
	try {
		if (creds) {
			initializeApp({
				credential: cert({
					projectId: creds.projectId,
					clientEmail: creds.clientEmail,
					privateKey: creds.privateKey,
				}),
			});
		} else {
			// Initialize without explicit credentials to avoid import-time crashes during build.
			// In Cloud Run, ADC may be picked up at runtime; if not, calls to admin SDK will fail at call time,
			// but the module import won't crash the build.
			initializeApp();
		}
	} catch (e) {
		console.error("[admin] initializeApp failed:", e);
	}
}

ensureAdminInitialized();

export const adminAuth = getAuth();
export const adminDb = getFirestore();
