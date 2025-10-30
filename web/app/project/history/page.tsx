export default function ProjectHistoryPage() {
  const projects = [
    { id: 1, name: "Login Test Automation", date: "2025-10-20" },
    { id: 2, name: "Payment Flow QA", date: "2025-10-25" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6">
        <h1 className="text-xl font-semibold mb-4">Previous Projects</h1>

        <div className="space-y-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="font-medium text-slate-900">{p.name}</div>
              <div className="text-sm text-slate-500">Created on {p.date}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
