import math, random, structlog
from app.simulation.swarm.models import SwarmAgent, SwarmTarget, SwarmState, SwarmRole, SwarmBehavior

logger=structlog.get_logger()
EARTH_R=6_371_000.0; DEG_LAT=1.0/111_320.0

def _dlon(lat): return 1.0/(111_320.0*math.cos(math.radians(lat)))
def _dist(lat1,lon1,lat2,lon2):
    p=math.pi/180
    a=(math.sin((lat2-lat1)*p/2)**2+math.cos(lat1*p)*math.cos(lat2*p)*math.sin((lon2-lon1)*p/2)**2)
    return 2*EARTH_R*math.asin(math.sqrt(max(0,a)))
def _bear(lat1,lon1,lat2,lon2):
    p=math.pi/180; dl=(lon2-lon1)*p
    x=math.sin(dl)*math.cos(lat2*p); y=math.cos(lat1*p)*math.sin(lat2*p)-math.sin(lat1*p)*math.cos(lat2*p)*math.cos(dl)
    return math.atan2(x,y)

def _offsets(n,pattern="wedge"):
    off=[(0.0,0.0,0.0)]
    if pattern=="wedge":
        for i in range(1,n): s=1 if i%2==0 else -1; r=(i+1)//2; off.append((-r*30.0,s*r*25.0,0.0))
    elif pattern=="line":
        for i in range(1,n): off.append((-i*40.0,0.0,0.0))
    elif pattern=="diamond":
        pos=[(0,0),(-1,-1),(-1,1),(-2,0)]
        for i in range(1,n):
            r,c=pos[i] if i<len(pos) else (-(i//2+1),(i%2*2-1)*((i//2)+1)); off.append((r*35.0,c*30.0,0.0))
    elif pattern=="spread":
        for i in range(1,n): a=(i/n)*2*math.pi+random.uniform(-0.3,0.3); r=50+random.uniform(-10,10); off.append((r*math.cos(a),r*math.sin(a),random.uniform(-20,20)))
    while len(off)<n: off.append((-len(off)*25.0,0.0,0.0))
    return off[:n]

class SwarmEngine:
    def __init__(self): self._state=None

    def initialize(self,agents,targets=None,behavior=SwarmBehavior.FORMATION):
        self._state=SwarmState(behavior=behavior,agents=agents,targets=targets or [])
        self._centroid(); return self._state

    def tick(self,dt=1.0,speed_ms=20.0,formation_pattern="wedge",threat_lat=None,threat_lon=None):
        if not self._state: raise RuntimeError("Not initialized")
        s=self._state; s.tick+=1; s.time_s+=dt
        alive=[a for a in s.agents if a.alive]
        if not alive: return s
        leader=next((a for a in alive if a.role==SwarmRole.LEADER),alive[0])
        if threat_lat and threat_lon:
            if _dist(leader.lat,leader.lon,threat_lat,threat_lon)<5000 and s.behavior!=SwarmBehavior.SCATTER:
                s.behavior=SwarmBehavior.SCATTER
        elif s.behavior==SwarmBehavior.SCATTER: s.behavior=SwarmBehavior.FORMATION
        unhit=[t for t in s.targets if not t.hit]
        if unhit and s.behavior not in [SwarmBehavior.SCATTER,SwarmBehavior.RTB]: s.behavior=SwarmBehavior.CONVERGE
        if s.behavior==SwarmBehavior.CONVERGE and unhit:
            tgt=min(unhit,key=lambda t:(t.priority,_dist(leader.lat,leader.lon,t.lat,t.lon)))
            self._move(leader,tgt.lat,tgt.lon,tgt.alt_m,speed_ms,dt)
            if _dist(leader.lat,leader.lon,tgt.lat,tgt.lon)<50: tgt.hit=True
        elif s.behavior==SwarmBehavior.ORBIT and unhit: self._orbit(leader,unhit[0].lat,unhit[0].lon,300,speed_ms,dt)
        elif s.behavior==SwarmBehavior.SCATTER:
            for i,a in enumerate(alive):
                ang=(i/len(alive))*2*math.pi; a.lat+=speed_ms*dt*math.cos(ang)*DEG_LAT; a.lon+=speed_ms*dt*math.sin(ang)*_dlon(a.lat)
            s.behavior=SwarmBehavior.FORMATION; self._centroid(); return s
        else:
            if s.behavior!=SwarmBehavior.RTB: leader.lat+=speed_ms*0.3*dt*DEG_LAT
        off=_offsets(len(alive),formation_pattern)
        bear=_bear(0,0,0.001,0) if len(alive)<2 else _bear(alive[-1].lat,alive[-1].lon,leader.lat,leader.lon)
        for i,agent in enumerate(alive):
            if agent.id==leader.id: continue
            dx,dy,dz=off[i]; cb=math.cos(bear); sb=math.sin(bear)
            rx=dx*cb-dy*sb; ry=dx*sb+dy*cb
            self._move(agent,leader.lat+rx*DEG_LAT,leader.lon+ry*_dlon(leader.lat),leader.alt_m+dz,speed_ms*1.2,dt,15)
        self._avoid(alive,20)
        for a in alive:
            a.fuel_pct=max(0.0,a.fuel_pct-0.0002*dt)
            if a.fuel_pct<=0: a.alive=False
        self._centroid(); return s

    def _move(self,a,tlat,tlon,talt,spd,dt,tol=5.0):
        d=_dist(a.lat,a.lon,tlat,tlon); ad=talt-a.alt_m
        if d<tol and abs(ad)<5: a.vx=a.vy=a.vz=0; return
        if d>0.1:
            b=_bear(a.lat,a.lon,tlat,tlon); st=min(spd*dt,d)
            a.lat+=st*math.cos(b)*DEG_LAT; a.lon+=st*math.sin(b)*_dlon(a.lat); a.vx=st*math.cos(b)/dt; a.vy=st*math.sin(b)/dt
        if abs(ad)>5: dz=min(abs(ad),spd*0.3*dt)*math.copysign(1,ad); a.alt_m+=dz; a.vz=dz/dt

    def _orbit(self,a,clat,clon,r,spd,dt):
        b=_bear(clat,clon,a.lat,a.lon); nb=b+spd/max(r,1)*dt
        nl=clat+r*math.cos(nb)*DEG_LAT; nlo=clon+r*math.sin(nb)*_dlon(clat)
        a.vx=(nl-a.lat)/dt/DEG_LAT; a.vy=(nlo-a.lon)/dt/_dlon(a.lat); a.lat=nl; a.lon=nlo

    def _avoid(self,agents,min_m):
        for i,a in enumerate(agents):
            for j,b in enumerate(agents):
                if i>=j: continue
                d=_dist(a.lat,a.lon,b.lat,b.lon)
                if 0.1<d<min_m:
                    br=_bear(a.lat,a.lon,b.lat,b.lon); p=(min_m-d)/2
                    a.lat-=p*math.cos(br)*DEG_LAT; a.lon-=p*math.sin(br)*_dlon(a.lat)
                    b.lat+=p*math.cos(br)*DEG_LAT; b.lon+=p*math.sin(br)*_dlon(b.lat)

    def _centroid(self):
        if not self._state: return
        alive=[a for a in self._state.agents if a.alive]
        if not alive: return
        self._state.center_lat=sum(a.lat for a in alive)/len(alive)
        self._state.center_lon=sum(a.lon for a in alive)/len(alive)
        self._state.center_alt=sum(a.alt_m for a in alive)/len(alive)

    def get_state(self): return self._state
    def set_behavior(self,b):
        if self._state: self._state.behavior=b
    def kill_agent(self,aid):
        if not self._state: return
        for a in self._state.agents:
            if a.id==aid: a.alive=False
