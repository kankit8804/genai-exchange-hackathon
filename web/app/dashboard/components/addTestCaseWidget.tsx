"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

interface AddTestCaseModalProps {
    open: boolean;
    onClose: () => void;
    onSave?: (data: any) => void;
}

export default function AddTestCaseModal({
    open,
    onClose,
    onSave,
}: AddTestCaseModalProps) {
    const [title, setTitle] = useState("");
    const [severity, setSeverity] = useState("Low");
    const [expected_result, setExpectedResult] = useState("");
    const [steps, setSteps] = useState<string[]>([""]);

    if (!open) return null;

    const addStep = () => setSteps((prev) => [...prev, ""]);
    const removeStep = (index: number) =>
        setSteps((prev) => prev.filter((_, i) => i !== index));
    const updateStep = (index: number, value: string) =>
        setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));

    const handleSave = () => {
        const testCaseData = { title, severity, expected_result, steps }; 
        if (onSave) onSave(testCaseData);
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-8 relative animate-fadeIn scale-animate">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-slate-500 hover:text-slate-700 transition-colors"
                >
                    <X size={18} />
                </button>

                <h2 className="text-2xl font-semibold text-slate-900 mb-5">
                    Add New Test Case
                </h2>

                <div className="space-y-5 text-slate-800">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            placeholder="Enter test case title"
                        />
                    </div>

                    {/* Severity */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Severity
                        </label>
                        <div className="flex flex-wrap gap-3 mt-1">
                            {["Low", "Medium", "High", "Critical"].map((level) => {
                                const styles: Record<string, string> = {
                                    Low: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
                                    Medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
                                    High: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
                                    Critical: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
                                };
                                const isActive = severity === level;
                                return (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => setSeverity(level)}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200
            ${styles[level]} 
            ${isActive ? "ring-2 ring-offset-1 scale-105" : "opacity-80 hover:opacity-100 hover:scale-105"}
          `}
                                    >
                                        {level}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Steps */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-slate-700">
                                Steps
                            </label>
                            <button
                                onClick={addStep}
                                className="text-emerald-600 text-sm font-medium hover:underline flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Step
                            </button>
                        </div>
                        <div className="space-y-2">
                            {steps.map((step, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={step}
                                        onChange={(e) => updateStep(i, e.target.value)}
                                        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                        placeholder={`Step ${i + 1}`}
                                    />
                                    {steps.length > 1 && (
                                        <button
                                            onClick={() => removeStep(i)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Expected Result */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Expected Result
                        </label>
                        <textarea
                            value={expected_result}
                            onChange={(e) => setExpectedResult(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                            rows={3}
                            placeholder="Describe the expected result"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 flex flex-col items-center gap-4">
                    <div className="flex items-center text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-md shadow-sm">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 text-blue-500 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                            />
                        </svg>
                        <span>
                            <strong>Note:</strong> Manually created test cases will appear in the{" "}
                            <span className="text-emerald-600 font-medium">Generated</span> section.
                        </span>
                    </div>

                    <div className="flex justify-end gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Discard
                        </button>
                        <button
                            onClick={handleSave}
                            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
