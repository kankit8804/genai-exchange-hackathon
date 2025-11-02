// web/lib/utils/alm.ts
export type UITestStep = { action: string; expected?: string };
export type UITestCase = {
  title: string;
  description?: string;
  steps?: UITestStep[];
  priority?: number;  // 1..4 (ADO convention)
  tags?: string[];
};

// Minimal declaration for process.env so this compiles in DOM-only contexts.
declare const process: { env: Record<string, string | undefined> };

function getApiBase(): string {
  // Prefer env (SSR-safe), fallback to window.API_BASE which is set in layout.tsx
  const sanitize = (v?: string) => (v ?? "").replace(/^\uFEFF/, "").trim().replace(/\/+$/, "");
  const env = sanitize(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (env) return env;
  if (typeof window !== "undefined" && (window as any).API_BASE) {
    return sanitize(String((window as any).API_BASE));
  }
  throw new Error("API base URL not configured. Set NEXT_PUBLIC_API_BASE_URL or window.API_BASE.");
}

export async function pushToAzure(items: UITestCase[]) {
  const base = getApiBase();
  const res = await fetch(`${base}/alm/azure/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Azure push failed: ${res.status} ${res.statusText} :: ${text}`);
  }
  return res.json() as Promise<{
    count: number;
    items: Array<{ id?: number; url?: string; error?: string }>;
  }>;
}
