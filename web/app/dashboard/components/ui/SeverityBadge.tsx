"use client";

export function SeverityBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    Critical: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    High: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    Medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    Low: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  };
  const cls = map[level] ?? "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{level || "Unknown"}</span>;
}
