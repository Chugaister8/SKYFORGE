"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";
import { Topbar }  from "./Topbar";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuth) router.replace("/login");
  }, [isAuth, router]);

  if (!isAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-base">
        <div className="font-mono text-xs text-text-dim animate-pulse">AUTHENTICATING...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-base">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-bg-base">{children}</main>
      </div>
    </div>
  );
}
