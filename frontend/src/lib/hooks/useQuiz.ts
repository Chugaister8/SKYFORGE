import { useState, useCallback, useRef } from "react";

export interface QuizQuestion {
  id:      string;
  text:    string;
  options: string[];
  correct: number;       // index 0-3
  explain: string;
}

export interface QuizResult {
  questionId: string;
  selected:   number;
  correct:    boolean;
  timeMs:     number;
}

export interface QuizState {
  questions:   QuizQuestion[];
  current:     number;
  results:     QuizResult[];
  started:     boolean;
  finished:    boolean;
  timeLeft:    number;
  totalTime:   number;
  score:       number;
  grade:       string;
}

// Quizzes per course
const QUIZZES: Record<string, QuizQuestion[]> = {
  "fpv-basic": [
    {id:"q1",text:"What does OSD stand for in FPV systems?",options:["On-Screen Display","Optical Sensor Device","Output Signal Driver","Onboard System Diagnostic"],correct:0,explain:"OSD overlays flight data (voltage, speed, altitude) onto the video feed."},
    {id:"q2",text:"What should you do immediately when RC signal is lost?",options:["Panic and increase throttle","Wait — failsafe RTH activates automatically","Manually fly back","Cut throttle to 0"],correct:1,explain:"Modern FCs have configurable failsafe that triggers RTH after a set timeout (typically 3-5s)."},
    {id:"q3",text:"What causes toilet-bowl effect on a quadrotor?",options:["Low battery","Compass miscalibration","Bent propeller","High wind"],correct:1,explain:"Compass error causes the FC to have incorrect heading reference, leading to circular drift."},
    {id:"q4",text:"Minimum safe battery voltage per cell (LiPo)?",options:["3.0V","3.5V","3.7V","4.2V"],correct:1,explain:"3.5V/cell is the minimum under load. Going below damages cells permanently."},
    {id:"q5",text:"Which ESC protocol has the lowest latency?",options:["PWM","PPM","DSHOT600","Oneshot125"],correct:2,explain:"DSHOT is a digital protocol. DSHOT600 sends 600kbit/s with no calibration needed and lower latency than analog protocols."},
  ],
  "ew-awareness": [
    {id:"q1",text:"What is the J/S ratio in EW?",options:["Jammer-to-Signal power ratio","Joint-Strike metric","Jamming Spectrum range","Junction Sensitivity"],correct:0,explain:"J/S (Jammer-to-Signal) ratio determines jamming effectiveness. Higher J/S = more effective jamming."},
    {id:"q2",text:"GPS spoofing differs from jamming because:",options:["It uses more power","It injects false coordinates instead of blocking signal","It only affects military GPS","It requires line-of-sight"],correct:1,explain:"Spoofing sends a counterfeit GPS signal with false coordinates. The receiver thinks it has a valid fix but at the wrong location."},
    {id:"q3",text:"Which UAV navigation method is MOST resistant to GPS jamming?",options:["GPS+GLONASS dual constellation","INS (Inertial Navigation System)","Visual odometry","Barometric altitude hold"],correct:1,explain:"INS uses accelerometers and gyroscopes to dead-reckon position. No external signal needed, though it drifts over time."},
    {id:"q4",text:"Friis transmission equation relates signal power to:",options:["Frequency only","Distance only","Transmit power, gain, distance, and frequency","Battery voltage"],correct:2,explain:"Friis: Pr = Pt × Gt × Gr × (λ/4πd)². Power drops with d² and increases with frequency wavelength."},
    {id:"q5",text:"What is the primary countermeasure against GPS spoofing?",options:["Higher GPS sensitivity","Cross-check with INS/baro/visual","Switching to GLONASS","Flying lower altitude"],correct:1,explain:"Cross-referencing GPS position with independent sensors (INS, barometer, visual odometry) detects the inconsistency of a spoofed position."},
  ],
  "isr-tactical": [
    {id:"q1",text:"What does ISR stand for?",options:["Intelligence, Surveillance, Reconnaissance","Integrated Signal Reception","Inertial Sensor Reference","Internal Systems Review"],correct:0,explain:"ISR missions gather intelligence through persistent surveillance and reconnaissance of targets."},
    {id:"q2",text:"Loiter time for a fixed-wing ISR UAV is maximized by:",options:["Maximum throttle","Flying at best L/D (lift-to-drag) ratio speed","Minimum altitude","Maximum altitude"],correct:1,explain:"Best L/D ratio speed maximizes aerodynamic efficiency and minimizes power consumption, extending endurance."},
    {id:"q3",text:"EO/IR sensor slant range is limited by:",options:["Battery only","Atmosphere, pixel resolution, and target size","GPS accuracy","Wind speed"],correct:1,explain:"Slant range depends on sensor resolution (GSD), atmospheric clarity, and the minimum detectable target size."},
    {id:"q4",text:"TPOD stands for?",options:["Tactical Payload On Demand","Targeting Pod","Thermal Passive Optical Device","Terrain Profile On Display"],correct:1,explain:"A Targeting Pod is a multi-sensor EO/IR/laser pod used for ISR and target designation."},
    {id:"q5",text:"When reporting a target, SALUTE format stands for:",options:["Size, Activity, Location, Unit, Time, Equipment","Signal, Altitude, Location, Unit, Threat, Estimate","Size, Azimuth, Location, Uniform, Type, Equipment","System, Activity, Laser, Unit, Target, Engagement"],correct:0,explain:"SALUTE: Size, Activity, Location, Unit, Time, Equipment — standard NATO target report format."},
  ],
  "fpv-strike":[
    {id:"q1",text:"NOE flight profile means:",options:["Normal Operating Elevation","Nap-of-the-Earth — terrain-following at minimum altitude","Night Optical Equipment","No Overflight Exclusion"],correct:1,explain:"NOE exploits terrain masking to reduce radar and visual detection."},
    {id:"q2",text:"For a strike FPV, dive angle for maximum terminal velocity is typically:",options:["15°","30°","45°","90° (vertical)"],correct:2,explain:"45° balances speed gain and accuracy. Steeper angles increase terminal velocity but reduce time for corrections."},
    {id:"q3",text:"Shaped charge effectiveness against armor depends primarily on:",options:["Impact velocity","Standoff distance","Charge weight","Angle of impact"],correct:1,explain:"Monroe effect requires optimal standoff distance for the jet to form properly. Too close or far reduces penetration."},
    {id:"q4",text:"FPV feed latency above which control becomes unreliable:",options:["50ms","100ms","200ms","500ms"],correct:2,explain:"Latency above ~200ms makes precise control in high-speed maneuvers very difficult due to feedback loop delay."},
    {id:"q5",text:"Primary anti-FPV EW measure is:",options:["SAM missiles","GPS jamming","Video/RC link jamming at 5.8GHz/433MHz","Laser dazzling"],correct:2,explain:"FPV systems use 5.8GHz video and 433MHz or 2.4GHz RC links. Jamming these frequencies disrupts control and video feed."},
  ],
  "mission-cmd":[
    {id:"q1",text:"OODA loop stands for:",options:["Observe, Orient, Decide, Act","Operation, Order, Deploy, Assess","Observe, Order, Direct, Attack","Optimize, Orient, Defend, Advance"],correct:0,explain:"Colonel Boyd's decision framework: Observe → Orient → Decide → Act. Faster OODA loops give tactical advantage."},
    {id:"q2",text:"In multi-UAV ops, loss of C2 link should trigger:",options:["All UAVs land immediately","Pre-planned autonomous fallback behavior","Random RTH","Continue mission indefinitely"],correct:1,explain:"Each UAV should have pre-programmed contingency behavior (RTH, loiter, or continue to next waypoint) for C2 loss."},
    {id:"q3",text:"SEAD stands for:",options:["Strike and Engage Air Defense","Suppression of Enemy Air Defenses","Sensor Enhanced Attack Doctrine","Systematic EW and Air Denial"],correct:1,explain:"SEAD missions neutralize or suppress enemy radar and SAM systems to enable friendly air operations."},
    {id:"q4",text:"Priority of effort in mission planning (METT-TC):",options:["Mission, Enemy, Terrain, Troops, Time, Civilians","Military Equipment, Target Type, Threat Class","Mission Essential Task Training Criteria","Multi-echelon Tactical Training Cycle"],correct:0,explain:"METT-TC: Mission, Enemy, Terrain & weather, Troops available, Time, Civilian considerations."},
    {id:"q5",text:"After Action Review (AAR) is conducted:",options:["Only after failed missions","Before the mission","Immediately after every mission","Monthly by commanders only"],correct:2,explain:"AAR is conducted immediately after every mission while events are fresh. Captures successes, failures, and lessons learned."},
  ],
  "male-systems":[
    {id:"q1",text:"MTOW stands for:",options:["Maximum Take-Off Weight","Minimum Thrust-to-Weight","Mean Time On Watch","Maximum Transmission Output Wattage"],correct:0,explain:"MTOW is the maximum certified weight at which the aircraft may take off, including fuel and payload."},
    {id:"q2",text:"Turboprop engines in MALE UAVs use which fuel?",options:["AVGAS (100LL)","Jet-A / JP-8","Diesel","Mogas"],correct:1,explain:"MALE UAVs like Bayraktar TB2 use Rotax 912 (AVGAS) but larger MALE like Predator use Jet-A for turboprop engines."},
    {id:"q3",text:"Pneumatic anti-icing systems work by:",options:["Heating leading edges electrically","Inflating/deflating rubber boots to crack ice","Chemical fluid flow","Ultrasonic vibration"],correct:1,explain:"Pneumatic de-icing boots cyclically inflate to break off accumulated ice on leading edges."},
    {id:"q4",text:"Synthetic Aperture Radar (SAR) advantage over EO:",options:["Better color resolution","Can penetrate clouds and darkness","Lower cost","Lighter weight"],correct:1,explain:"SAR uses radar wavelengths that penetrate clouds, smoke, and darkness, providing all-weather day/night imagery."},
    {id:"q5",text:"MTBF stands for:",options:["Maximum Thrust Before Failure","Mean Time Between Failures","Mission Task Backup Function","Minimum Takeoff Before Fueling"],correct:1,explain:"MTBF is the average time between system failures. Higher MTBF = more reliable system. Key maintenance metric."},
  ],
};

function _grade(pct:number):string{
  if(pct>=95) return "S";
  if(pct>=85) return "A";
  if(pct>=75) return "B";
  if(pct>=65) return "C";
  return "F";
}

export function useQuiz(courseId:string, moduleId:string, timeLimitS:number=300){
  const questions = QUIZZES[courseId] ?? [];
  const[state,setState]=useState<QuizState>({
    questions,current:0,results:[],started:false,finished:false,
    timeLeft:timeLimitS,totalTime:timeLimitS,score:0,grade:"F",
  });
  const timerRef=useRef<NodeJS.Timeout|null>(null);
  const startTime=useRef<number>(0);

  const start=useCallback(()=>{
    setState(s=>({...s,started:true,timeLeft:timeLimitS,results:[],current:0,finished:false,score:0}));
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
      const result:QuizResult={
        questionId:q.id, selected,
        correct:selected===q.correct,
        timeMs:Date.now()-startTime.current,
      };
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

  const restart=useCallback(()=>{
    clearInterval(timerRef.current!);
    setState(s=>({...s,started:false,finished:false,current:0,results:[],score:0,grade:"F",timeLeft:timeLimitS}));
  },[timeLimitS]);

  return{state,questions,start,answer,restart};
}
