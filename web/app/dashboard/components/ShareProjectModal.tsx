"use client";
import { useState, useEffect } from "react";

export default function ShareProjectModal({
  projectId,
}: {
  projectId: string;
}) {
  const [email, setEmail] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const fetchMembers = async () => {
    const res = await fetch(`${API}/projects/${projectId}/members`);
    const data = await res.json();
    if (data.ok) setMembers(data.members);
  };

  const handleAdd = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/projects/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.detail || "Error adding user");
      await fetchMembers();
      setEmail("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) fetchMembers();
  }, [show]);

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-700 transition"
      >
        Share Project
      </button>

      {show && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white text-slate-800 p-6 rounded-2xl w-[420px] shadow-lg border border-slate-200">
            <h2 className="text-xl font-semibold mb-4 text-indigo-700">
              Share Project
            </h2>

            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter user email"
                className="flex-1 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
              />
              <button
                onClick={handleAdd}
                disabled={loading}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition"
              >
                {loading ? "Adding..." : "Add"}
              </button>
            </div>

            <ul className="space-y-2 max-h-[220px] overflow-auto text-sm">
              {members.map((m) => (
                <li
                  key={m.email}
                  className="flex justify-between items-center border-b border-slate-100 py-1"
                >
                  <span className="font-medium text-slate-700">{m.email}</span>
                  <span
                    className={`text-xs ${
                      m.role === "owner"
                        ? "text-emerald-600"
                        : "text-indigo-600"
                    }`}
                  >
                    {m.role === "owner" ? "Owner" : "Member"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="text-right mt-6">
              <button
                className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-100 transition"
                onClick={() => setShow(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
