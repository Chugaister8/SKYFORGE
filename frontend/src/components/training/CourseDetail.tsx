"use client";
import { useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, Play, CheckCircle, Clock, Award, BookOpen, Cpu, HelpCircle, Wrench } from "lucide-react";
import type { Course } from "@/lib/hooks/useTraining";

const MOD_ICONS:Record<string,any>={theory:BookOpen,simulator:Cpu,quiz:HelpCircle,practical:Wrench};
const MOD_CLR:Record<string,string>={theory:"text-cyan-DEFAULT",simulator:"text-threat-low",quiz:"text-threat-medium",practical:"text-purple-400"};
const DIFF_CLR:Record<string,string>={BEGINNER:"text-threat-low",INTERMEDIATE:"text-cyan-DEFAULT",ADVANCED:"text-threat-medium",EXPERT:"text-threat-high"};

interface Props{course:Course;progress:any;onBack:()=>void;onStart:()=>void;}

export function CourseDetail({course,progress,onBack,onStart}:Props){
  const[activeModule,setActiveModule]=useState<string|null>(null);
  const pct=progress?.progress_pct??0; const completed=progress?.completed??false; const score=progress?.score??0;
  return(<div className="h-full flex flex-col overflow-hidden">
    <div className="p-4 border-b border-border-dim shrink-0">
      <button onClick={onBack} className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-mono text-xs mb-3 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5}/>BACK
      </button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-2xs text-text-secondary tracking-widest">{course.category}</span>
            <span className={clsx("font-mono text-2xs",DIFF_CLR[course.difficulty])}>{course.difficulty}</span>
          </div>
          <h2 className="font-mono text-base text-text-primary font-medium">{course.title}</h2>
        </div>
        {completed&&<div className="flex items-center gap-2 shrink-0">
          <Award className="w-5 h-5 text-threat-low" strokeWidth={1.5}/>
          <div className="text-right"><p className="font-mono text-2xs text-threat-low">COMPLETED</p><p className="font-mono text-sm font-medium text-text-primary">{score}pts</p></div>
        </div>}
      </div>
      <p className="font-mono text-xs text-text-secondary mt-2 leading-relaxed">{course.description}</p>
      {pct>0&&<div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-2xs text-text-dim">Progress</span>
          <span className="font-mono text-2xs text-text-secondary">{Math.round(pct)}%</span>
        </div>
        <div className="h-1.5 bg-bg-base rounded overflow-hidden">
          <div className={clsx("h-full rounded",completed?"bg-threat-low":"bg-cyan-DEFAULT")} style={{width:`${pct}%`}}/>
        </div>
      </div>}
      <button onClick={onStart} className={clsx("w-full mt-3 flex items-center justify-center gap-2 py-2 rounded border font-mono text-xs tracking-widest transition-all",
        completed?"border-threat-low/50 bg-threat-low/10 text-threat-low hover:bg-threat-low/20":"border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan")}>
        <Play className="w-3.5 h-3.5" strokeWidth={1.5}/>{completed?"REVIEW COURSE":pct>0?"CONTINUE":"START COURSE"}
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">MODULES ({course.modules.length})</p>
      {course.modules.map((mod,idx)=>{
        const Icon=MOD_ICONS[mod.type]??BookOpen; const color=MOD_CLR[mod.type]??"text-text-secondary";
        const done=progress?.module_data?.[mod.id]?.completed??false; const active=activeModule===mod.id;
        return(<div key={mod.id}>
          <button onClick={()=>setActiveModule(active?null:mod.id)} className={clsx(
            "w-full flex items-center gap-3 p-3 rounded border text-left transition-all",
            active?"border-border-active bg-cyan-subtle":"border-border-dim hover:border-border-active bg-bg-raised")}>
            <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center shrink-0",done?"bg-threat-low/20 border border-threat-low/40":"bg-bg-base border border-border-dim")}>
              {done?<CheckCircle className="w-3.5 h-3.5 text-threat-low" strokeWidth={1.5}/>:<span className="font-mono text-2xs text-text-dim">{idx+1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-text-primary font-medium leading-none">{mod.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Icon className={clsx("w-3 h-3",color)} strokeWidth={1.5}/>
                <span className={clsx("font-mono text-2xs capitalize",color)}>{mod.type}</span>
                <span className="font-mono text-2xs text-text-dim">·</span>
                <Clock className="w-3 h-3 text-text-dim" strokeWidth={1.5}/>
                <span className="font-mono text-2xs text-text-dim">{mod.duration_min}m</span>
                {mod.pass_score&&<><span className="font-mono text-2xs text-text-dim">·</span><span className="font-mono text-2xs text-text-dim">Pass: {mod.pass_score}%</span></>}
              </div>
            </div>
          </button>
          {active&&<div className="ml-9 mt-1 p-3 bg-bg-raised rounded border border-border-dim">
            <p className="font-mono text-2xs text-text-secondary leading-relaxed">
              {mod.type==="theory"&&"Read study materials and review key concepts for this module."}
              {mod.type==="simulator"&&"Complete the simulator exercise to practice this skill."}
              {mod.type==="quiz"&&`Answer assessment questions. Minimum passing score: ${mod.pass_score}%.`}
              {mod.type==="practical"&&`Complete the practical exam in the simulator. Minimum: ${mod.pass_score}%.`}
            </p>
            <button className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-2xs tracking-widest hover:shadow-cyan-sm transition-all">
              <Play className="w-3 h-3" strokeWidth={1.5}/>{mod.type==="quiz"?"TAKE QUIZ":mod.type==="practical"?"START EXAM":"OPEN"}
            </button>
          </div>}
        </div>);
      })}
    </div>
  </div>);
}
