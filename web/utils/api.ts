// utils/api.ts
import type { LastResult, TestCase } from "./types";

// Minimal declaration for process.env to avoid Node types requirement
declare const process: { env: Record<string, string | undefined> };

// Determine API base URL: prefer NEXT_PUBLIC_API_BASE_URL (inlined at build),
// then window.API_BASE (set in layout.tsx), then fallback to default.
const envBase = process?.env?.NEXT_PUBLIC_API_BASE_URL;
const winBase = typeof window !== "undefined" ? (window as any).API_BASE : undefined;
let API_BASE = (envBase && envBase.trim())
  ? envBase
  : (winBase ? String(winBase) : "https://orbit-api-938180057345.us-central1.run.app");
API_BASE = API_BASE.replace(/\/+$/, "");

export const setApiBase = (url: string): void => {
  API_BASE = url;
};

export const getApiBase = (): string => API_BASE;

/**
 * Perform a health check to see if the API is online.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Generic function for handling JSON POST requests.
 */
async function postJson<T>(endpoint: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const errorData = (await res.json()) as { message?: string };
      message = errorData.message ?? message;
    } catch {
      // ignore parsing error
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

/**
 * User signup endpoint.
 */
export const signup = async (
  data: Record<string, string>
): Promise<LastResult> => {
  return postJson<LastResult>("signup", data);
};

/**
 * User login endpoint.
 */
export const login = async (
  data: Record<string, string>
): Promise<LastResult> => {
  return postJson<LastResult>("login", data);
};

/**
 * Optional: example of a test-case upload (if needed)
 */
export const uploadTestCases = async (
  testCases: TestCase[]
): Promise<LastResult> => {
  return postJson<LastResult>("upload-test-cases", { testCases });
};

export type { LastResult, TestCase };

export const post = async <T>(
  endpoint: string,
  payload: unknown
): Promise<T> => {
  return postJson<T>(endpoint, payload);
};
