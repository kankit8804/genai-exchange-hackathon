"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { useAuth } from "@/lib/firebase/AuthContext";
import { db } from "@/lib/firebase/initFirebase";

interface Project {
  id: string;
  projectName: string;
  description: string;
  jiraProject?: string;
  createdAt?: string;
  role?: string;
}

export default function ProjectPage() {
  const router = useRouter();
  const [showAllOwned, setShowAllOwned] = useState(false);
  const [showAllShared, setShowAllShared] = useState(false);
  const { user } = useAuth();
  const [ownedProjects, setOwnedProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔹 Fetch projects owned or shared with current user
  const fetchProjectsForUser = async (user: any) => {
    const userEmail = user.email;
    const projectsRef = collection(db, "projects");

    // 1️⃣ Fetch owned projects
    const ownedQuery = query(
      projectsRef,
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const ownedSnapshot = await getDocs(ownedQuery);
    const owned = ownedSnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      role: "Owner",
    }));

    // 2️⃣ Fetch shared projects
    const shared: any[] = [];
    const allProjectsSnapshot = await getDocs(projectsRef);
    for (const projectDoc of allProjectsSnapshot.docs) {
      const membersRef = collection(projectDoc.ref, "members");
      const membersSnapshot = await getDocs(membersRef);
      const isMember = membersSnapshot.docs.some(
        (m) => m.data().email === userEmail
      );
      if (isMember) {
        shared.push({
          id: projectDoc.id,
          ...projectDoc.data(),
          role: "Collaborator",
        });
      }
    }

    return { owned, shared };
  };

  useEffect(() => {
    if (!user) return;

    const loadProjects = async () => {
      setLoading(true);
      try {
        const { owned, shared } = await fetchProjectsForUser(user);

        const formatProjects = (projects: any[], role: string) =>
          projects.map((project: any) => ({
            id: project.id,
            projectName: project.projectName,
            description: project.description,
            jiraProject: project.jiraProject,
            createdAt: project.createdAt
              ? new Date(project.createdAt.seconds * 1000).toLocaleString()
              : "N/A",
            role,
          }));

        setOwnedProjects(formatProjects(owned, "Owner"));
        setSharedProjects(formatProjects(shared, "Collaborator"));
      } catch (err) {
        console.error("Error loading projects:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [user]);

  const ProjectCardList = ({
    title,
    projects,
    showAll,
    setShowAll,
  }: {
    title: string;
    projects: Project[];
    showAll: boolean;
    setShowAll: (value: boolean) => void;
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-indigo-700">{title}</h2>
        {projects.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-slate-500 hover:text-indigo-600 transition"
          >
            {showAll ? "▲ Hide" : "▼ Show More"}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAll && projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 space-y-3 border-t border-slate-100 pt-3"
          >
            {projects.map((p) => (
              <motion.div
                key={p.id}
                whileHover={{ scale: 1.01 }}
                onClick={() =>
                  router.push(
                    `/dashboard?projectId=${
                      p.id
                    }&projectName=${encodeURIComponent(
                      p.projectName
                    )}&description=${encodeURIComponent(
                      p.description
                    )}&jiraProjectKey=${encodeURIComponent(
                      p.jiraProject || "KAN"
                    )}`
                  )
                }
                className="cursor-pointer p-4 rounded-xl border border-slate-100 hover:bg-indigo-50 transition flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-slate-800">
                    {p.projectName}
                  </div>
                  <div className="text-xs text-slate-600">
                    Description: {p.description}
                  </div>
                  <div className="text-xs text-slate-500">
                    Created At: {p.createdAt}
                  </div>
                  <div
                    className={`text-xs mt-1 italic ${
                      p.role === "Owner"
                        ? "text-emerald-600"
                        : "text-indigo-600"
                    }`}
                  >
                    {p.role}
                  </div>
                </div>
                <div className="text-indigo-600 text-sm font-medium">
                  → Open
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && projects.length === 0 && (
        <div className="text-slate-500 text-sm italic text-center py-4">
          No {title.toLowerCase()} found.
        </div>
      )}

      {loading && (
        <div className="text-slate-400 text-sm italic text-center py-4">
          Loading...
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-100 flex flex-col items-center justify-center py-10 px-4 text-slate-800">
      <div className="w-full max-h-2xl max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">
          Welcome Back 👋
        </h1>

        {/* --- Start New Project Card --- */}
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/project/createnew")}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-md hover:shadow-xl transition-all"
        >
          <h2 className="text-lg font-semibold text-indigo-700">
            Start a New Project
          </h2>
          <p className="mt-2 text-slate-600 text-sm">
            Begin a new test generation session by entering your project
            details.
          </p>
          <div className="mt-4 text-indigo-600 font-medium text-right">
            → Get Started
          </div>
        </motion.div>

        {/* --- Owned Projects Card --- */}
        <ProjectCardList
          title="Your Projects"
          projects={ownedProjects}
          showAll={showAllOwned}
          setShowAll={setShowAllOwned}
        />

        {/* --- Shared Projects Card --- */}
        <ProjectCardList
          title="Shared Projects"
          projects={sharedProjects}
          showAll={showAllShared}
          setShowAll={setShowAllShared}
        />
      </div>
    </div>
  );
}
