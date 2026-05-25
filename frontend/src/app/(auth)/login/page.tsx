"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";
import { api } from "@/lib/api";
import { clsx } from "clsx";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

interface AuthResponse {
  tokens: { access_token:string; refresh_token:string; expires_in:number };
  user:   { id:string; username:string; email:string; role:string; status:string };
}

export default function LoginPage() {
  const router   = useRouter();
  const setAuth  = useAuthStore(s => s.setAuth);

  const [mode,     setMode]     = useState<"login"|"register">("login");
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      let res: AuthResponse;
      if (mode === "register") {
        res = await api.post<AuthResponse>("/auth/register", { username, email, password });
      } else {
        res = await api.post<AuthResponse>("/auth/login", { username, password });
      }
      setAuth(
        res.user,
        res.tokens.access_token,
        res.tokens.refresh_token,
        res.tokens.expires_in,
      );
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="font-mono text-3xl font-bold text-cyan-DEFAULT tracking-[0.3em]">
            ⚡ SKYFORGE
          </p>
          <p className="font-mono text-xs text-text-secondary mt-2 tracking-widest">
            UAV SIMULATION & TRAINING PLATFORM
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-surface border border-border-dim rounded p-6 space-y-4">
          {/* Tab */}
          <div className="flex border-b border-border-dim">
            {(["login","register"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={clsx("flex-1 py-2 font-mono text-xs tracking-widest transition-all border-b-2",
                  mode===m?"border-border-active text-cyan-DEFAULT":"border-transparent text-text-secondary hover:text-text-primary")}>
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="font-mono text-2xs text-text-secondary block mb-1">
                {mode==="login" ? "USERNAME OR EMAIL" : "USERNAME"}
              </label>
              <input
                value={username} onChange={e => setUsername(e.target.value)}
                required autoComplete="username"
                className="w-full bg-bg-base border border-border-dim rounded px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active"
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="font-mono text-2xs text-text-secondary block mb-1">EMAIL</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  className="w-full bg-bg-base border border-border-dim rounded px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active"
                />
              </div>
            )}

            <div>
              <label className="font-mono text-2xs text-text-secondary block mb-1">PASSWORD</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete={mode==="login" ? "current-password" : "new-password"}
                  minLength={8}
                  className="w-full bg-bg-base border border-border-dim rounded px-3 py-2 pr-10 font-mono text-xs text-text-primary focus:outline-none focus:border-border-active"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-secondary transition-colors">
                  {showPw ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded border border-threat-high/40 bg-threat-high/5">
                <AlertCircle className="w-3.5 h-3.5 text-threat-high shrink-0" strokeWidth={1.5}/>
                <p className="font-mono text-2xs text-threat-high">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className={clsx("w-full flex items-center justify-center gap-2 py-2.5 rounded border font-mono text-xs tracking-widest transition-all",
                loading
                  ? "border-border-dim text-text-dim cursor-not-allowed"
                  : "border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan")}>
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>{mode==="login"?"SIGNING IN...":"REGISTERING..."}</>
                : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"
              }
            </button>
          </form>
        </div>

        <p className="font-mono text-2xs text-text-dim text-center mt-4">
          For training purposes only. Not for operational use.
        </p>
      </div>
    </div>
  );
}
