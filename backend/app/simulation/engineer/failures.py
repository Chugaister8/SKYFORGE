from dataclasses import dataclass, field
from enum import Enum
import random

class FailureCategory(str, Enum):
    HARDWARE="HARDWARE"; AVIONICS="AVIONICS"; COMMS="COMMS"
    PROPULSION="PROPULSION"; SENSOR="SENSOR"; STRUCTURAL="STRUCTURAL"

class FailureSeverity(str, Enum):
    MINOR="MINOR"; MODERATE="MODERATE"; CRITICAL="CRITICAL"; FATAL="FATAL"

@dataclass
class FailureEvent:
    id:str; name:str; category:FailureCategory; severity:FailureSeverity
    description:str; symptoms:list[str]; procedures:list[str]; probability:float=0.01
    thrust_loss_pct:float=0.0; control_loss_pct:float=0.0
    sensor_loss:list[str]=field(default_factory=list); comms_loss_pct:float=0.0; can_continue:bool=True

FAILURE_LIBRARY:dict[str,FailureEvent]={
    "motor_single":FailureEvent("motor_single","Single Motor Failure",FailureCategory.PROPULSION,FailureSeverity.MODERATE,
        "One motor fails. Controllable but reduced performance.",
        ["Vibration increase","Yaw drift","Altitude instability"],["Reduce throttle","Engage failsafe","Initiate RTH","Land ASAP"],
        thrust_loss_pct=25,control_loss_pct=15,can_continue=True),
    "motor_dual":FailureEvent("motor_dual","Dual Motor Failure",FailureCategory.PROPULSION,FailureSeverity.CRITICAL,
        "Two motors fail. Quadrotor uncontrollable.",
        ["Severe instability","Rapid descent","Loss of attitude control"],["MAYDAY","Full throttle remaining","Controlled descent"],
        thrust_loss_pct=50,control_loss_pct=60,can_continue=False),
    "esc_overheat":FailureEvent("esc_overheat","ESC Thermal Shutdown",FailureCategory.HARDWARE,FailureSeverity.MODERATE,
        "ESC overheats and throttles down.",
        ["Motor stuttering","Altitude loss","ESC temperature alert"],["Reduce throttle","Climb to cooler altitude","Initiate RTH"],
        thrust_loss_pct=20,can_continue=True),
    "battery_cell":FailureEvent("battery_cell","Battery Cell Failure",FailureCategory.HARDWARE,FailureSeverity.CRITICAL,
        "Battery cell fails causing voltage sag.",
        ["Rapid voltage drop","Low battery warning"],["Immediate RTH","Reduce payload","Prepare forced landing"],
        thrust_loss_pct=30,can_continue=False),
    "gps_loss":FailureEvent("gps_loss","GPS Signal Loss",FailureCategory.AVIONICS,FailureSeverity.MODERATE,
        "GPS lost, falls back to altitude hold and manual.",
        ["GPS fix lost","Position uncertainty"],["Switch to manual","Use visual references","Land if disoriented"],
        sensor_loss=["GPS"],can_continue=True),
    "compass_interference":FailureEvent("compass_interference","Compass Interference",FailureCategory.AVIONICS,FailureSeverity.MODERATE,
        "Magnetic interference causes heading drift.",
        ["Yaw drift","Compass error","Circular flight path"],["Switch to GPS heading","Avoid high EMF areas","RTH if severe"],
        control_loss_pct=20,can_continue=True),
    "rc_link_loss":FailureEvent("rc_link_loss","RC Link Loss",FailureCategory.COMMS,FailureSeverity.CRITICAL,
        "Control link lost. Failsafe activates.",
        ["No RC response","Failsafe light"],["Wait 5s reconnect","RTH activates","Monitor telemetry"],
        comms_loss_pct=100,can_continue=True),
    "video_loss":FailureEvent("video_loss","Video Feed Loss",FailureCategory.SENSOR,FailureSeverity.MINOR,
        "EO/video transmission lost.",
        ["Black screen","Video dropout"],["Check transmitter","Switch to secondary","RTH if BVLOS"],
        sensor_loss=["EO"],can_continue=True),
    "airspeed_failure":FailureEvent("airspeed_failure","Airspeed Sensor Failure",FailureCategory.SENSOR,FailureSeverity.MODERATE,
        "Pitot tube failure on fixed-wing.",
        ["Airspeed reads 0","Speed oscillations"],["Switch to GPS speed","Avoid low-speed flight","Land when safe"],
        sensor_loss=["AIRSPEED"],can_continue=True),
    "structural_crack":FailureEvent("structural_crack","Frame Stress Fracture",FailureCategory.STRUCTURAL,FailureSeverity.CRITICAL,
        "Airframe structural damage detected.",
        ["Vibration increase","Flight instability"],["Immediate landing","Avoid aggressive maneuvers","Inspect before next flight"],
        control_loss_pct=25,can_continue=False),
}

def generate_random_failure(uav_class,flight_hours,has_ecm=False):
    candidates=[]
    for f in FAILURE_LIBRARY.values():
        p=f.probability*flight_hours
        if f.category==FailureCategory.COMMS and has_ecm: p*=0.5
        candidates.append((f,p))
    total=sum(p for _,p in candidates)
    if total<=0: return None
    r=random.random()*total; cum=0
    for failure,prob in candidates:
        cum+=prob
        if r<cum: return failure
    return None



def generate_random_failure(uav_class:str, flight_hours:float, has_ecm:bool=False):
    import math
    for f in FAILURE_LIBRARY.values():
        rate=f.probability
        if f.category==FailureCategory.COMMS and has_ecm: rate*=0.5
        if random.random() < (1.0 - math.exp(-rate * flight_hours)):
            return f
    return None
