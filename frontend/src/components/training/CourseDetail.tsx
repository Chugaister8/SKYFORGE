"use client";
import { useState } from "react";
import { clsx } from "clsx";
import {
  ChevronLeft, Play, CheckCircle, Clock, Award, BookOpen,
  Cpu, HelpCircle, Wrench, Loader2, Lock,
} from "lucide-react";
import { QuizEngine } from "./QuizEngine";
import {
  useCourse, useStartCourse, useCompleteModule, useCertify,
} from "@/lib/hooks/useTraining";
import type { Course } from "@/lib/hooks/useTraining";

const MOD_ICONS: Record<string,any> = {
  theory: BookOpen, simulator: Cpu, quiz: HelpCircle, practical: Wrench,
};
const MOD_CLR: Record<string,string> = {
  theory:"text-cyan-DEFAULT", simulator:"text-threat-low",
  quiz:"text-threat-medium",  practical:"text-purple-400",
};
const DIFF_CLR: Record<string,string> = {
  BEGINNER:"text-threat-low",   INTERMEDIATE:"text-cyan-DEFAULT",
  ADVANCED:"text-threat-medium", EXPERT:"text-threat-high",
};
const GRADE_CLR: Record<string,string> = {
  S:"text-purple-400", A:"text-threat-low", B:"text-cyan-DEFAULT",
  C:"text-threat-medium", F:"text-threat-high",
};

function grade(s: number): string {
  return s>=95?"S":s>=85?"A":s>=75?"B":s>=65?"C":"F";
}

interface Props {
  course:   Course;
  progress: any;   // from parent (may be stale)
  onBack:   () => void;
  onStart:  () => void;
}

export function CourseDetail({ course, onBack }: Props) {
  // Fetch live progress from backend
  const { data, isLoading, refetch } = useCourse(course.id);
  const startCourse    = useStartCourse();
  const completeModule = useCompleteModule();
  const certify        = useCertify();

  const progress   = data?.progress;
  const moduleData = progress?.module_data ?? {};
  const pct        = progress?.progress_pct ?? 0;
  const completed  = progress?.completed ?? false;
  const score      = progress?.score ?? 0;

  const [quizModule, setQuizModule] = useState<{
    id: string; title: string; passScore: number;
  } | null>(null);
  const [theoryModule, setTheoryModule] = useState<string | null>(null);
  const [certResult, setCertResult]     = useState<{ cert_number: string; grade: string } | null>(null);

  const handleStart = async () => {
    if (!progress) await startCourse.mutateAsync(course.id);
  };

  const handleQuizComplete = async (moduleId: string, s: number, _g: string, timeS: number) => {
    setQuizModule(null);
    await completeModule.mutateAsync({
      courseId: course.id, moduleId, score: s, timeSpentS: timeS,
    });
    refetch();
  };

  const handleTheoryDone = async (moduleId: string) => {
    setTheoryModule(null);
    await completeModule.mutateAsync({
      courseId: course.id, moduleId, score: 100, timeSpentS: 120,
    });
    refetch();
  };

  const handleCertify = async () => {
    try {
      const res = await certify.mutateAsync(course.id);
      setCertResult(res);
    } catch (e: any) {
      alert(e.message ?? "Certification failed");
    }
  };

  // Show quiz
  if (quizModule) {
    return (
      <QuizEngine
        courseId={course.id}
        moduleId={quizModule.id}
        moduleTitle={quizModule.title}
        passScore={quizModule.passScore}
        onBack={() => setQuizModule(null)}
        onComplete={(s, _g, timeS) => handleQuizComplete(quizModule.id, s, _g, timeS)}
      />
    );
  }

  // Show theory module reader
  if (theoryModule) {
    const mod = course.modules.find(m => m.id === theoryModule)!;
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border-dim flex items-center gap-3">
          <button onClick={() => setTheoryModule(null)}
            className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-mono text-xs transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5}/>BACK
          </button>
          <span className="font-mono text-xs text-text-primary">{mod.title}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg space-y-4">
            <p className="font-mono text-xs text-text-secondary tracking-widest">
              {course.title} — {mod.title}
            </p>
            <h2 className="font-mono text-sm text-text-primary font-medium">{mod.title}</h2>
            <div className="bg-bg-raised border border-border-dim rounded p-4 font-mono text-xs text-text-secondary leading-relaxed space-y-3">
              <p>Estimated reading time: {mod.duration_min} minutes</p>
              <p className="text-text-dim italic">
                [Module content loaded from training database]
              </p>
              <p>
                Complete all theory modules to unlock quiz assessments.
                Review the material carefully before attempting the assessment.
              </p>
            </div>
            <button
              onClick={() => handleTheoryDone(mod.id)}
              disabled={completeModule.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 rounded border border-threat-low bg-threat-low/10 text-threat-low font-mono text-xs tracking-widest hover:bg-threat-low/20 transition-all disabled:opacity-60"
            >
              {completeModule.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>SAVING...</>
                : <><CheckCircle className="w-3.5 h-3.5"/>MARK COMPLETE</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Cert issued
  if (certResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8">
        <Award className="w-12 h-12 text-threat-low" strokeWidth={1}/>
        <div className="text-center">
          <p className="font-mono text-xs text-text-secondary mb-1 tracking-widest">CERTIFICATE ISSUED</p>
          <p className="font-mono text-lg text-text-primary font-medium">{course.title}</p>
          <p className="font-mono text-sm text-threat-low mt-1">{certResult.cert_number}</p>
          <p className={clsx("font-mono text-3xl font-bold mt-2", GRADE_CLR[certResult.grade])}>
            {certResult.grade}
          </p>
        </div>
        <button onClick={onBack}
          className="font-mono text-xs text-text-secondary hover:text-text-primary transition-colors">
          ← Back to courses
        </button>
      </div>
    );
  }

  // ── Main course view ──────────────────────────────────────────
  // Which modules are unlocked (sequential unlock)
  const isUnlocked = (idx: number): boolean => {
    if (idx === 0) return true;
    const prev = course.modules[idx - 1];
    const prevDone = moduleData[prev.id]?.completed ?? false;
    return prevDone || !!(progress); // unlocked if started
  };

  const canCertify = completed && score >= Math.max(
    ...course.modules
      .filter(m => m.type === "quiz" || m.type === "practical")
      .map(m => m.pass_score ?? 70),
    70,
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border-dim shrink-0">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-mono text-xs mb-3 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5}/>COURSES
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-2xs text-text-secondary tracking-widest">{course.category}</span>
              <span className={clsx("font-mono text-2xs", DIFF_CLR[course.difficulty])}>{course.difficulty}</span>
            </div>
            <h2 className="font-mono text-base text-text-primary font-medium">{course.title}</h2>
          </div>
          {completed && (
            <div className="flex items-center gap-2 shrink-0">
              <Award className="w-5 h-5 text-threat-low" strokeWidth={1.5}/>
              <div className="text-right">
                <p className="font-mono text-2xs text-threat-low">COMPLETED</p>
                <p className={clsx("font-mono text-sm font-medium", GRADE_CLR[grade(score)])}>
                  {grade(score)} · {score}pts
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="font-mono text-xs text-text-secondary mt-2 leading-relaxed">
          {course.description}
        </p>

        {/* Progress bar */}
        {pct > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-2xs text-text-dim">Progress</span>
              <span className="font-mono text-2xs text-text-secondary">{Math.round(pct)}%</span>
            </div>
            <div className="h-1.5 bg-bg-base rounded overflow-hidden">
              <div
                className={clsx("h-full rounded transition-all", completed ? "bg-threat-low" : "bg-cyan-DEFAULT")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleStart}
            disabled={startCourse.isPending || isLoading}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded border font-mono text-xs tracking-widest transition-all",
              completed
                ? "border-threat-low/50 bg-threat-low/10 text-threat-low"
                : "border-border-active bg-cyan-subtle text-cyan-DEFAULT hover:shadow-cyan",
              (startCourse.isPending || isLoading) && "opacity-60 cursor-not-allowed",
            )}
          >
            {isLoading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>LOADING</>
              : <><Play className="w-3.5 h-3.5" strokeWidth={1.5}/>
                  {completed ? "REVIEW" : pct > 0 ? "CONTINUE" : "START COURSE"}</>
            }
          </button>

          {canCertify && (
            <button
              onClick={handleCertify}
              disabled={certify.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded border border-threat-low bg-threat-low/10 text-threat-low font-mono text-xs tracking-widest hover:bg-threat-low/20 transition-all disabled:opacity-60"
            >
              {certify.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                : <Award className="w-3.5 h-3.5" strokeWidth={1.5}/>}
              CERTIFY
            </button>
          )}
        </div>
      </div>

      {/* Module list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <p className="font-mono text-2xs text-text-secondary tracking-widest mb-3">
          MODULES ({course.modules.length})
        </p>

        {course.modules.map((mod, idx) => {
          const Icon   = MOD_ICONS[mod.type] ?? BookOpen;
          const color  = MOD_CLR[mod.type] ?? "text-text-secondary";
          const md     = moduleData[mod.id];
          const done   = md?.completed ?? false;
          const modScore = md?.score ?? 0;
          const unlocked = isUnlocked(idx);
          const isAssessment = mod.type === "quiz" || mod.type === "practical";

          return (
            <button
              key={mod.id}
              disabled={!unlocked || completeModule.isPending}
              onClick={() => {
                if (!unlocked) return;
                if (isAssessment) {
                  setQuizModule({ id: mod.id, title: mod.title, passScore: mod.pass_score ?? 70 });
                } else {
                  setTheoryModule(mod.id);
                }
              }}
              className={clsx(
                "w-full flex items-center gap-3 p-3 rounded border text-left transition-all",
                done
                  ? "border-threat-low/40 bg-threat-low/5"
                  : unlocked
                  ? "border-border-dim hover:border-border-active bg-bg-raised hover:bg-bg-surface"
                  : "border-border-dim bg-bg-base opacity-50 cursor-not-allowed",
              )}
            >
              <div className={clsx(
                "w-7 h-7 rounded flex items-center justify-center shrink-0",
                done ? "bg-threat-low/15" : "bg-bg-surface",
              )}>
                {done
                  ? <CheckCircle className="w-4 h-4 text-threat-low" strokeWidth={1.5}/>
                  : !unlocked
                  ? <Lock className="w-4 h-4 text-text-dim" strokeWidth={1.5}/>
                  : <Icon className={clsx("w-4 h-4", color)} strokeWidth={1.5}/>
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={clsx(
                    "font-mono text-xs font-medium",
                    done ? "text-threat-low" : "text-text-primary",
                  )}>
                    {idx + 1}. {mod.title}
                  </p>
                  {isAssessment && mod.pass_score && (
                    <span className="font-mono text-2xs text-text-dim">
                      pass {mod.pass_score}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={clsx("font-mono text-2xs capitalize", color)}>
                    {mod.type}
                  </span>
                  <span className="font-mono text-2xs text-text-dim">·</span>
                  <Clock className="w-2.5 h-2.5 text-text-dim" strokeWidth={1.5}/>
                  <span className="font-mono text-2xs text-text-dim">{mod.duration_min} min</span>
                  {md?.attempts > 0 && (
                    <>
                      <span className="font-mono text-2xs text-text-dim">·</span>
                      <span className="font-mono text-2xs text-text-dim">{md.attempts} attempt{md.attempts !== 1 ? "s" : ""}</span>
                    </>
                  )}
                </div>
              </div>

              {done && isAssessment && (
                <span className={clsx("font-mono text-sm font-medium shrink-0", GRADE_CLR[grade(modScore)])}>
                  {modScore}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
