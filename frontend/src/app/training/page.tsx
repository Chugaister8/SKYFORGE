"use client";
import { useState } from "react";
import { useCourses, useCertificates, useLeaderboard, useStartCourse } from "@/lib/hooks/useTraining";
import { CourseCard }      from "@/components/training/CourseCard";
import { CourseDetail }    from "@/components/training/CourseDetail";
import { CertificateCard } from "@/components/training/CertificateCard";
import { clsx } from "clsx";
import { GraduationCap, Award, Trophy, Filter } from "lucide-react";

const CATS=["ALL","PILOT","ENGINEER","COMMANDER"] as const;
type Tab="courses"|"certificates"|"leaderboard";
const GRADE_CLR:Record<string,string>={S:"text-purple-400",A:"text-threat-low",B:"text-cyan-DEFAULT",C:"text-threat-medium",F:"text-threat-high"};

export default function TrainingPage(){
  const[tab,setTab]=useState<Tab>("courses");
  const[cat,setCat]=useState<string>("ALL");
  const[selected,setSelected]=useState<string|null>(null);
  const{data:cD,isLoading:cL}=useCourses(cat!=="ALL"?cat:undefined);
  const{data:certD}=useCertificates();
  const{data:lbD}=useLeaderboard();
  const start=useStartCourse();
  const courses=cD?.courses??[]; const certs=certD?.certificates??[]; const lb=lbD?.leaderboard??[];

  if(selected){
    const course=courses.find(c=>c.id===selected);
    if(course) return(<div className="h-full max-w-2xl mx-auto p-4">
      <CourseDetail course={course} progress={null} onBack={()=>setSelected(null)} onStart={()=>start.mutate(course.id)}/>
    </div>);
  }

  return(<div className="p-5 space-y-5 max-w-[1400px]">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-0.5">TRAINING</p>
        <h1 className="font-mono text-base text-text-primary tracking-wide">Training Platform</h1>
      </div>
      <div className="flex items-center gap-1.5 bg-bg-raised border border-border-dim rounded px-3 py-1.5">
        <Trophy className="w-3.5 h-3.5 text-threat-medium" strokeWidth={1.5}/>
        <span className="font-mono text-xs text-text-primary">{certs.length} <span className="text-text-dim">certs</span></span>
      </div>
    </div>

    <div className="flex items-center gap-1 border-b border-border-dim">
      {([["courses",GraduationCap,"Courses"],["certificates",Award,"My Certs"],["leaderboard",Trophy,"Leaderboard"]] as const).map(([key,Icon,label])=>(
        <button key={key} onClick={()=>setTab(key as Tab)} className={clsx(
          "flex items-center gap-1.5 px-4 py-2.5 font-mono text-xs tracking-widest transition-all border-b-2 -mb-px",
          tab===key?"border-border-active text-cyan-DEFAULT":"border-transparent text-text-secondary hover:text-text-primary")}>
          <Icon className="w-3.5 h-3.5" strokeWidth={1.5}/>{label.toUpperCase()}
        </button>
      ))}
    </div>

    {tab==="courses"&&(<div>
      <div className="flex items-center gap-1.5 mb-4">
        <Filter className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.5}/>
        {CATS.map(c=>(<button key={c} onClick={()=>setCat(c)} className={clsx(
          "px-3 py-1 rounded border font-mono text-2xs tracking-widest transition-all",
          cat===c?"border-border-active bg-cyan-subtle text-cyan-DEFAULT":"border-border-dim text-text-secondary hover:text-text-primary")}>{c}</button>))}
      </div>
      {cL?(<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {[1,2,3,4,5,6].map(i=><div key={i} className="h-40 bg-bg-surface rounded animate-pulse"/>)}
      </div>):(<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {courses.map(course=>(<CourseCard key={course.id} course={course} completed={certs.some(c=>c.course_id===course.id)} onClick={()=>setSelected(course.id)}/>))}
      </div>)}
    </div>)}

    {tab==="certificates"&&(certs.length===0?(
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Award className="w-12 h-12 text-text-dim" strokeWidth={1}/>
        <p className="font-mono text-xs text-text-dim">No certificates yet</p>
        <p className="font-mono text-2xs text-text-dim">Complete a course to earn your first certificate</p>
        <button onClick={()=>setTab("courses")} className="font-mono text-xs text-cyan-DEFAULT hover:underline">Browse courses →</button>
      </div>
    ):(<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {certs.map(c=><CertificateCard key={c.id} cert={c}/>)}
    </div>))}

    {tab==="leaderboard"&&(<div className="max-w-2xl">
      <div className="bg-bg-surface border border-border-dim rounded overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-border-dim bg-bg-raised">
          {[["#","col-span-1"],["PILOT","col-span-4"],["COURSE","col-span-4"],["SCORE","col-span-2"],["GRADE","col-span-1"]].map(([h,c])=>(
            <span key={h} className={clsx("font-mono text-2xs text-text-secondary tracking-widest",c)}>{h}</span>
          ))}
        </div>
        {lb.length===0?(
          <div className="flex items-center justify-center h-32"><p className="font-mono text-xs text-text-dim">No data yet</p></div>
        ):(lb.map((row,i)=>(
          <div key={i} className={clsx("grid grid-cols-12 px-4 py-2.5 border-b border-border-dim last:border-0",i<3&&"bg-bg-raised")}>
            <span className={clsx("font-mono text-xs col-span-1",i===0?"text-threat-medium":i===1?"text-text-secondary":"text-text-dim")}>{i+1}</span>
            <span className="font-mono text-xs text-text-primary col-span-4">{row.username}</span>
            <span className="font-mono text-2xs text-text-secondary col-span-4">{row.course_id}</span>
            <span className="font-mono text-xs text-text-primary col-span-2 tabular-nums">{row.score}</span>
            <span className={clsx("font-mono text-xs col-span-1",GRADE_CLR[row.grade]??"")}>{row.grade}</span>
          </div>
        )))}
      </div>
    </div>)}
  </div>);
}
