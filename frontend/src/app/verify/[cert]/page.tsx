"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Shield, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface CertData {
  valid:        boolean;
  cert_number:  string;
  holder:       string;
  course_id:    string;
  course_title: string;
  score:        number;
  grade:        string;
  issued_at:    string;
  expires_at:   string | null;
  expired:      boolean;
  status:       "VALID"|"EXPIRED"|"REVOKED";
}

const GRADE_CLR: Record<string,string> = {
  S:"text-purple-400", A:"text-threat-low", B:"text-cyan-DEFAULT",
  C:"text-threat-medium", F:"text-threat-high",
};

const BASE = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

export default function VerifyPage() {
  const params = useParams();
  const cert   = params?.cert as string;

  const [data,    setData]    = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!cert) return;
    fetch(`${BASE}/api/training/verify/${cert}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.detail ?? "Not found")))
      .then(setData)
      .catch(e => setError(typeof e === "string" ? e : "Certificate not found"))
      .finally(() => setLoading(false));
  }, [cert]);

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-cyan-DEFAULT" strokeWidth={1.5}/>
            <span className="font-mono font-bold text-lg tracking-[0.3em] text-cyan-DEFAULT">SKYFORGE</span>
          </div>
          <p className="font-mono text-xs text-text-secondary tracking-widest">CERTIFICATE VERIFICATION</p>
        </div>

        <div className="bg-bg-surface border border-border-dim rounded p-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-text-dim"/>
              <p className="font-mono text-xs text-text-dim">Verifying {cert}…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 py-8">
              <XCircle className="w-10 h-10 text-threat-high" strokeWidth={1}/>
              <p className="font-mono text-sm text-threat-high">Certificate Not Found</p>
              <p className="font-mono text-xs text-text-dim text-center">
                No certificate matching <span className="text-text-secondary">{cert}</span> exists in the SKYFORGE database.
              </p>
            </div>
          )}

          {data && (
            <div className="space-y-5">
              {/* Status banner */}
              <div className={clsx(
                "flex items-center gap-3 p-3 rounded border",
                data.status === "VALID"
                  ? "border-threat-low/50 bg-threat-low/10"
                  : data.status === "EXPIRED"
                  ? "border-threat-medium/50 bg-threat-medium/10"
                  : "border-threat-high/50 bg-threat-high/10",
              )}>
                {data.status === "VALID"
                  ? <CheckCircle className="w-5 h-5 text-threat-low shrink-0" strokeWidth={1.5}/>
                  : data.status === "EXPIRED"
                  ? <AlertTriangle className="w-5 h-5 text-threat-medium shrink-0" strokeWidth={1.5}/>
                  : <XCircle className="w-5 h-5 text-threat-high shrink-0" strokeWidth={1.5}/>
                }
                <div>
                  <p className={clsx("font-mono text-sm font-medium",
                    data.status === "VALID" ? "text-threat-low" :
                    data.status === "EXPIRED" ? "text-threat-medium" : "text-threat-high",
                  )}>
                    {data.status === "VALID"   ? "✓ Certificate Valid" :
                     data.status === "EXPIRED" ? "⚠ Certificate Expired" : "✗ Certificate Revoked"}
                  </p>
                  <p className="font-mono text-2xs text-text-secondary mt-0.5">
                    {data.cert_number}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-2xs text-text-dim">Holder</p>
                  <p className="font-mono text-xs text-text-primary font-medium">{data.holder}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-2xs text-text-dim">Course</p>
                  <p className="font-mono text-xs text-text-primary text-right max-w-[220px]">{data.course_title}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-2xs text-text-dim">Score</p>
                  <div className="flex items-center gap-2">
                    <span className={clsx("font-mono text-lg font-bold", GRADE_CLR[data.grade])}>
                      {data.grade}
                    </span>
                    <span className="font-mono text-xs text-text-secondary">{data.score}/100</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-2xs text-text-dim">Issued</p>
                  <p className="font-mono text-xs text-text-secondary">
                    {new Date(data.issued_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                {data.expires_at && (
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-2xs text-text-dim">Expires</p>
                    <p className={clsx("font-mono text-xs",
                      data.expired ? "text-threat-medium" : "text-text-secondary",
                    )}>
                      {new Date(data.expires_at).toLocaleDateString("en-GB")}
                      {data.expired && " (expired)"}
                    </p>
                  </div>
                )}
              </div>

              {/* Cert number */}
              <div className="pt-3 border-t border-border-dim text-center">
                <p className="font-mono text-2xs text-text-dim mb-1">Certificate Number</p>
                <p className="font-mono text-sm text-cyan-DEFAULT tracking-widest select-all">
                  {data.cert_number}
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="font-mono text-2xs text-text-dim text-center mt-4">
          Verified by SKYFORGE Training Platform
        </p>
      </div>
    </div>
  );
}
