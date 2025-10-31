"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/initFirebase";
import { useAuthState } from "react-firebase-hooks/auth";

export default function NewProjectPage() {
  const [projectName, setProjectName] = useState("");
  const [jiraProject, setJiraProject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [user] = useAuthState(auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("You must be logged in!");

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "projects"), {
        uid: user.uid,
        projectName: projectName,
        jiraProjectId: jiraProject,
        description,
        createdAt: Timestamp.now(),
      });

      const newProjectId = docRef.id;

      router.push(`/dashboard?projectName=${encodeURIComponent(projectName)}&description=${encodeURIComponent(description)}&projectid=${newProjectId}`);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow">
        <h1 className="text-xl font-semibold text-slate-900 mb-6">
          Create a New Project
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Jira Project ID
            </label>
            <input
              type="text"
              value={jiraProject}
              onChange={(e) => setJiraProject(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 text-white rounded-md py-2 text-sm font-medium hover:bg-emerald-700 transition"
          >
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
}
