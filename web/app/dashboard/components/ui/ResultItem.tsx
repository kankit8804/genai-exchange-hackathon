"use client";

import { useState } from "react";
import { SeverityBadge } from "./SeverityBadge";
import { Pencil, Check, X } from "lucide-react";
import { auth, db } from "@/lib/firebase/initFirebase";
import { doc, getDoc } from "firebase/firestore";
import { useNotificationStore } from "@/app/store/notificationStore";
import { pushToAzure } from "@/lib/utils/alm";

interface TestCase {
  req_id: string;
  test_id: string;
  title: string;
  severity: string;
  expected_result: string;
  steps: string[];
  trace_link?: string;
  createdAt?: string | number | Date;
}

interface JiraResponse {
  external_url: string;
  external_key?: string;
  detail?: string;
}

interface Props {
  tc: TestCase;
  post: <T, >(url: string, payload?: object) => Promise<T>;
  apiBase: string;
  jira_project_key?: string | null;
  integration_Type?: string | null;
  onUpdated?: () => void;
}

export function ResultItem({ tc, post, apiBase, jira_project_key, onUpdated, integration_Type }: Props) {
  const [open, setOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [jiraLink, setJiraLink] = useState<string>("");
  const { showNotification } = useNotificationStore();
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<TestCase>(tc);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const user = auth.currentUser;

  const handleChange = (field: keyof TestCase, value: string | string[]) => {
    setEdited((prev) => ({ ...prev, [field]: value }));
    setChanged(true);
  };

 interface UpdateResponse {
  ok: boolean;
  test_id?: string;
  error?: string;
}

const handleSaveEdit = async () => {
  try {
    setSaving(true);
    const payload = {
      ...edited,
      user_id: user?.uid,
    };

    const result = await post<UpdateResponse>(`${apiBase}/manual/testcase/update`, payload);

    console.log("Update result:", result);

    if (result.ok) {
      setEditing(false);
      setChanged(false);
      
      showNotification("Testcase updated.");
      onUpdated?.();
    } else {
      showNotification(result.error || "Failed to update the testcase.", true);
    }
  } catch (err) {
    console.error(err);
    showNotification("Failed to update the testcase.", true);
  } finally {
    setSaving(false);
  }
};



  const pushToJira = async (): Promise<void> => {
    try {
      if (!user) {
        alert("You must be logged in!");
        return;
      }

      setPushing(true);

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
        jira_project_key,
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

      const result: JiraResponse = await res.json();

      if (res.ok && result.external_url) {
        setJiraLink(result.external_url);
        alert(`Jira issue created: ${result.external_key}\n${result.external_url}`);
      } else {
        console.error(result);
        alert(`Failed to create issue: ${result.detail || "Unknown error"}`);
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Error pushing to Jira");
    } finally {
      setPushing(false);
    }
  };

  const formattedDate = tc.createdAt
    ? new Date(tc.createdAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : null;

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 relative">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {editing ? (
            <input
              value={edited.title}
              onChange={(e) => handleChange("title", e.target.value)}
              className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"

            />
          ) : (
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{tc.title}</h4>
              <SeverityBadge level={tc.severity} />
            </div>
          )}

          <div className="mt-1 text-[12px] text-slate-500">
            Test: {tc.test_id} • REQ: {tc.req_id}
          </div>
          {formattedDate && (
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Created: {formattedDate}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
        {integration_Type === "Jira" && jira_project_key ? (
          <div className="flex items-center gap-2">
            <button
              onClick={pushToJira}
              disabled={pushing}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
            >
              {pushing ? "Pushing…" : "Push to Jira"}
            </button>

            {jiraLink && (
              <a
                href={jiraLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:underline"
              >
                View Issue ↗
              </a>
            )}
          </div>
        ) : null}

        {integration_Type === "Azure" && jira_project_key ? (
          <div className="flex items-center gap-2">
            <button
             // onClick={}
              disabled={pushing}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
            >
              {pushing ? "Pushing…" : "Push to Azure"}
            </button>

            {jiraLink && (
              <a
                href={jiraLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-700 hover:underline"
              >
                View Issue ↗
              </a>
            )}
          </div>
        ) : null}


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

          {/* Editable section */}
          <div className="text-xs text-slate-700 space-y-3">
            <div>
              <div className="font-semibold text-slate-800 mb-1">Steps</div>
              <ol className="list-decimal pl-5 space-y-1.5">
                {(editing ? edited.steps : tc.steps).map((s, i) =>
                  editing ? (
                    <input
                      key={i}
                      value={s}
                      onChange={(e) => {
                        const newSteps = [...edited.steps];
                        newSteps[i] = e.target.value;
                        handleChange("steps", newSteps);
                      }}
                      className="w-full border border-slate-200 rounded-md px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                      style={{ lineHeight: "1.2rem" }}
                    />
                  ) : (
                    <li key={i} className="text-[14px] leading-[1.3rem]">{s}</li>
                  )
                )}
              </ol>
            </div>


            <div>
              <div className="font-semibold text-slate-800 mb-1">Expected Result</div>
              {editing ? (
                <textarea
                  value={edited.expected_result}
                  onChange={(e) => handleChange("expected_result", e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"

                />
              ) : (
                <div className="text-slate-700">{tc.expected_result}</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Save / Cancel buttons */}
      {editing && (
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-slate-700 transition-colors flex items-center gap-1 shadow-sm"
          >
            <X size={14} /> Cancel
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : (<><Check size={14} /> Save</>)}
          </button>
        </div>
      )}

      {/* Bottom-right edit button (only when not editing) */}
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          title="Edit test case"
          className="absolute bottom-3 right-3 px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1 shadow-sm"
        >
          <Pencil size={14} /> 
        </button>
      )}

    </li>
  );
}
