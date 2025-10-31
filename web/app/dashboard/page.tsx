"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/initFirebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { healthCheck } from "@/utils/api";
import { Card, CardHeader, ResultItem, EmptyState } from "@/app/dashboard/components/ui";

/* ========= Types ========= */
interface TestCase {
  req_id: string;
  test_id: string;
  title: string;
  severity: string;
  expected_result: string;
  steps: string[];
  trace_link?: string;
}
interface GenerateResponse {
  req_id: string;
  generated: number;
  test_cases: TestCase[];
}
interface IngestResponse extends GenerateResponse { }
interface JiraResponse {
  external_url: string;
}

/* ========= Page ========= */
export default function Dashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [apiHealthy, setApiHealthy] = useState(false);

  // Controlled inputs
  const [freeText, setFreeText] = useState("");
  const [title, setTitle] = useState("");
  const [reqId, setReqId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [summary, setSummary] = useState("No results yet.");

  // Separate loading states
  const [loadingTextGen, setLoadingTextGen] = useState(false);
  const [loadingUploadGen, setLoadingUploadGen] = useState(false);

  const API_BASE = "https://orbit-api-938180057345.us-central1.run.app";

  const searchParams = useSearchParams();
  const projectName = searchParams.get("projectName");
  const description = searchParams.get("description");
  const projectId = searchParams.get("projectId");

  console.log(`Project Name:${projectName}, Description${description}, ProjecctId${projectId}`);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    healthCheck().then((ok) => setApiHealthy(ok));
  }, []);

  // POST helper
  const post = async <T,>(url: string, payload?: object): Promise<T> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
  };

// Generate from text
const handleGenerateText = async (): Promise<void> => {
  const text = freeText.trim();
  if (!text) return alert("Paste requirement text");

  try {
    setLoadingTextGen(true);
    const body: Record<string, any> = { text };
    if (projectId) body.project_id = projectId;
    console.log(projectId);
    console.log(body);
    const data = await post<GenerateResponse>(`${API_BASE}/generate`, body);
    setSummary(`Generated ${data.generated} test case(s) for ${data.req_id}`);
    setTestCases(data.test_cases);
  } catch (err) {
    alert(err instanceof Error ? err.message : "Error generating test cases");
  } finally {
    setLoadingTextGen(false);
  }
};

  // Upload + generate
  const handleUploadFile = async (): Promise<void> => {
    if (!file) return alert("Choose a file");

    const fd = new FormData();
    fd.append("file", file, file.name);
    if (title.trim()) fd.append("title", title.trim());
    if (reqId.trim()) fd.append("req_id", reqId.trim());
    if (projectId) fd.append("project_id", projectId);

    try {
      console.log(projectId);
      setLoadingUploadGen(true);
      const res = await fetch(`${API_BASE}/ingest`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data: IngestResponse = await res.json();
      setSummary(`Generated ${data.generated} test case(s) for ${data.req_id}`);
      setTestCases(data.test_cases);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error uploading file");
    } finally {
      setLoadingUploadGen(false);
    }
  };

  // Downloads
  const downloadJSON = (): void => {
    if (!testCases.length) return alert("Nothing to download");
    const blob = new Blob([JSON.stringify({ test_cases: testCases }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `generated-testcases.json`;
    a.click();
  };

  const downloadCSV = (): void => {
    if (!testCases.length) return alert("Nothing to download");
    const headers = ["req_id", "test_id", "title", "severity", "expected_result"];
    const lines = [headers.join(",")].concat(
      testCases.map((r) =>
        [r.req_id, r.test_id, r.title, r.severity, r.expected_result]
          .map((v) => `"${(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `generated-testcases.csv`;
    a.click();
  };

  // Results sorting
  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Unknown: 4 } as const;
  const sorted = useMemo(
    () =>
      [...testCases].sort(
        (a, b) =>
          (severityOrder[(a.severity as keyof typeof severityOrder) ?? "Unknown"] ?? 4) -
          (severityOrder[(b.severity as keyof typeof severityOrder) ?? "Unknown"] ?? 4),
      ),
    [testCases],
  );

  const hasResults = sorted.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 text-slate-800">
      {/* Top bar (light, like signup) */}
      <header className="sticky top-0 z-50 bg-[#0b1220] text-white shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-4">
          {/* Left: title */}
          <div className="leading-tight">
            <h1 className="text-xl font-semibold text-white">
              {/* Orbit AI — Test Case Generator */}
              {projectName}
            </h1>
            <p className="text-sm text-slate-300">
              {description}
            </p>

          </div>

          {/* Right: status + logout */}
          <div className="ml-auto flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${apiHealthy
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                  : "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30"
                }`}
            >
              {apiHealthy ? "Connected ✓" : "Offline ✗"}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-10 grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <section className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Generate from Free Text"
              subtitle="Paste a requirement (no PHI). We’ll analyze it and propose high-quality test cases."
            />
            <div className="mt-4 space-y-3">
              <TextArea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Paste a requirement (no PHI)"
              />
              <PrimaryButton
                onClick={handleGenerateText}
                loading={loadingTextGen}
                label="Analyze & Generate"
                loadingLabel="Generating…"
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Upload Requirement Document"
              subtitle="PDF, DOCX, TXT or Markdown. Optionally add a title or REQ-ID."
            />
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Optional title"
                />
                <Input
                  value={reqId}
                  onChange={(e) => setReqId(e.target.value)}
                  placeholder="REQ-ID (optional)"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label
                  htmlFor="file"
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <span className="truncate">
                    {file ? file.name : "Choose File"}
                  </span>
                  <span className="rounded-md bg-slate-100 px-3 py-1 text-xs">Browse</span>
                </label>
                <input
                  id="file"
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <PrimaryButton
                  onClick={handleUploadFile}
                  loading={loadingUploadGen}
                  label="Analyze & Generate"
                  loadingLabel="Uploading…"
                />
              </div>

              <p className="text-xs text-slate-500">PDF, DOCX, TXT, Markdown supported.</p>
            </div>
          </Card>
        </section>

        {/* Right column (compact until results; grows when they exist) */}
        <aside className="space-y-6 lg:sticky lg:top-24 self-start">
          <Card className={hasResults ? "overflow-hidden" : ""}>
            <CardHeader title="Results" subtitle={summary} />

            <div className="mt-3 flex gap-2">
              <ButtonGhost onClick={downloadJSON}>Download JSON</ButtonGhost>
              <ButtonGhost onClick={downloadCSV}>Download CSV</ButtonGhost>
              {hasResults && (
                <ButtonGhost
                  onClick={() => {
                    const encoded = encodeURIComponent(JSON.stringify(testCases));
                    router.push(`/dashboard/view?data=${encoded}`);
                  }}
                >
                  View All
                </ButtonGhost>
              )}

            </div>

            <div
              className={
                hasResults
                  ? "mt-4 overflow-y-auto pr-1 max-h-[calc(100vh-260px)]"
                  : "mt-2"
              }
            >
              {hasResults ? (
                <ul className="space-y-3">
                  {sorted.map((tc) => (
                    <ResultItem key={tc.test_id} tc={tc} post={post} apiBase={API_BASE} />
                  ))}
                </ul>
              ) : (
                <EmptyState />
              )}
            </div>
          </Card>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Pro tip: keep one requirement per run for crisper, atomic test cases.
          </div>
        </aside>
      </main>

      <footer className="py-8 text-center text-xs text-slate-500">© Orbit AI — PoC</footer>
    </div>
  );
}


function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-300"
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={[
        "min-h-[140px] w-full resize-y",
        "rounded-lg border !border-slate-300",
        "!bg-white !text-slate-900 placeholder:text-slate-400",
        "outline-none focus:ring-2 focus:ring-emerald-300",
        className,
      ].join(" ")}
    />
  );
}

function PrimaryButton({
  onClick,
  loading,
  label,
  loadingLabel,
}: {
  onClick: () => void | Promise<void>;
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60"
    >
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
      )}
      {loading ? loadingLabel : label}
    </button>
  );
}

function ButtonGhost({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
    >
      {children}
    </button>
  );
}



