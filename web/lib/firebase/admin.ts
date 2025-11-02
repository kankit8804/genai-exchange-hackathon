// web/lib/firebase/admin.ts
import { cert, getApps, initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

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

async function fetchServiceAccountFromSecretManager(): Promise<{ projectId: string; clientEmail: string; privateKey: string } | null> {
	// Attempt to read secret FIREBASE_SERVICE_ACCOUNT from Secret Manager.
	// The secret resource path requires a project id.
	const secretName = process.env.FIREBASE_SERVICE_ACCOUNT_SECRET_NAME || "FIREBASE_SERVICE_ACCOUNT";
	const projectId =
		process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

	if (!projectId) {
		console.warn("[admin] No project id found for Secret Manager lookup; skipping secret fetch.");
		return null;
	}

	try {
		const client = new SecretManagerServiceClient();
		const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
	const [version] = await client.accessSecretVersion({ name });
	const raw = version.payload?.data as Uint8Array | undefined;
	const payload = raw ? Buffer.from(raw).toString("utf8") : undefined;
		if (!payload) return null;
		const json = JSON.parse(payload);
		const projectIdVal = json.project_id as string | undefined;
		const clientEmail = json.client_email as string | undefined;
		const privateKey = String(json.private_key || "").replace(/\\n/g, "\n");
		if (projectIdVal && clientEmail && privateKey) {
			return { projectId: projectIdVal, clientEmail, privateKey };
		}
		console.warn("[admin] Secret found but missing fields (project_id, client_email, private_key)");
		return null;
	} catch (e) {
		console.warn("[admin] Could not access Secret Manager or secret not found:", e);
		return null;
	}
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

			// In the background, try to fetch the service account JSON from Secret Manager and re-init
			// with explicit credentials if available. This improves reliability when you prefer using
			// a secret instead of env-mapping. Do not await here — run in background.
			(async () => {
				try {
					const secretCreds = await fetchServiceAccountFromSecretManager();
					if (secretCreds) {
						// Delete the default app and re-initialize with the secret credentials
						const apps = getApps();
						if (apps.length) {
							await deleteApp(apps[0]);
						}
						initializeApp({
							credential: cert({
								projectId: secretCreds.projectId,
								clientEmail: secretCreds.clientEmail,
								privateKey: secretCreds.privateKey,
							}),
						});
						console.info("[admin] Re-initialized Firebase Admin using Secret Manager credentials.");
					}
				} catch (e) {
					console.warn("[admin] Background secret fetch/init failed:", e);
				}
			})();
		}
	} catch (e) {
		console.error("[admin] initializeApp failed:", e);
	}
}

ensureAdminInitialized();

// Export helper getters so callers always get the current auth/db instances. This makes
// re-initialization (e.g. after fetching secrets) safe because callers call the helper
// at request time rather than relying on a value captured at module load.
export function getAdminAuth() {
	ensureAdminInitialized();
	return getAuth();
}

export function getAdminDb() {
	ensureAdminInitialized();
	return getFirestore();
}
