"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    type DroppableProvided,
    type DraggableProvided,
} from "@hello-pangea/dnd";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/firebase/AuthContext";
import { db } from "@/lib/firebase/initFirebase";
import { useNotificationStore } from "@/app/store/notificationStore";
import { Card, ResultItem, EmptyState } from "@/app/dashboard/components/ui";
import { fetchTestCasesByProject, useTestStore } from "@/app/store/testCaseStore";

interface TestCase {
    req_id: string;
    test_id: string;
    title: string;
    severity: string;
    expected_result: string;
    steps: string[];
    isPushed?: boolean;
    isRemoved?: boolean;
}

interface Project {
    id: string;
    projectName: string;
    description: string;
    jiraProject?: string;
    createdAt: string;
}

const API_BASE = "http://127.0.0.1:8000";

const post = async <T,>(url: string, payload?: object): Promise<T> => {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
};

const severityOrder = ["critical", "high", "medium", "low"];

export default function ViewAllPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isFromDashboard = searchParams.get("fromDashboard") === "true";
    const { user } = useAuth();
    const { testCases, setTestCases } = useTestStore();
    const [searchText, setSearchText] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [loadingStoredCases, setLoadingStoredCases] = useState(false);
    const { showNotification } = useNotificationStore();


    const fetchProjects = async () => {
        if (!user?.uid) return;

        try {
            const projectsRef = collection(db, "projects");
            const q = query(
                projectsRef,
                where("uid", "==", user.uid),
                orderBy("createdAt", "desc")
            );

            const snapshot = await getDocs(q);
            const data: Project[] = snapshot.docs.map((doc) => {
                const project = doc.data() as any;
                return {
                    id: doc.id,
                    projectName: project.projectName,
                    description: project.description,
                    jiraProject: project.jiraProject,
                    createdAt: project.createdAt
                        ? new Date(project.createdAt.seconds * 1000).toLocaleString()
                        : "N/A",
                };
            });

            setProjects(data);


            if (data.length > 0 && !selectedProject && !isFromDashboard) {
                setSelectedProject(data[0].id);
            }
        } catch (err) {
            console.error("Error fetching projects:", err);
        }
    };


    const fetchData = async (projectId: string) => {
        try {

            const currentProjectId = testCases[0]?.project_id;
            if (currentProjectId && currentProjectId === projectId) {
                console.log("Skipping fetch — same project selected:", projectId);
                return;
            }

            setTestCases([]);
            setLoadingStoredCases(true);

            const existing: any = await fetchTestCasesByProject(projectId);


            const list = Array.isArray(existing)
                ? existing
                : Array.isArray(existing?.test_cases)
                    ? existing.test_cases
                    : [];
            if (list.length > 0) {
                showNotification(`Loaded ${list.length} previously generated test case${list.length > 1 ? "s" : ""}.`);
            }

            setTestCases(list);
        } catch (err) {
            console.error("❌ Failed to fetch existing test cases:", err);
        } finally {
            setLoadingStoredCases(false);
        }
    };


    useEffect(() => {
        if (user?.uid) fetchProjects();
    }, [user]);


    useEffect(() => {
        if (isFromDashboard && testCases.length > 0) {
            const firstProjectId = testCases[0]?.project_id;
            if (firstProjectId && selectedProject !== firstProjectId) {
                setSelectedProject(firstProjectId);
            }
        }
    }, [testCases, isFromDashboard]);


    useEffect(() => {
        if (selectedProject) {
            fetchData(selectedProject);
        }
    }, [selectedProject]);

    const handleDragEnd = (result: any) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId) return;

        const updated = testCases.map((tc) => {
            if (tc.test_id !== draggableId) return tc;

            if (destination.droppableId === "pushed") {
                return { ...tc, isPushed: true, isRemoved: false };
            } else if (destination.droppableId === "removed") {
                return { ...tc, isRemoved: true, isPushed: false };
            } else if (destination.droppableId === "generated") {
                return { ...tc, isRemoved: false, isPushed: false };
            }
            return tc;
        });

        setTestCases(updated);
    };

    const renderColumn = (
        title: string,
        droppableId: string,
        cases: TestCase[],
        showAdd?: boolean
    ) => (
        <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span
                    className={`${title === "Generated"
                            ? "text-emerald-600"
                            : title === "Pushed"
                                ? "text-blue-600"
                                : title === "Removed"
                                    ? "text-red-600"
                                    : "text-slate-700"
                        }`}
                >
                    {title}
                </span>
                {cases.length > 0 && (
                    <span className="text-sm font-medium text-slate-500">
                        ({cases.length})
                    </span>
                )}
            </h2>


            <Droppable droppableId={droppableId}>
                {(provided: DroppableProvided) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 min-h-[200px] space-y-3 overflow-y-auto"
                    >
                        {cases.length ? (
                            cases.map((tc, index) => (
                                <Draggable key={tc.test_id} draggableId={tc.test_id} index={index}>
                                    {(dragProvided: DraggableProvided, snapshot) => (
                                        <div
                                            ref={dragProvided.innerRef}
                                            {...dragProvided.draggableProps}
                                            {...dragProvided.dragHandleProps}
                                            style={{
                                                ...dragProvided.draggableProps.style,
                                                zIndex: snapshot.isDragging ? 9999 : "auto",
                                                transform: snapshot.isDragging
                                                    ? `${dragProvided.draggableProps.style?.transform} translateY(-10px)`
                                                    : dragProvided.draggableProps.style?.transform,
                                            }}
                                            className={`transition-all duration-150 ${snapshot.isDragging
                                                    ? "scale-[1.02] shadow-2xl cursor-grabbing"
                                                    : "cursor-grab"
                                                }`}
                                        >
                                            <div className={snapshot.isDragging ? "bg-white rounded-md" : ""}>
                                                <ResultItem
                                                    key={tc.test_id}
                                                    tc={tc}
                                                    post={post}
                                                    apiBase={API_BASE}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </Draggable>
                            ))
                        ) : (
                            <EmptyState />
                        )}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>

            {showAdd && (
                <button
                    onClick={() => console.log("Add Test Case clicked")}
                    className="mt-4 w-full rounded-md bg-emerald-600 text-white text-sm font-medium py-2 hover:bg-emerald-700 transition-colors"
                >
                    + Add Test Case
                </button>
            )}
        </div>
    );

    // --- FILTER AND SORT ---
    const { generated, pushed, removed } = useMemo(() => {
        const q = searchText.toLowerCase();
        const match = (t: TestCase) =>
            !searchText ||
            t.title.toLowerCase().includes(q) ||
            t.test_id.toLowerCase().includes(q) ||
            t.expected_result.toLowerCase().includes(q);

        const sortBySeverity = (a: TestCase, b: TestCase) => {
            const i1 = severityOrder.indexOf(a.severity.toLowerCase());
            const i2 = severityOrder.indexOf(b.severity.toLowerCase());
            return i1 - i2;
        };

        return {
            generated: testCases.filter((t) => !t.isPushed && !t.isRemoved && match(t)).sort(sortBySeverity),
            pushed: testCases.filter((t) => t.isPushed && !t.isRemoved && match(t)).sort(sortBySeverity),
            removed: testCases.filter((t) => t.isRemoved && match(t)).sort(sortBySeverity),
        };
    }, [testCases, searchText]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8 text-slate-800 flex flex-col">
            <div className="w-full max-w-7xl mx-auto flex flex-col flex-1">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-semibold">All Test Cases</h1>
                        {projects.length > 0 && (
                            <select
                                value={selectedProject ?? ""}
                                onChange={(e) => setSelectedProject(e.target.value)}
                                className="rounded-md border border-gray-300 bg-white text-sm px-3 py-2 focus:outline-none"
                            >
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.projectName}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-md ml-auto">
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Search test cases..."
                            className="flex-1 rounded-md border border-black/30 bg-white px-3 py-2 text-sm text-black placeholder-slate-400 focus:outline-none focus:border-black"
                        />
                        {searchText && (
                            <button
                                onClick={() => setSearchText("")}
                                className="text-sm font-medium text-black hover:text-gray-600"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => router.back()}
                        className="ml-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                        ← Back
                    </button>
                </div>

                {/* Main Card */}
                <Card className="flex-1 flex flex-col bg-white/80 shadow-lg rounded-2xl p-6 relative">
                    {loadingStoredCases ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 rounded-2xl z-50">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-300 border-t-emerald-700"></div>
                            <p className="mt-3 text-sm font-medium text-emerald-700">Fetching stored test cases...</p>
                        </div>
                    ) : (
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 relative z-0">
                                {renderColumn("Generated", "generated", generated, true)}
                                {renderColumn("Pushed", "pushed", pushed)}
                                {renderColumn("Removed", "removed", removed)}
                            </div>
                        </DragDropContext>
                    )}
                </Card>
            </div>
        </div>
    );
}
