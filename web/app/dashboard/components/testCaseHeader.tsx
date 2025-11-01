import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

export default function TestcaseHeader({ projects, selectedProject, setSelectedProject }: any) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 relative">
            {/* Left side - title */}
            <h1 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
                <span className="inline-block w-1.5 h-6 bg-emerald-600 rounded-full" />
                All Test Cases
            </h1>

            {/* Custom dropdown */}
            {projects.length > 0 && (
                <div className="relative min-w-[220px]" ref={dropdownRef}>
                    <button
                        onClick={() => setOpen(!open)}
                        className="flex items-center justify-between w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all duration-150 shadow-sm hover:shadow-md"
                    >
                        <span>
                            {projects.find((p: any) => p.id === selectedProject)?.projectName ||
                                "Select Project"}
                        </span>
                        <ChevronDown
                            size={18}
                            className={`text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"
                                }`}
                        />
                    </button>

                    {/* Dropdown options */}
                    {open && (
                        <div className="absolute z-50 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1">
                            {projects.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedProject(p.id);
                                        setOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${selectedProject === p.id
                                            ? "bg-emerald-50 text-emerald-700 font-medium"
                                            : "text-slate-700 hover:bg-slate-50"
                                        }`}
                                >
                                    {p.projectName}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
