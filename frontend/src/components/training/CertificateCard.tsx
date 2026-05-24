"use client";
import { clsx } from "clsx";
import { Award, ExternalLink, Calendar } from "lucide-react";
import type { Certificate } from "@/lib/hooks/useTraining";

const GRADE_CFG:Record<string,{color:string;bg:string}>={
  S:{color:"text-purple-400",bg:"bg-purple-500/20"},A:{color:"text-threat-low",bg:"bg-threat-low/10"},
  B:{color:"text-cyan-DEFAULT",bg:"bg-cyan-subtle"},C:{color:"text-threat-medium",bg:"bg-threat-medium/10"},
  F:{color:"text-threat-high",bg:"bg-threat-high/10"},
};
const NAMES:Record<string,string>={
  "fpv-basic":"FPV Operator — Basic","fpv-strike":"FPV Strike Operator",
  "isr-tactical":"Tactical ISR Operator","ew-awareness":"EW Threat Awareness",
  "mission-cmd":"Mission Commander","male-systems":"MALE Systems Engineer",
};

export function CertificateCard({cert}:{cert:Certificate}){
  const g=GRADE_CFG[cert.grade]??GRADE_CFG.B;
  const issued=new Date(cert.issued_at).toLocaleDateString("en-GB");
  const expires=cert.expires_at?new Date(cert.expires_at).toLocaleDateString("en-GB"):null;
  return(<div className={clsx("bg-bg-surface border rounded p-4 space-y-3 transition-all",
    cert.valid?"border-threat-low/30 hover:border-threat-low/60":"border-border-dim opacity-60")}>
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-threat-low shrink-0" strokeWidth={1.5}/>
        <div>
          <p className="font-mono text-xs text-text-primary font-medium leading-none">{NAMES[cert.course_id]??cert.course_id}</p>
          <p className="font-mono text-2xs text-text-dim mt-0.5">{cert.cert_number}</p>
        </div>
      </div>
      <div className={clsx("w-10 h-10 rounded flex items-center justify-center font-mono text-lg font-bold border-2",g.color,g.bg,"border-current")}>{cert.grade}</div>
    </div>
    <div className="flex items-center justify-between">
      <div className="h-1.5 flex-1 bg-bg-base rounded overflow-hidden mr-3">
        <div className="h-full bg-threat-low rounded" style={{width:`${cert.score}%`}}/>
      </div>
      <span className="font-mono text-xs text-text-primary tabular-nums">{cert.score}pts</span>
    </div>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3 h-3 text-text-dim" strokeWidth={1.5}/>
        <span className="font-mono text-2xs text-text-dim">Issued: {issued}</span>
      </div>
      {expires&&<span className="font-mono text-2xs text-text-dim">Exp: {expires}</span>}
    </div>
    <button className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-border-dim text-text-secondary hover:text-text-primary hover:border-border-active font-mono text-2xs transition-all">
      <ExternalLink className="w-3 h-3" strokeWidth={1.5}/>VERIFY CERTIFICATE
    </button>
  </div>);
}
