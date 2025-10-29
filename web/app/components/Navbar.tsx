"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User, Home, Folder } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase/initFirebase";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [user, loading] = useAuthState(auth);
  const pathname = usePathname();
  const router = useRouter();

  if (!user || ["/login", "/signup"].includes(pathname)) {
    return null; // don't render navbar
  }

  const logout = async () => {
    await auth.signOut();
    router.replace("/login");
  };

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/home" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-emerald-600 text-white grid place-items-center text-sm font-bold">
                O
              </div>
              <span className="font-semibold text-slate-900">Orbit AI</span>
            </Link>

            <div className="hidden md:flex items-center gap-4 ml-6">
              <Link href="/home" className="flex items-center gap-2 text-slate-700 hover:text-emerald-600 text-sm font-medium">
                <Home size={16} /> Home
              </Link>
              <Link href="/dashboard" className="flex items-center gap-2 text-slate-700 hover:text-emerald-600 text-sm font-medium">
                <Folder size={16} /> Project
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/profile" className="flex items-center gap-2 text-slate-700 hover:text-emerald-600 text-sm font-medium">
              <User size={16} /> Profile
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
