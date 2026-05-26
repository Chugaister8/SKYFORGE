"use client";
import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { useQuiz } from "@/lib/hooks/useQuiz";
import { CheckCircle, XCircle, Clock, Trophy, RotateCcw, ChevronRight, ArrowLeft, Award, Loader2 } from "lucide-react";

const GRADE_CFG:Record<string,{color:string;bg:string;border:string}>={
  S:{color:"text-purple-400",bg:"bg-purple-500/20",border:"border-purple-400"},
  A:{color:"text-threat-low",bg:"bg-threat-low/10",border:"border-threat-low"},
  B:{color:"text-cyan-DEFAULT",bg:"bg-cyan-subtle",border:"border-border-active"},
  C:{color:"text-threat-medium",bg:"bg-threat-medium/10",border:"border-threat-medium/30"},
  F:{color:"text-threat-high",bg:"bg-threat-high/10",border:"border-threat-high/30"},
};

interface Props{
  courseId:string; moduleId:string; moduleTitle:string; passScore:number;
  onBack:()=>void; onComplete:(score:number,grade:string,timeSpentS:number)=>void;
}

export function QuizEngine({courseId,moduleId,moduleTitle,passScore,onBack,onComplete}:Props){
  const{state,questions,start,answer,restart,saveResult,claimCert}=useQuiz(courseId,moduleId,300);
  const[showExplain,setShowExplain]=useState(false);
  const[selectedAnswer,setSelectedAnswer]=useState<number|null>(null);
  const[backendResult,setBackendResult]=useState<{passed:boolean;canCertify:boolean;courseComplete:boolean}|null>(null);
  const[cert,setCert]=useState<{cert_number:string;grade:string}|null>(null);
  const[certLoading,setCertLoading]=useState(false);

  // Auto-save when quiz finishes
  useEffect(()=>{
    if(state.finished&&!state.saved&&!state.saving){
      saveResult(state.score,state.grade,passScore).then(r=>setBackendResult(r));
    }
  },[state.finished]);

  const handleClaimCert=async()=>{
    setCertLoading(true);
    const c=await claimCert();
    if(c) setCert(c);
    setCertLoading(false);
  };

  const q=questions[state.current];
  const mins=Math.floor(state.timeLeft/60);
  const secs=state.timeLeft%60;

  if(!state.started) return(
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="text-center space-y-2">
        <p className="font-mono text-2xs text-text-secondary tracking-widest">ASSESSMENT</p>
        <h2 className="font-mono text-lg text-text-primary font-medium">{moduleTitle}</h2>
        <p className="font-mono text-xs text-text-secondary">{questions.length} questions · 5 min limit</p>
        <p className="font-mono text-xs text-text-dim">Passing score: {passScore}%</p>
      </div>
      <div className="bg-bg-raised border border-border-dim rounded p-4 max-w-sm w-full space-y-2">
        {["Read each question carefully","Cannot go back to previous questions","Explanation shown after each answer","Result saved to your profile automatically"].map((t,i)=>(
          <div key={i} className="flex items-center gap-2">
            <span className="font-mono text-2xs text-cyan-DEFAULT w-4">{i+1}.</span>
            <span className="font-mono text-2xs text-text-secondary">{t}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 rounded border border-border-dim text-text-secondary hover:text-text-primary font-mono text-xs transition-all">
          <ArrowLeft className="w-3.5 h-3.5"/>BACK
        </button>
        <button onClick={start} className="flex items-center gap-1.5 px-6 py-2 rounded border border-border-active bg-cyan-subtle text-cyan-DEFAULT font-mono text-xs tracking-widest hover:shadow-cyan transition-all">
          START QUIZ <ChevronRight className="w-3.5 h-3.5"/>
        </button>
      </div>
    </div>
  );

  if(state.finished){
    const g=GRADE_CFG[state.grade]??GRADE_CFG.F;
    const passed=state.score>=passScore;
    return(
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8 overflow-y-auto">
        <div className={clsx("w-20 h-20 rounded-lg flex items-center justify-center text-4xl font-mono font-bold border-2",g.color,g.bg,g.border)}>
          {state.grade}
        </div>
        <div className="text-center">
          <p className={clsx("font-mono text-2xl font-medium",g.color)}>{state.score}%</p>
          <p className="font-mono text-xs text-text-secondary mt-1">
            {state.results.filter(r=>r.correct).length}/{questions.length} correct
          </p>
          <p className={clsx("font-mono text-xs mt-1.5 font-medium",passed?"text-threat-low":"text-threat-high")}>
            {passed?"✓ PASSED":"✗ FAILED"} — minimum {passScore}%
          </p>
          {state.saving&&<p className="font-mono text-2xs text-text-dim mt-1 flex items-center gap-1 justify-center"><Loader2 className="w-3 h-3 animate-spin"/>Saving to profile...</p>}
          {state.saved&&<p className="font-mono text-2xs text-threat-low mt-1">✓ Result saved to your profile</p>}
        </div>

        {/* Cert claim */}
        {backendResult?.canCertify&&!cert&&(
          <div className="bg-bg-raised border border-threat-low/40 rounded p-4 max-w-sm w-full text-center space-y-2">
            <Award className="w-8 h-8 text-threat-low mx-auto" strokeWidth={1.5}/>
            <p className="font-mono text-xs text-text-primary font-medium">Course Complete!</p>
            <p className="font-mono text-2xs text-text-secondary">You've qualified for a certificate.</p>
            <button onClick={handleClaimCert} disabled={certLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded border border-threat-low bg-threat-low/10 text-threat-low font-mono text-xs tracking-widest hover:bg-threat-low/20 transition-all disabled:opacity-60">
              {certLoading?<><Loader2 className="w-3.5 h-3.5 animate-spin"/>ISSUING...</>:<><Award className="w-3.5 h-3.5"/>CLAIM CERTIFICATE</>}
            </button>
          </div>
        )}

        {cert&&(
          <div className="bg-bg-raised border border-threat-low/40 rounded p-4 max-w-sm w-full text-center space-y-1">
            <CheckCircle className="w-8 h-8 text-threat-low mx-auto" strokeWidth={1.5}/>
            <p className="font-mono text-xs text-threat-low font-medium">Certificate Issued!</p>
            <p className="font-mono text-2xs text-text-dim">{cert.cert_number}</p>
            <p className="font-mono text-2xs text-text-secondary">Grade: {cert.grade}</p>
          </div>
        )}

        {/* Breakdown */}
        <div className="w-full max-w-lg space-y-1.5 max-h-56 overflow-y-auto">
          {questions.map((q,i)=>{
            const r=state.results[i];
            return(
              <div key={q.id} className={clsx("flex items-start gap-2.5 p-2.5 rounded border",
                r?.correct?"border-threat-low/30 bg-threat-low/5":"border-threat-high/30 bg-threat-high/5")}>
                {r?.correct
                  ?<CheckCircle className="w-4 h-4 text-threat-low shrink-0 mt-0.5" strokeWidth={1.5}/>
                  :<XCircle   className="w-4 h-4 text-threat-high shrink-0 mt-0.5" strokeWidth={1.5}/>}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-2xs text-text-primary leading-snug">{q.text}</p>
                  {!r?.correct&&<p className="font-mono text-2xs text-threat-low mt-0.5">✓ {q.options[q.correct]}</p>}
                  <p className="font-mono text-2xs text-text-dim mt-1 leading-relaxed">{q.explain}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          {!passed&&<button onClick={restart} className="flex items-center gap-1.5 px-4 py-2 rounded border border-border-dim text-text-secondary hover:text-text-primary font-mono text-xs transition-all"><RotateCcw className="w-3.5 h-3.5"/>RETRY</button>}
          <button onClick={()=>onComplete(state.score,state.grade)} className={clsx("flex items-center gap-1.5 px-6 py-2 rounded border font-mono text-xs tracking-widest transition-all",
            passed?"border-threat-low bg-threat-low/10 text-threat-low":"border-border-dim text-text-secondary hover:text-text-primary")}>
            <Trophy className="w-3.5 h-3.5"/>{passed?"DONE":"BACK TO COURSE"}
          </button>
        </div>
      </div>
    );
  }

  // Active quiz
  const justAnswered=selectedAnswer!==null;
  const isCorrect=justAnswered&&selectedAnswer===q?.correct;

  const handleSelect=(idx:number)=>{
    if(selectedAnswer!==null||!q) return;
    setSelectedAnswer(idx); setShowExplain(true);
    setTimeout(()=>{ answer(idx); setSelectedAnswer(null); setShowExplain(false); },1800);
  };

  if(!q) return null;

  return(
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border-dim shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xs text-text-dim">{state.current+1}/{questions.length}</span>
          <div className="w-32 h-1 bg-bg-base rounded overflow-hidden">
            <div className="h-full bg-cyan-DEFAULT rounded transition-all" style={{width:`${(state.current/questions.length)*100}%`}}/>
          </div>
        </div>
        <div className={clsx("flex items-center gap-1.5 font-mono text-xs tabular-nums",state.timeLeft<60?"text-threat-high animate-pulse":"text-text-secondary")}>
          <Clock className="w-3.5 h-3.5" strokeWidth={1.5}/>{mins}:{secs.toString().padStart(2,"0")}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <p className="font-mono text-sm text-text-primary font-medium leading-relaxed">{q.text}</p>
        <div className="space-y-2">
          {q.options.map((opt,idx)=>{
            let style="border-border-dim text-text-secondary hover:border-border-active hover:text-text-primary hover:bg-bg-raised";
            if(selectedAnswer!==null){
              if(idx===q.correct) style="border-threat-low bg-threat-low/10 text-threat-low";
              else if(idx===selectedAnswer&&idx!==q.correct) style="border-threat-high bg-threat-high/10 text-threat-high";
              else style="border-border-dim text-text-dim opacity-50";
            }
            return(
              <button key={idx} onClick={()=>handleSelect(idx)} disabled={selectedAnswer!==null}
                className={clsx("w-full flex items-center gap-3 p-3 rounded border font-mono text-xs text-left transition-all",style)}>
                <span className="w-5 h-5 rounded border border-current flex items-center justify-center shrink-0 font-mono text-2xs">
                  {selectedAnswer!==null&&idx===q.correct?<CheckCircle className="w-3.5 h-3.5" strokeWidth={2}/>
                   :selectedAnswer===idx&&idx!==q.correct?<XCircle className="w-3.5 h-3.5" strokeWidth={2}/>
                   :["A","B","C","D"][idx]}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
        {showExplain&&(
          <div className={clsx("p-3 rounded border",isCorrect?"border-threat-low/40 bg-threat-low/5":"border-threat-high/40 bg-threat-high/5")}>
            <p className={clsx("font-mono text-2xs font-medium mb-1",isCorrect?"text-threat-low":"text-threat-high")}>{isCorrect?"✓ Correct":"✗ Incorrect"}</p>
            <p className="font-mono text-2xs text-text-secondary leading-relaxed">{q.explain}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5 p-3 border-t border-border-dim shrink-0">
        {questions.map((_,i)=>(
          <span key={i} className={clsx("w-2 h-2 rounded-full",
            i<state.results.length?state.results[i].correct?"bg-threat-low":"bg-threat-high"
            :i===state.current?"bg-cyan-DEFAULT":"bg-bg-raised border border-border-dim")}/>
        ))}
      </div>
    </div>
  );
}
