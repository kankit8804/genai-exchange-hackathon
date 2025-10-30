"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy  } from "firebase/firestore";
import { useAuth } from "@/lib/firebase/AuthContext";
import { db } from "@/lib/firebase/initFirebase";



interface Project {
  id: string;
  projectName: string;
  description: string;
  jiraProject?: string;
  createdAt?: string;
}

export default function ProjectPage() {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);


useEffect(() => {
  if (!user) {
    console.log("No user, skipping fetch");
    return;
  }

  console.log("Fetching projects for user:", user.uid);

  const fetchProjects = async () => {
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
            : "N/A", // ✅ convert to human-readable string
        };
      });

      setProjects(data);

    } catch (err) {
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchProjects();
}, [user]);
  
  const remaining = projects;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col items-center justify-center py-10 px-4">
      <div className="w-full max-h-2xl max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-600 mb-8">Get Started</h1>
        {/* --- Start New Project Card --- */}
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/project/createnew")}
          className="mt-5 cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow hover:shadow-lg transition-all"
        >
          <h2 className="text-lg font-semibold text-emerald-700">
            Start a New Project
          </h2>
          <p className="mt-2 text-slate-600 text-sm">
            Begin a new test generation session by entering basic project details.
          </p>
          <div className="mt-4 text-emerald-600 font-medium text-right">→ Get Started</div>
        </motion.div>

        {/* --- Previous Projects Card --- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow transition-all">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-emerald-700">
              Previous Projects
            </h2>
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="text-sm text-slate-500 hover:text-indigo-600"
            >
              {showAll ? "▲ Hide" : "▼ Show More"}
            </button>
          </div>

          {/* Latest Project */}
          {/* <div
            onClick={() => router.push(`/dashboard?projectId=${projects[0].id}&projectName=${encodeURIComponent(projects[0].projectName)}&description=${encodeURIComponent(projects[0].description)}`)}
            className="cursor-pointer p-4 rounded-lg border border-slate-100 hover:bg-slate-50 transition flex justify-between items-center mt-4"
          >
            <div>
              <div className="font-medium text-slate-900">{latest.projectName}</div>
              <div className="text-xs text-slate-500">
                Description: {latest.description}
              </div>
              <div>
                Created At: {latest.createdAt}
              </div>
            </div>
            <div className="text-emerald-600 text-sm font-medium">→ Open</div>
          </div> */}

          {/* Expandable Section */}
          <AnimatePresence>
            {showAll && remaining.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 space-y-3 border-t border-slate-200 pt-3"
              >
                {remaining.map((p) => (
                  <motion.div
                    key={p.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => router.push(`/dashboard?projectId=${p.id}&projectName=${encodeURIComponent(p.projectName)}&description=${encodeURIComponent(p.description)}`)}
                    className="cursor-pointer p-4 rounded-lg border border-slate-100 hover:bg-slate-50 transition flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{p.projectName}</div>
                      <div className="text-xs text-slate-700">
                         Description: {p.description}
                      </div>
                      <div className="text-xs text-slate-500">
                         Created At: {p.createdAt}
                      </div>
                    </div>
                    <div className="text-emerald-600 text-sm font-medium">
                      → Open
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {projects.length === 0 && (
            <div className="text-slate-500 text-sm italic text-center py-4">
              No previous projects found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
