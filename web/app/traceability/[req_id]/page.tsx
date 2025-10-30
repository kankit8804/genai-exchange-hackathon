"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Test {
  id: string;
  title: string;
  severity: string;
}

interface TraceData {
  req_id: string;
  title: string;
  text: string;
  related_tests: Test[];
  fetched_at: string;
}

export default function TraceabilityPage() {
  const { req_id } = useParams();
  const [data, setData] = useState<TraceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!req_id) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/traceability/${req_id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then(setData)
      .catch((err) => setError(String(err)));
  }, [req_id]);

  if (error) {
  return (
    <div className="p-6 text-red-600">
      <h2>Error loading traceability data</h2>
      <p>{error}</p>
    </div>
  );
}

if (!data) {
  return (
    <div className="p-6">
      <p>Loading traceability info for {req_id}...</p>
    </div>
  );
}

// ✅ Render only when data is ready
return (
  <div className="max-w-5xl mx-auto p-8">
    <h1 className="text-3xl font-bold mb-5 text-gray-800">
      {data?.title || "Untitled Requirement"}
    </h1>

    {/* Requirement text section */}
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-700 mb-3">
        Requirement Details
      </h2>
      <p className="text-gray-800 whitespace-pre-line leading-relaxed">
        {data?.text || "No content available for this requirement."}
      </p>
    </div>

    {/* Linked test cases */}
    <h2 className="text-2xl font-semibold mb-4 text-gray-800">
      Linked Test Cases
    </h2>

    {data?.related_tests && data.related_tests.length > 0 ? (
      <ul className="space-y-4">
        {data.related_tests.map((t) => (
          <li
            key={t.id}
            className="border border-gray-200 bg-gray-50 rounded-xl p-4 shadow-sm hover:shadow-md transition"
          >
            <p className="font-semibold text-gray-900">{t.id}</p>
            <p className="text-gray-700">{t.title}</p>
            <p className="text-sm text-gray-500 mt-1">
              Severity:{" "}
              <span
                className={`font-medium ${
                  t.severity === "Critical"
                    ? "text-red-600"
                    : t.severity === "High"
                    ? "text-orange-600"
                    : "text-green-700"
                }`}
              >
                {t.severity}
              </span>
            </p>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-gray-600">No linked test cases found.</p>
    )}

    {/* Back button */}
    <div className="mt-10">
      <a
        href="/dashboard"
        className="inline-block text-blue-600 hover:text-blue-800 font-medium"
      >
        ← Back to Dashboard
      </a>
    </div>
  </div>
);
}