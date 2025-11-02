// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Only initialize the Firebase Web SDK on the client and when the public envs exist.
// During Cloud Build (prerender) these NEXT_PUBLIC_* build args may be empty which
// causes firebase to throw (invalid-api-key). Guarding prevents prerender errors.
const isClient = typeof window !== "undefined";
const hasClientConfig = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
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
    console.error("[client firebase] Config check - API Key exists:", Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY));
    console.error("[client firebase] Config check - Project ID exists:", Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID));
  }
} else if (isClient && !hasClientConfig) {
  console.error("[client firebase] Missing required Firebase environment variables!");
  console.error("NEXT_PUBLIC_FIREBASE_API_KEY:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Set" : "Missing");
  console.error("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "Set" : "Missing");
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