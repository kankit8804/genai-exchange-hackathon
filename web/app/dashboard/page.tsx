"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/initFirebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { healthCheck } from "@/utils/api";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/initFirebase";
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
  // const [file, setFile] = useState<File | null>(null);

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [summary, setSummary] = useState("No results yet.");

  const API_BASE = "http://127.0.0.1:8000";

  const searchParams = useSearchParams();
  const projectName = searchParams.get("projectName");
  const pDescription = searchParams.get("description");
  const projectId = searchParams.get("projectId");
  const jiraProjoctKey = searchParams.get("jiraProjectKey");

  console.log(
    `Project Name:${projectName}, Description${pDescription}, ProjecctId:${projectId}, jiraProjectKey:${jiraProjoctKey}`
  );

  // Unified testcase Generation
  const [files, setFiles] = useState<FileList | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const [description, setDescription] = useState("");
  const [loadingGen, setLoading] = useState(false);

  const addLink = () => {
    if (newLink.trim() === "") return;
    setLinks([...links, newLink.trim()]);
    setNewLink("");
  };

  const handleGenerate = async () => {
    if (!files?.length && !links.length && !description.trim()) {
      alert("Please provide at least one input (file, link, or text).");
      return;
    }

    const formData = new FormData();

    if (files?.length) {
      Array.from(files).forEach((file) => formData.append("files", file));
    }

    if (links.length) {
      formData.append("links", JSON.stringify(links));
    }

    if (description.trim()) {
      formData.append("description", description.trim());
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/generate_unified`, {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", res.status);

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setSummary(data.summary ?? "Generated successfully!");
      setTestCases(data.test_cases ?? []);
    } catch (err) {
      console.error("Error generating:", err);
      alert("Error generating test cases.");
    } finally {
      setLoading(false);
    }
  };

  // Redirect if not logged in
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
              {pDescription}
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
        <section className="space-y-6 lg:col-span-2 relative min-h-[300px]">
          <Card>
            <CardHeader
              title="Upload Requirement Document"
              subtitle="PDF, DOCX, TXT or Markdown. Optionally add a title or REQ-ID."
            />

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
            
            {/*Upload File Section*/}
            <input
              id="files"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              multiple
              className="hidden"
              onChange={(e) => setFiles(e.target.files)}
            />
                <label
                  htmlFor="files"
                  className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50"
                >
              <span className="truncate">
                {files?.length
                  ? `${files.length} file(s) selected`
                  : "Choose File(s)"}
              </span>
              <span className="rounded-lg bg-emerald-600 px-3 px-3 py-1 text-xs text-white hover:bg-emerald-700">Browse</span>
            </label>
            
            {files?.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {Array.from(files).map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-1"
                  >
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Attach Link Section*/}
          <Card>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reference Links
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste a link (e.g. Jira, Drive, Notion)"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <button
                  type="button"
                  onClick={addLink}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
                >
                  Add
                </button>
              </div>
              {links.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-emerald-700">
                  {links.map((l, i) => (
                    <li key={i}>
                      <a href={l} target="_blank" rel="noreferrer" className="hover:underline">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          
          {/* Free Text Generate*/}
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
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </Card>

          <div className="bottom-3 right-4">
            <PrimaryButton
             onClick={handleGenerate}
              loading={loading}
              label="Generate Test Cases"
              loadingLabel="Generating..."
            />
          </div>
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
                    <ResultItem
                      key={tc.test_id}
                      tc={tc}
                      post={post}
                      apiBase={API_BASE}
                      jira_project_key={jiraProjoctKey}
                    />
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

      <footer className="py-8 text-center text-xs text-slate-500">© Orbit AI</footer>
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



function ResultItem({
  tc,
  post,
  apiBase,
  jira_project_key,
}: {
  tc: TestCase;
  post: <T>(url: string, payload?: object) => Promise<T>;
  apiBase: string;
  jira_project_key: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [jira, setJira] = useState("");
  const user = auth.currentUser;

const handlePushToJira = async () => {
  if (!user) return alert("You must be logged in!");

  console.log("Pushing test case to Jira for user:", user.uid);

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  
    if (!userSnap.exists()) {
      alert("No user data found in Firestore.");
      return;
    }

    const userData = userSnap.data();
    const jira = userData.jira;

  if (!jira || !jira.domain || !jira.email || !jira.apiToken) {
    alert("Please save your Jira credentials first.");
    return;
  }

  const payload = {
    jira_domain: jira.domain,
    jira_email: jira.email,
    jira_api_token: jira.apiToken,
    jira_project_key: jira_project_key,  
    jira_issue_type: "Task",
    uid: user.uid,

    summary: tc.title,
    steps: tc.steps,
    test_id: tc.test_id,
    req_id: tc.req_id,
  };

    const res = await fetch(`${apiBase}/push/jira`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });


    console.log("Jira push response status:", res.status);
    const result = await res.json();

  if (res.ok) {
    alert(`Jira issue created: ${result.external_key}\n${result.external_url}`);
  } else {
    console.error(result);
    alert(`Failed to create issue: ${result.detail || "Unknown error"}`);
  }
};

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{tc.title}</h4>
            <SeverityBadge level={tc.severity} />
          </div>
          <div className="mt-1 text-[12px] text-slate-500">
            Test: {tc.test_id} • REQ: {tc.req_id}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePushToJira}
            disabled={pushing}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
          >
            {pushing ? "Pushing…" : "Push to Jira"}
          </button>
          {jira && (
            <a
              href={jira}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-700 hover:underline"
            >
              View ↗
            </a>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-slate-600 hover:underline"
          >
            {open ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="my-3 h-px bg-slate-200" />
          <div className="text-xs text-slate-700">
            <div className="mb-1 font-semibold text-slate-800">Steps</div>
            <ol className="list-decimal pl-5 space-y-1">
              {tc.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <div className="mt-3 text-xs">
            <div className="mb-1 font-semibold text-slate-800">Expected</div>
            <div className="text-slate-700">{tc.expected_result}</div>
          </div>
          {tc.req_id && (
            <div className="mt-3">
              <a
                className="text-xs text-emerald-700 hover:underline"
                href={`/traceability/${tc.req_id}?test_id=${tc.test_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Traceability Link ↗
              </a>
            </div>
          )}
        </>
      )}
    </li>
  );
}
