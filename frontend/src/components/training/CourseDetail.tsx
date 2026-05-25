"use client";
import { useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, Play, CheckCircle, Clock, Award, BookOpen, Cpu, HelpCircle, Wrench } from "lucide-react";
import { QuizEngine } from "./QuizEngine";
import type { Course } from "@/lib/hooks/useTraining";

const MOD_ICONS:Record<string,any>={theory:BookOpen,simulator:Cpu,quiz:HelpCircle,practical:Wrench};
const MOD_CLR:Record<string,string>={theory:"text-cyan-DEFAULT",simulator:"text-threat-low",quiz:"text-threat-medium",practical:"text-purple-400"};
const DIFF_CLR:Record<string,string>={BEGINNER:"text-threat-low",INTERMEDIATE:"text-cyan-DEFAULT",ADVANCED:"text-threat-medium",EXPERT:"text-threat-high"};

interface Props{course:Course;progress:any;onBack:()=>void;onStart:()=>void;}

export function CourseDetail({course,progress,onBack,onStart}:Props){
  const[activeModule,setActiveModule]=useState<string|null>(null);
  const[quizModule,setQuizModule]=useState<{id:string;title:string;passScore:number}|null>(null);
  const[quizScores,setQuizScores]=useState<Record<string,{score:number;grade:string}>>({});
  const pct=progress?.progress_pct??0; const completed=progress?.completed??false; const score=progress?.score??0;

  const handleQuizComplete=(moduleId:string,s:number,g:string)=>{
    setQuizScores(prev=>({...prev,[moduleId]:{score:s,grade:g}}));
    setQuizModule(null);
  };

  if(quizModule) return(
    <QuizEngine
      courseId={course.id} moduleId={quizModule.id}
      moduleTitle={quizModule.title} passScore={quizModule.passScore}
      onBack={()=>setQuizModule(null)}
      onComplete={(s,g)=>handleQuizComplete(quizModule.id,s,g)}
    />
  );

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
          <div className="text-right"><p className="font-mono text-2xs text-threat-low">COMPLETED</p>
          <p className="font-mono text-sm font-medium text-text-primary">{score}pts</p></div>
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
        completed?"border-threat-low/50 bg-threat-low/10 text-threat-low":"border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan")}>
        <Play className="w-3.5 h-3.5" strokeWidth={1.5}/>{completed?"REVIEW":pct>0?"CONTINUE":"START COURSE"}
      </button>
    </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">MODULES ({course.modules.length})</p>
      {course.modules.map((mod,idx)=>{
        const Icon=MOD_ICONS[mod.type]??BookOpen; const color=MOD_CLR[mod.type]??"text-text-secondary";
        const done=quizScores[mod.id]?.score>=(mod.pass_score??70)||progress?.module_data?.[mod.id]?.completed;
        const qs=quizScores[mod.id];
        const active=activeModule===mod.id;
        const isQuiz=mod.type==="quiz"||mod.type==="practical";

        return(<div key={mod.id}>
          <button onClick={()=>setActiveModule(active?null:mod.id)}
            className={clsx("w-full flex items-center gap-3 p-3 rounded border text-left transition-all",
              active?"border-border-active bg-cyan-subtle":"border-border-dim hover:border-border-active bg-bg-raised")}>
            <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center shrink-0",
              done?"bg-threat-low/20 border border-threat-low/40":"bg-bg-base border border-border-dim")}>
              {done?<CheckCircle className="w-3.5 h-3.5 text-threat-low" strokeWidth={1.5}/>
               :<span className="font-mono text-2xs text-text-dim">{idx+1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-text-primary font-medium leading-none">{mod.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Icon className={clsx("w-3 h-3",color)} strokeWidth={1.5}/>
                <span className={clsx("font-mono text-2xs capitalize",color)}>{mod.type}</span>
                <span className="font-mono text-2xs text-text-dim">·</span>
                <Clock className="w-3 h-3 text-text-dim" strokeWidth={1.5}/>
                <span className="font-mono text-2xs text-text-dim">{mod.duration_min}m</span>
                {mod.pass_score&&<><span className="font-mono text-2xs text-text-dim">· Pass: {mod.pass_score}%</span></>}
                {qs&&<span className={clsx("font-mono text-2xs ml-1",qs.score>=(mod.pass_score??70)?"text-threat-low":"text-threat-high")}>{qs.score}% {qs.grade}</span>}
              </div>
            </div>
          </button>
          {active&&(
            <div className="ml-9 mt-1 p-3 bg-bg-raised rounded border border-border-dim">
              <p className="font-mono text-2xs text-text-secondary leading-relaxed mb-2">
                {mod.type==="theory"&&"Read study materials and review key concepts."}
                {mod.type==="simulator"&&"Complete the simulator exercise to practice this skill."}
                {mod.type==="quiz"&&`Answer ${(QUIZ_COUNTS[course.id])||5} questions. Minimum: ${mod.pass_score}%.`}
                {mod.type==="practical"&&`Complete the practical exam. Minimum: ${mod.pass_score}%.`}
              </p>
              {isQuiz?(
                <button
                  onClick={()=>setQuizModule({id:mod.id,title:mod.title,passScore:mod.pass_score??75})}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-2xs tracking-widest hover:shadow-cyan-sm transition-all">
                  <Play className="w-3 h-3" strokeWidth={1.5}/>
                  {mod.type==="quiz"?"TAKE QUIZ":"START EXAM"}
                </button>
              ):(
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border-dim text-text-secondary hover:text-text-primary font-mono text-2xs tracking-widest transition-all">
                  <Play className="w-3 h-3" strokeWidth={1.5}/>OPEN MODULE
                </button>
              )}
            </div>
          )}
        </div>);
      })}
    </div>
  </div>);
}

const QUIZ_COUNTS:Record<string,number>={
  "fpv-basic":5,"fpv-strike":5,"isr-tactical":5,
  "ew-awareness":5,"mission-cmd":5,"male-systems":5,
};
