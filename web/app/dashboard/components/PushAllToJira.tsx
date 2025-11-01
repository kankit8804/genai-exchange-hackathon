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
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("No user found");

      const { jira } = userSnap.data();
      if (!jira || !jira.domain || !jira.email || !jira.apiToken) {
        throw new Error("Missing Jira credentials");
      }

      let successCount = 0;
      let failCount = 0;

      for (const [index, tc] of testCases.entries()) {
        setStatus(`Pushing ${index + 1} / ${testCases.length}...`);

        const payload = {
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
        };

        try {
          const res = await fetch(`${apiBase}/push/jira/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await res.json();
          if (res.ok && result.external_url) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }

        // Optional delay to avoid hitting Jira API limits
        await new Promise((r) => setTimeout(r, 500));
      }

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
         Push the test cases shown in “Results” into Jira as <em>Test Case</em> work items.
      </p>

      <button
        onClick={pushAll}
        disabled={pushingAll || testCases.length === 0}
        className="mt-3 w-full rounded-xl px-3 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
      >
        {pushingAll ? "Pushing All..." : "Push All to Jira"}
      </button>

      {/* {result ? (
        <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 break-words">
          {result}
        </div>
      ) : null} */}
    </div>
  );
}
