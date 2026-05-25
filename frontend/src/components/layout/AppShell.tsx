"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";
import { Sidebar }  from "./Sidebar";
import { Topbar }   from "./Topbar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, accessToken, isExpired, refreshAuth } = useAuthStore();

  useEffect(() => {
    if (!accessToken || !user) {
      router.replace("/login");
      return;
    }
    // Proactively refresh if token expired
    if (isExpired()) {
      refreshAuth().then(ok => {
        if (!ok) router.replace("/login");
      });
    }
  }, [accessToken, user]);

  if (!user || !accessToken) return null;

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-hidden relative">
          <ErrorBoundary context="page">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
