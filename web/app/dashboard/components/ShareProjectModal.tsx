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

  const API = process.env.NEXT_PUBLIC_API_URL || "https://orbit-api-938180057345.us-central1.run.app";

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
      {/* --- Open Modal Button --- */}
      <button
        onClick={() => setShow(true)}
        className="rounded-md bg-emerald-600 px-4 py-2 text-white text-sm font-medium hover:bg-emerald-700 transition"
      >
        Share Project
      </button>

      {show && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white text-slate-800 p-6 rounded-2xl w-[420px] shadow-lg border border-slate-200">
            <h2 className="text-xl font-semibold mb-4 text-emerald-700">
              Share Project
            </h2>

            {/* --- Input Field + Add Button --- */}
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter user email"
                className="flex-1 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
              />
              <button
                onClick={handleAdd}
                disabled={loading}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition"
              >
                {loading ? "Adding..." : "Add"}
              </button>
            </div>

            {/* --- Members List --- */}
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
                        ? "text-emerald-600 font-medium"
                        : "text-green-600"
                    }`}
                  >
                    {m.role === "owner" ? "Owner" : "Member"}
                  </span>
                </li>
              ))}
            </ul>

            {/* --- Close Button --- */}
            <div className="text-right mt-6">
              <button
                className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-emerald-50 transition"
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
