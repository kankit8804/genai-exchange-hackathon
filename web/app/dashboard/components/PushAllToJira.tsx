"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase/initFirebase";
import { doc, getDoc } from "firebase/firestore";

interface TestCase {
  req_id: string;
  test_id: string;
  title: string;
  steps: string[];
}

interface Props {
  testCases: TestCase[];
  apiBase: string;
  jira_project_key: string | null;
}

export default function PushAllToJira({ testCases, apiBase, jira_project_key }: Props) {
  const [pushingAll, setPushingAll] = useState(false);
  const [status, setStatus] = useState<string>("");

  const pushAll = async () => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in!");

    setPushingAll(true);
    setStatus("Fetching Jira credentials...");

    try {
      // 🔹 Fetch Jira credentials from Firestore
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("No user found");

      const { jira } = userSnap.data();
      if (!jira || !jira.domain || !jira.email || !jira.apiToken) {
        throw new Error("Missing Jira credentials");
      }

      // 🔹 Build the payload as an array
      const payload = testCases.map((tc) => ({
        jira_domain: jira.domain,
        jira_email: jira.email,
        jira_api_token: jira.apiToken,
        jira_project_key,
        jira_issue_type: "Task",
        uid: user.uid,
        summary: tc.title,
        steps: tc.steps,
        test_id: tc.test_id,
        req_id: tc.req_id,
      }));

      setStatus(`Pushing ${payload.length} test cases to Jira...`);

      // 🔹 Single bulk API call
      const res = await fetch(`${apiBase}/push/jira/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      // 🔹 Analyze backend response
      if (!res.ok) {
        console.error("Jira bulk push failed:", result);
        throw new Error(result.detail || "Failed to push to Jira");
      }

      const successCount = result.results.filter((r: any) => r.ok).length;
      const failCount = result.results.length - successCount;

      setStatus(`✅ Done! ${successCount} pushed, ${failCount} failed.`);
      alert(`✅ Done! ${successCount} pushed, ${failCount} failed.`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
      alert(`❌ ${err.message}`);
    } finally {
      setPushingAll(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4 shadow-sm bg-white">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">ALM Integration</h3>
      </div>

      <p className="mt-2 text-xs text-slate-600">
        Push all the test cases shown in “Results” into Jira as <em>Test Case</em> work items.
      </p>

      <button
        onClick={pushAll}
        disabled={pushingAll || testCases.length === 0}
        className="mt-3 w-full rounded-xl px-3 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pushingAll ? "Pushing All..." : "Push All to Jira"}
      </button>

      {status && (
        <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 break-words">
          {status}
        </div>
      )}
    </div>
  );
}
