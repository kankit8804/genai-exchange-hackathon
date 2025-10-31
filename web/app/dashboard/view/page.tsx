"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, ResultItem, EmptyState } from "@/app/dashboard/components/ui";

interface TestCase {
    req_id: string;
    test_id: string;
    title: string;
    severity: string;
    expected_result: string;
    steps: string[];
    isPushed?: boolean;
}

const API_BASE = "https://orbit-api-938180057345.us-central1.run.app";

// POST helper
const post = async <T,>(url: string, payload?: object): Promise<T> => {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
};

export default function ViewAllPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const encoded = searchParams.get("data");

    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [activeTab, setActiveTab] = useState<"generated" | "pushed">("generated");
    const [searchText, setSearchText] = useState("");

    useEffect(() => {
        if (encoded) {
            try {
                const decoded = JSON.parse(decodeURIComponent(encoded));
                setTestCases(decoded);
            } catch (e) {
                console.error("Failed to decode testcases", e);
            }
        }
    }, [encoded]);

    const filteredCases = useMemo(() => {
        const base =
            activeTab === "pushed" ? testCases.filter((t) => t.isPushed) : testCases;
        if (!searchText.trim()) return base;

        const q = searchText.toLowerCase();
        return base.filter(
            (t) =>
                t.title.toLowerCase().includes(q) ||
                t.test_id.toLowerCase().includes(q) ||
                t.expected_result.toLowerCase().includes(q)
        );
    }, [testCases, activeTab, searchText]);

    const hasResults = filteredCases.length > 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8 flex flex-col text-slate-800">

            {/* Header */}
            <div className="flex justify-between items-center mb-6 gap-4">
                {/* Title */}
                <h1 className="text-2xl font-semibold text-slate-800">
                    {"All Test Cases"}
                </h1>

                {/* Search bar (center-right aligned) */}
                <div className="flex items-center gap-2 flex-1 max-w-md ml-auto">
                    <input
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search test cases..."
                        className="flex-1 rounded-md border border-black/30 bg-white px-3 py-2 text-sm text-black placeholder-slate-400 focus:outline-none focus:border-black focus:ring-0"
                    />
                    {searchText && (
                        <button
                            onClick={() => setSearchText("")}
                            className="text-sm font-medium text-black hover:text-gray-600 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>



                {/* Back button */}
                <button
                    onClick={() => router.back()}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 ml-4"
                >
                    ← Back
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b border-slate-200">
                {["generated", "pushed"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as "generated" | "pushed")}
                        className={`pb-2 text-sm font-medium transition ${activeTab === tab
                            ? "text-emerald-700 border-b-2 border-emerald-600"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        {tab === "generated" ? "Generated Test Cases" : "Pushed Test Cases"}
                    </button>
                ))}
            </div>

            {/* Content area fills remaining height */}
            <div className="flex-1 flex flex-col">
                <Card className="flex-1 flex flex-col">
                    {/* <CardHeader title="All Test Cases" /> */}
                    <div
                        className={`flex-1 ${hasResults ? "mt-4 overflow-y-auto pr-1" : "mt-2"
                            }`}
                    >
                        {hasResults ? (
                            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {filteredCases.map((tc) => (
                                    <li key={tc.test_id}>
                                        <ResultItem tc={tc} post={post} apiBase={API_BASE} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState />
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
