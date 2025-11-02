// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Declare a minimal "process" type so TypeScript can compile in a DOM-only
// project config without @types/node. Next.js inlines NEXT_PUBLIC_* at build time.
declare const process: { env: Record<string, string | undefined> };

// Trim all env vars to avoid stray CR/LF (e.g., "orbit-ai-1234\r") that break
// Firestore requests with malformed database resource names.
const safeTrim = (v?: string) => (v ?? "").trim();

const firebaseConfig = {
  apiKey: safeTrim(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: safeTrim(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: safeTrim(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: safeTrim(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: safeTrim(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: safeTrim(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: safeTrim(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID)
};

// Only initialize the Firebase Web SDK on the client and when the public envs exist.
// During Cloud Build (prerender) these NEXT_PUBLIC_* build args may be empty which
// causes firebase to throw (invalid-api-key). Guarding prevents prerender errors.
const isClient = typeof window !== "undefined";
const hasClientConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId
);

let app: ReturnType<typeof initializeApp> | undefined;
if (isClient && hasClientConfig) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
  } catch (e) {
    // initialization can occasionally throw if environment is unusual; log and continue
    // so build/prerender won't fail.
    // eslint-disable-next-line no-console
    console.error("[client firebase] initializeApp failed:", e);
    console.error("[client firebase] Config check - API Key exists:", Boolean(firebaseConfig.apiKey));
    console.error("[client firebase] Config check - Project ID exists:", Boolean(firebaseConfig.projectId));
  }
} else if (isClient && !hasClientConfig) {
  console.error("[client firebase] Missing required Firebase environment variables!");
  console.error("NEXT_PUBLIC_FIREBASE_API_KEY:", firebaseConfig.apiKey ? "Set" : "Missing");
  console.error("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", firebaseConfig.projectId ? "Set" : "Missing");
}

// Export nullable instances — callers should only use these on the client at runtime.
// Never export null to avoid SSR-time errors from libraries that access
// properties like `auth.currentUser` without null checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: any = app ? getAuth(app) : ({} as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = app ? getFirestore(app) : ({} as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const storage: any = app ? getStorage(app) : ({} as any);