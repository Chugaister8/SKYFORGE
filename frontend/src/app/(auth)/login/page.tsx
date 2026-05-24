"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode,     setMode]     = useState<"login" | "register">("login");
  const [email,    setEmail]    = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState("PILOT");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const ROLES = ["PILOT", "ENGINEER", "COMMANDER", "INSTRUCTOR"];

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await api.post<{ tokens: { access_token: string; refresh_token: string }; user: any }>(
          "/auth/login", { email, password }
        );
        setAuth(res.user, res.tokens.access_token, res.tokens.refresh_token);
      } else {
        const res = await api.post<{ tokens: { access_token: string; refresh_token: string }; user: any }>(
          "/auth/register", { email, username, password, role }
        );
        setAuth(res.user, res.tokens.access_token, res.tokens.refresh_token);
      }
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-cyan-DEFAULT" strokeWidth={1.5} />
            <span className="font-mono text-xl tracking-[0.3em] text-cyan-DEFAULT">{APP_NAME}</span>
          </div>
          <p className="font-mono text-2xs text-text-secondary tracking-widest">UAV MISSION SIMULATOR & TRAINING PLATFORM</p>
        </div>
        <div className="bg-bg-surface border border-border-dim rounded p-6 shadow-panel">
          <div className="flex mb-6 bg-bg-base rounded overflow-hidden border border-border-dim">
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null); }}
                className={clsx("flex-1 py-2 font-mono text-xs tracking-widest transition-all",
                  mode === m ? "bg-cyan-subtle text-cyan-DEFAULT border-b border-cyan-DEFAULT" : "text-text-secondary hover:text-text-primary")}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block font-mono text-2xs text-text-secondary tracking-widest mb-1">EMAIL</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@unit.mil"
                className="w-full bg-bg-base border border-border-dim rounded px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-border-active transition-all" />
            </div>
            {mode === "register" && (
              <div>
                <label className="block font-mono text-2xs text-text-secondary tracking-widest mb-1">CALLSIGN / USERNAME</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="alpha1"
                  className="w-full bg-bg-base border border-border-dim rounded px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-border-active transition-all" />
              </div>
            )}
            <div>
              <label className="block font-mono text-2xs text-text-secondary tracking-widest mb-1">PASSWORD</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="w-full bg-bg-base border border-border-dim rounded px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-border-active transition-all" />
            </div>
            {mode === "register" && (
              <div>
                <label className="block font-mono text-2xs text-text-secondary tracking-widest mb-1">ROLE</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROLES.map((r) => (
                    <button key={r} onClick={() => setRole(r)}
                      className={clsx("py-1.5 rounded border font-mono text-2xs tracking-widest transition-all",
                        role === r ? "border-border-active bg-cyan-subtle text-cyan-DEFAULT" : "border-border-dim text-text-secondary hover:border-border-active hover:text-text-primary")}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div className="bg-threat-high/10 border border-threat-high/30 rounded px-3 py-2">
                <p className="font-mono text-2xs text-threat-high">{error}</p>
              </div>
            )}
            <button onClick={handleSubmit} disabled={loading}
              className={clsx("w-full py-2.5 rounded border font-mono text-xs tracking-widest transition-all mt-2",
                loading ? "border-border-dim text-text-dim cursor-not-allowed"
                        : "border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:bg-cyan-glow hover:shadow-cyan")}>
              {loading ? "AUTHENTICATING..." : mode === "login" ? "ACCESS SYSTEM" : "CREATE ACCOUNT"}
            </button>
          </div>
        </div>
        <p className="text-center font-mono text-2xs text-text-dim mt-4">SKYFORGE v0.1.0 — TRAINING USE ONLY</p>
      </div>
    </div>
  );
}
