"use client";
import { clsx } from "clsx";
import { Clock, ChevronRight, Award } from "lucide-react";
import type { Course } from "@/lib/hooks/useTraining";

const DIFF_CFG:Record<string,{color:string;bg:string}>={
  BEGINNER:{color:"text-threat-low",bg:"bg-threat-low/10"},INTERMEDIATE:{color:"text-cyan-DEFAULT",bg:"bg-cyan-subtle"},
  ADVANCED:{color:"text-threat-medium",bg:"bg-threat-medium/10"},EXPERT:{color:"text-threat-high",bg:"bg-threat-high/10"},
};
const CAT_CLR:Record<string,string>={PILOT:"text-cyan-DEFAULT",ENGINEER:"text-threat-low",COMMANDER:"text-threat-medium"};

interface Props{course:Course;progress?:number;completed?:boolean;onClick:()=>void;}

export function CourseCard({course,progress,completed,onClick}:Props){
  const diff=DIFF_CFG[course.difficulty]??DIFF_CFG.BEGINNER;
  const hrs=Math.floor(course.duration_min/60); const mins=course.duration_min%60;
  return(<button onClick={onClick} className={clsx("w-full text-left bg-bg-surface border rounded p-4 transition-all group",
    completed?"border-threat-low/40 hover:border-threat-low/70":"border-border-dim hover:border-border-active")}>
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={clsx("font-mono text-2xs tracking-widest",CAT_CLR[course.category]??"text-text-secondary")}>{course.category}</span>
          <span className={clsx("font-mono text-2xs px-1.5 py-0.5 rounded",diff.color,diff.bg)}>{course.difficulty}</span>
        </div>
        <h3 className="font-mono text-sm text-text-primary font-medium leading-snug">{course.title}</h3>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {completed&&<Award className="w-4 h-4 text-threat-low" strokeWidth={1.5}/>}
        <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-text-secondary" strokeWidth={1.5}/>
      </div>
    </div>
    <p className="font-mono text-2xs text-text-secondary leading-relaxed mb-3 line-clamp-2">{course.description}</p>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-text-dim">
        <Clock className="w-3 h-3" strokeWidth={1.5}/>
        <span className="font-mono text-2xs">{hrs>0?`${hrs}h `:""}{mins>0?`${mins}m`:""}</span>
        <span className="font-mono text-2xs text-text-dim">· {course.modules.length} modules</span>
      </div>
      {progress!==undefined&&(
        <div className="flex items-center gap-2">
          <div className="w-20 h-1 bg-bg-base rounded overflow-hidden">
            <div className={clsx("h-full rounded",completed?"bg-threat-low":"bg-cyan-DEFAULT")} style={{width:`${Math.min(100,progress)}%`}}/>
          </div>
          <span className="font-mono text-2xs text-text-secondary">{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  </button>);
}
