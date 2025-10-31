"use client";

import React from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_24px_rgba(10,20,40,0.06)] " +
        className
      }
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    </div>
  );
}
