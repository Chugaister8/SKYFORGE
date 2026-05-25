import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface QuizQuestion {
  id:string; text:string; options:string[]; correct:number; explain:string;
}
export interface QuizResult {
  questionId:string; selected:number; correct:boolean; timeMs:number;
}
export interface QuizState {
  questions:QuizQuestion[]; current:number; results:QuizResult[];
  started:boolean; finished:boolean; timeLeft:number; totalTime:number;
  score:number; grade:string; saving:boolean; saved:boolean;
}

const QUIZZES:Record<string,QuizQuestion[]>={
  "fpv-basic":[
    {id:"q1",text:"What does OSD stand for in FPV systems?",options:["On-Screen Display","Optical Sensor Device","Output Signal Driver","Onboard System Diagnostic"],correct:0,explain:"OSD overlays flight data (voltage, speed, altitude) onto the video feed in real-time."},
    {id:"q2",text:"What should you do immediately when RC signal is lost?",options:["Panic and increase throttle","Wait — failsafe RTH activates automatically","Manually fly back","Cut throttle to 0"],correct:1,explain:"Modern FCs have configurable failsafe that triggers RTH after a set timeout (typically 3-5s)."},
    {id:"q3",text:"What causes toilet-bowl effect on a quadrotor?",options:["Low battery","Compass miscalibration","Bent propeller","High wind"],correct:1,explain:"Compass error causes the FC to have incorrect heading reference, leading to circular positional drift."},
    {id:"q4",text:"Minimum safe battery voltage per LiPo cell under load?",options:["3.0V","3.5V","3.7V","4.2V"],correct:1,explain:"3.5V/cell is the minimum under load. Going below this permanently damages cells and reduces capacity."},
    {id:"q5",text:"Which ESC protocol has the lowest latency?",options:["PWM","PPM","DSHOT600","Oneshot125"],correct:2,explain:"DSHOT is digital with no calibration needed. DSHOT600 sends 600kbit/s — lower latency than all analog protocols."},
  ],
  "ew-awareness":[
    {id:"q1",text:"What is the J/S ratio in EW?",options:["Jammer-to-Signal power ratio","Joint-Strike metric","Jamming Spectrum range","Junction Sensitivity index"],correct:0,explain:"J/S (Jammer-to-Signal) ratio determines jamming effectiveness. Higher J/S = more effective jamming of target signal."},
    {id:"q2",text:"GPS spoofing differs from jamming because:",options:["It uses more power","It injects false coordinates instead of blocking signal","It only affects military GPS","It requires line-of-sight only"],correct:1,explain:"Spoofing sends counterfeit GPS signal with false coordinates. The receiver thinks it has a valid fix but reports wrong location."},
    {id:"q3",text:"Which navigation method is MOST resistant to GPS jamming?",options:["GPS+GLONASS dual constellation","INS (Inertial Navigation System)","Visual odometry","Barometric altitude hold only"],correct:1,explain:"INS uses accelerometers and gyroscopes to dead-reckon position. No external signal needed, though drift accumulates over time."},
    {id:"q4",text:"Friis transmission equation: signal power drops with distance as:",options:["1/d","1/d²","1/d³","1/d⁴"],correct:1,explain:"Free-space path loss follows 1/d² (inverse square law). Pr = Pt × Gt × Gr × (λ/4πd)²."},
    {id:"q5",text:"Primary countermeasure against GPS spoofing:",options:["Higher GPS sensitivity receiver","Cross-check with INS/baro/visual odometry","Switching to GLONASS only","Flying at lower altitude"],correct:1,explain:"Cross-referencing GPS with independent sensors detects the inconsistency introduced by a spoofed position signal."},
  ],
  "isr-tactical":[
    {id:"q1",text:"What does ISR stand for?",options:["Intelligence, Surveillance, Reconnaissance","Integrated Signal Reception","Inertial Sensor Reference","Internal Systems Review"],correct:0,explain:"ISR missions gather intelligence through persistent surveillance and reconnaissance of designated areas and targets."},
    {id:"q2",text:"Loiter time for a fixed-wing ISR UAV is maximized by:",options:["Maximum throttle","Flying at best L/D ratio speed","Minimum altitude","Maximum altitude"],correct:1,explain:"Best L/D ratio speed maximizes aerodynamic efficiency and minimizes power consumption for maximum endurance."},
    {id:"q3",text:"EO/IR sensor slant range is primarily limited by:",options:["Battery capacity","Atmosphere, pixel resolution, and target size","GPS accuracy","Wind speed at altitude"],correct:1,explain:"Slant range depends on sensor GSD (ground sampling distance), atmospheric clarity, and the minimum detectable target size."},
    {id:"q4",text:"SALUTE format in target reporting stands for:",options:["Size, Activity, Location, Unit, Time, Equipment","Signal, Altitude, Location, Unit, Threat, Estimate","Size, Azimuth, Location, Uniform, Type, Equipment","System, Activity, Laser, Unit, Target, Engagement"],correct:0,explain:"SALUTE: Size, Activity, Location, Unit, Time, Equipment — standard NATO target report format used by all coalition forces."},
    {id:"q5",text:"Which orbit pattern provides best area coverage for ISR?",options:["Figure-8","Racetrack (orbit)","Random search","Straight transects"],correct:1,explain:"Racetrack orbit (circular loiter) around a point of interest provides persistent coverage and predictable sensor footprint."},
  ],
  "fpv-strike":[
    {id:"q1",text:"NOE flight profile means:",options:["Normal Operating Elevation","Nap-of-the-Earth — terrain-following at minimum altitude","Night Optical Equipment mode","No Overflight Exclusion zone"],correct:1,explain:"NOE exploits terrain masking to reduce radar cross-section and visual detection while maintaining forward momentum."},
    {id:"q2",text:"For a strike FPV, optimal dive angle for terminal phase is typically:",options:["15°","30°","45°","90° (vertical)"],correct:2,explain:"45° balances speed gain and targeting accuracy. Steeper angles increase terminal velocity but reduce correction time."},
    {id:"q3",text:"FPV video feed latency above which precise control degrades severely:",options:["50ms","100ms","200ms","500ms"],correct:2,explain:"Latency above ~200ms creates problematic feedback loop delay for high-speed, precision maneuvers in terminal phase."},
    {id:"q4",text:"Primary anti-FPV electronic countermeasure target:",options:["GPS receiver","Video/RC link at 5.8GHz/433MHz","Altimeter","Motor ESC"],correct:1,explain:"FPV uses 5.8GHz analog video and 433MHz/2.4GHz RC links. Jamming these frequencies disrupts both control and situational awareness."},
    {id:"q5",text:"Shaped charge effectiveness is primarily dependent on:",options:["Impact velocity","Standoff distance from target","Total charge weight","Angle of impact"],correct:1,explain:"Monroe effect requires optimal standoff distance for the penetrating jet to form correctly. Wrong standoff reduces penetration."},
  ],
  "mission-cmd":[
    {id:"q1",text:"OODA loop stands for:",options:["Observe, Orient, Decide, Act","Operation, Order, Deploy, Assess","Observe, Order, Direct, Attack","Optimize, Orient, Defend, Advance"],correct:0,explain:"Colonel Boyd's decision framework. Inside the enemy's OODA loop means making decisions faster than they can react."},
    {id:"q2",text:"In multi-UAV ops, C2 link loss should trigger:",options:["All UAVs land immediately","Pre-planned autonomous fallback behavior","Random RTH by all assets","Continue mission indefinitely"],correct:1,explain:"Each UAV should have pre-programmed contingency: RTH, loiter, or continue to next waypoint, depending on mission phase."},
    {id:"q3",text:"SEAD stands for:",options:["Strike and Engage Air Defense","Suppression of Enemy Air Defenses","Sensor Enhanced Attack Doctrine","Systematic EW and Air Denial"],correct:1,explain:"SEAD missions neutralize or suppress enemy radar and SAM systems to enable friendly air operations in the AO."},
    {id:"q4",text:"METT-TC in mission planning stands for:",options:["Mission, Enemy, Terrain, Troops, Time, Civilians","Military Equipment, Target Type, Threat Class","Mission Essential Task Training Criteria","Multi-echelon Tactical Training Cycle"],correct:0,explain:"METT-TC: Mission, Enemy, Terrain & weather, Troops available, Time, Civilian considerations — standard Army planning framework."},
    {id:"q5",text:"AAR (After Action Review) is conducted:",options:["Only after failed missions","Before the mission as a pre-mortem","Immediately after every mission","Monthly by commanders only"],correct:2,explain:"AAR is conducted immediately after every mission while events are fresh. Captures successes, failures, and lessons learned for all participants."},
  ],
  "male-systems":[
    {id:"q1",text:"MTOW stands for:",options:["Maximum Take-Off Weight","Minimum Thrust-to-Weight ratio","Mean Time On Watch","Maximum Transmission Output Wattage"],correct:0,explain:"MTOW is the maximum certified weight at which the aircraft may take off, including fuel, payload, and all equipment."},
    {id:"q2",text:"SAR (Synthetic Aperture Radar) primary advantage over EO sensors:",options:["Better color resolution","Can penetrate clouds and operate in darkness","Lower cost and weight","Higher pixel count"],correct:1,explain:"SAR uses radar wavelengths (cm-band) that penetrate clouds, smoke, and darkness, providing all-weather day/night imagery."},
    {id:"q3",text:"Pneumatic de-icing systems work by:",options:["Heating leading edges electrically","Inflating/deflating rubber boots to crack ice","Chemical TKS fluid weeping","Ultrasonic vibration of skin"],correct:1,explain:"Pneumatic boots cyclically inflate to break off accumulated ice on leading edges, then deflate to restore aerodynamic shape."},
    {id:"q4",text:"MTBF stands for:",options:["Maximum Thrust Before Failure","Mean Time Between Failures","Mission Task Backup Function","Minimum Takeoff Before Fueling"],correct:1,explain:"MTBF is the average time between system failures in a repairable system. Key reliability and maintenance planning metric."},
    {id:"q5",text:"Aspect ratio of a wing primarily affects:",options:["Maximum speed","Induced drag and lift-to-drag ratio","Roll rate","Structural weight"],correct:1,explain:"High aspect ratio wings (long and narrow) have lower induced drag and higher L/D ratio — ideal for MALE endurance missions."},
  ],
};

function _grade(pct:number):string{
  return pct>=95?"S":pct>=85?"A":pct>=75?"B":pct>=65?"C":"F";
}

export function useQuiz(courseId:string, moduleId:string, timeLimitS:number=300){
  const{accessToken:token}=useAuthStore();
  const questions=QUIZZES[courseId]??[];
  const[state,setState]=useState<QuizState>({
    questions,current:0,results:[],started:false,finished:false,
    timeLeft:timeLimitS,totalTime:timeLimitS,score:0,grade:"F",saving:false,saved:false,
  });
  const timerRef=useRef<NodeJS.Timeout|null>(null);
  const startTime=useRef<number>(0);

  const start=useCallback(()=>{
    setState(s=>({...s,started:true,timeLeft:timeLimitS,results:[],current:0,finished:false,score:0,saved:false}));
    startTime.current=Date.now();
    timerRef.current=setInterval(()=>{
      setState(s=>{
        if(s.timeLeft<=1){
          clearInterval(timerRef.current!);
          const pct=s.results.length>0?Math.round(s.results.filter(r=>r.correct).length/s.questions.length*100):0;
          return{...s,timeLeft:0,finished:true,score:pct,grade:_grade(pct)};
        }
        return{...s,timeLeft:s.timeLeft-1};
      });
    },1000);
  },[timeLimitS]);

  const answer=useCallback((selected:number)=>{
    setState(s=>{
      if(s.finished||s.current>=s.questions.length) return s;
      const q=s.questions[s.current];
      const result:QuizResult={questionId:q.id,selected,correct:selected===q.correct,timeMs:Date.now()-startTime.current};
      const results=[...s.results,result];
      const next=s.current+1;
      if(next>=s.questions.length){
        clearInterval(timerRef.current!);
        const pct=Math.round(results.filter(r=>r.correct).length/s.questions.length*100);
        return{...s,results,current:next,finished:true,score:pct,grade:_grade(pct)};
      }
      return{...s,results,current:next};
    });
  },[]);

  // Save result to backend
  const saveResult=useCallback(async(score:number, grade:string, passScore:number):Promise<{passed:boolean;canCertify:boolean;courseComplete:boolean}>=>{
    if(!token) return{passed:false,canCertify:false,courseComplete:false};
    setState(s=>({...s,saving:true}));
    try{
      const res=await api.post<any>(`/training/courses/${courseId}/module`,{
        module_id:moduleId, completed:true, score,
        time_spent_s:Math.round((Date.now()-startTime.current)/1000),
        answers:[], // could pass detailed answers
      },token);
      setState(s=>({...s,saving:false,saved:true}));
      return{passed:res.passed??false,canCertify:res.can_certify??false,courseComplete:res.course_complete??false};
    }catch{
      setState(s=>({...s,saving:false}));
      return{passed:score>=passScore,canCertify:false,courseComplete:false};
    }
  },[token,courseId,moduleId]);

  const claimCert=useCallback(async():Promise<{cert_number:string;grade:string}|null>=>{
    if(!token) return null;
    try{
      const res=await api.post<any>(`/training/courses/${courseId}/certify`,{},token);
      return{cert_number:res.cert_number,grade:res.grade};
    }catch(e:any){
      console.error("cert error",e);
      return null;
    }
  },[token,courseId]);

  const restart=useCallback(()=>{
    clearInterval(timerRef.current!);
    setState(s=>({...s,started:false,finished:false,current:0,results:[],score:0,grade:"F",timeLeft:timeLimitS,saved:false}));
  },[timeLimitS]);

  return{state,questions,start,answer,restart,saveResult,claimCert};
}
