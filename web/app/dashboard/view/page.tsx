"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, Suspense } from "react";
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
import TestcaseHeader from "../components/testCaseHeader";
import AddTestCaseModal from "../components/addTestCaseWidget";

interface TestCase {
    req_id: string;
    test_id: string;
    title: string;
    severity: string;
    expected_result: string;
    steps: string[];
    isPushed?: boolean;
    isRemoved?: boolean;
    createdAt?: string | number | Date;
}

interface Project {
    id: string;
    projectName: string;
    description: string;
    jiraProjectId ?: string;
    createdAt: string;
    integrationType: string;
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

function ViewAllPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isFromDashboard = searchParams.get("fromDashboard") === "true";
    const { user } = useAuth();
    const { testCases, setTestCases } = useTestStore();
    const [searchText, setSearchText] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [intergationType, setIntergationType] = useState<string | null>(null);
    const [loadingStoredCases, setLoadingStoredCases] = useState(false);
    const { showNotification } = useNotificationStore();
    const [showModal, setShowModal] = useState(false);
    const [addingStatus, setAddingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [jiraProjectKey, setJiraProjectKey] = useState<string | null>(null);


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
                                 console.log("Rendering project.jiraProjectId :",project.jiraProjectId );
                                            console.log("projectName :",project.projectName);
                return {
                    id: doc.id,
                    projectName: project.projectName,
                    description: project.description,
                    jiraProjectId : project.jiraProjectId ,
                    integrationType: project.integrationType,
                    createdAt: project.createdAt
                        ? new Date(project.createdAt.seconds * 1000).toLocaleString()
                        : "N/A",
                };

            });

            setProjects(data);


            if (data.length > 0 && !selectedProject && !isFromDashboard) {
                setSelectedProject(data[0].id);
                setIntergationType(data[0].integrationType);
            }
        } catch (err) {
            console.error("Error fetching projects:", err);
        }
    };


    const fetchData = async (projectId: string, skipCheck: boolean = false) => {
        try {
            const currentProjectId = testCases[0]?.project_id;

            if (!skipCheck && currentProjectId && currentProjectId === projectId) {
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
                showNotification(
                    `Loaded ${list.length} previously generated test case${list.length > 1 ? "s" : ""}.`
                );
            }

            setTestCases(list);
        } catch (err) {
            console.error("Failed to fetch existing test cases:", err);
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

    useEffect(() => {
         console.log("Rendering integration_Type:",intergationType);
                                            console.log("Rendering jira_project_key:",jiraProjectKey);
        if (selectedProject && projects.length > 0) {
            const project = projects.find((p) => p.id === selectedProject);
            if (project) {
                setIntergationType(prev => prev || project.integrationType || null);
                setJiraProjectKey(prev => prev || project.jiraProjectId  || null);
            }
        }
    }, [selectedProject, projects]);


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

    const handleSaveTestCase = async (data: any) => {
        if (!selectedProject) {
            showNotification("Please select a project before adding a test case.", true);
            return;
        }

        try {
            setAddingStatus("loading");
            const payload = { ...data, project_id: selectedProject };
            const response = await post<{ test_id: string, req_id: string, createdAt: string }>(`${API_BASE}/manual/testcase`, payload);

            if (response?.test_id) {
                showNotification(`Test ID: ${response.test_id} created successfully!`);
                setTestCases((prev) => [
                    ...prev,
                    {
                        ...data,
                        test_id: response.test_id,
                        req_id: response.req_id,
                        project_id: selectedProject,
                        isPushed: false,
                        isRemoved: false,
                        createdAt: response.createdAt,
                    },
                ]);
                setAddingStatus("success");
            } else {
                showNotification("Unexpected response from server. Please try again.", true);
                setAddingStatus("error");
            }
        } catch (err: any) {
            console.error(err);
            showNotification("Failed to create test case. Please check your data and try again.", true);
            setAddingStatus("error");
        } finally {

            setTimeout(() => setAddingStatus("idle"), 2000);
        }
    };


    const renderColumn = (
        title: string,
        droppableId: string,
        cases: TestCase[],
        showAdd?: boolean
    ) => (
        <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center justify-between">
                {/* Left side: title + count */}
                <div className="flex items-center gap-2">
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
                </div>

                {/* Right-aligned plus icon (only for Generated) */}
                {title === "Generated" && (
                    <button
                        onClick={() => setShowModal(true)}
                        title="Add Test Case"
                        className="
        mr-[5px]
        flex items-center justify-center
        w-7 h-7
        rounded-md
        bg-emerald-100/70
        hover:bg-emerald-200
        transition-colors
        shadow-sm
      "
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 text-emerald-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
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
                                                    onUpdated={() => {
                                                        if (selectedProject) fetchData(selectedProject, true);
                                                    }}
                                                    jira_project_key={jiraProjectKey}
                                                    integration_Type={intergationType}
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
                <>
                    <button
                        onClick={() => setShowModal(true)}
                        className="mt-4 w-full rounded-md bg-emerald-600 text-white text-sm font-medium py-2 hover:bg-emerald-700 transition-colors"
                    >
                        + Add Test Case
                    </button>

                    <AddTestCaseModal
                        open={showModal}
                        onClose={() => setShowModal(false)}
                        onSave={handleSaveTestCase}
                    />
                </>
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
                    <TestcaseHeader
                        projects={projects}
                        selectedProject={selectedProject}
                        setSelectedProject={setSelectedProject}
                    />

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
            {addingStatus !== "idle" && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white shadow-xl border border-emerald-200 rounded-lg px-4 py-3">
                    {addingStatus === "loading" && (
                        <>
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-emerald-700"></div>
                            <p className="text-sm font-medium text-emerald-700">Adding test case...</p>
                        </>
                    )}

                    {addingStatus === "success" && (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-sm font-medium text-green-700">Test case added successfully!</p>
                        </>
                    )}

                    {addingStatus === "error" && (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <p className="text-sm font-medium text-red-700">Failed to add test case</p>
                        </>
                    )}
                </div>
            )}

        </div>
    );
}

export default function ViewAllPage() {
    return (
        <Suspense fallback={<div>Loading…</div>}>
            <ViewAllPageInner />
        </Suspense>
    );
}
