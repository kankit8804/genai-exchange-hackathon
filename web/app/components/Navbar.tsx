"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User, Home, Folder, UserCircle, FlaskConical } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase/initFirebase";

export default function Navbar() {
  const [user] = useAuthState(auth);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();


  const logout = async () => {
    await auth.signOut();
    router.replace("/login");
  };
  

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (["/login", "/signup", "/forgot"].includes(pathname)) return null;

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Left section */}
          <div className="flex items-center gap-6">
            <Link href="/home" className="flex items-center gap-2">
              <div className="h-7 w-7 grid place-items-center rounded-md bg-emerald-600 text-white text-sm font-bold">
                O
              </div>
              <span className="font-semibold text-slate-900">Orbit AI</span>
            </Link>

            <div className="hidden md:flex items-center gap-4 ml-6">
              <Link
                href="/home"
                className="flex items-center gap-2 text-slate-700 hover:text-emerald-600 text-sm font-medium"
              >
                <Home size={16} /> Home
              </Link>
              <Link
                href="/project"
                className="flex items-center gap-2 text-slate-700 hover:text-emerald-600 text-sm font-medium"
              >
                <Folder size={16} /> Project
              </Link>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setOpen(!open)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 hover:bg-emerald-100 transition-all duration-200"
                >
                  <UserCircle size={20} className="text-slate-700" />
                </button>

                {/* Dropdown */}
                <div
                  className={`absolute right-0 mt-3 w-52 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-md shadow-xl transition-all duration-200 origin-top-right transform ${
                    open
                      ? "scale-100 opacity-100 translate-y-0"
                      : "scale-95 opacity-0 -translate-y-2 pointer-events-none"
                  }`}
                >
                  {/* Arrow */}
                  <div className="absolute -top-2 right-4 w-3 h-3 bg-white/90 border-l border-t border-slate-200 rotate-45"></div>

                  <div className="flex flex-col py-2 text-sm text-slate-700">
                    <button
                      onClick={() => {
                        router.push("/profile");
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 hover:bg-emerald-50 transition-colors duration-150"
                    >
                      <User size={16} className="text-emerald-600" /> My Profile
                    </button>

                    <button
                      onClick={() => {
                        router.push("/dashboard/view?fromDashboard=true");
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 hover:bg-emerald-50 transition-colors duration-150"
                    >
                      <FlaskConical size={16} className="text-emerald-600" /> My
                      Testcases
                    </button>

                    <div className="h-px bg-slate-100 my-1" />

                    <button
                      onClick={logout}
                      className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors duration-150"
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium hover:text-emerald-600"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-medium hover:text-emerald-600"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
