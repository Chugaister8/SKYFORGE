import Link from "next/link";
import { Shield, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-cyan-DEFAULT" strokeWidth={1.5}/>
          <span className="font-mono font-bold tracking-[0.3em] text-cyan-DEFAULT text-lg">SKYFORGE</span>
        </div>

        <div>
          <p className="font-mono text-6xl font-bold text-text-primary opacity-20">404</p>
          <p className="font-mono text-base text-text-primary mt-2">Page not found</p>
          <p className="font-mono text-xs text-text-secondary mt-1">
            The route you requested doesn't exist in this system.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-xs tracking-widest hover:shadow-cyan transition-all">
            <Home className="w-3.5 h-3.5" strokeWidth={1.5}/>DASHBOARD
          </Link>
          <button onClick={() => history.back()}
            className="flex items-center gap-2 px-4 py-2 rounded border border-border-dim text-text-secondary hover:text-text-primary font-mono text-xs tracking-widest transition-all">
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5}/>GO BACK
          </button>
        </div>
      </div>
    </div>
  );
}
