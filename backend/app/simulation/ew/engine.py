import math, random, structlog
from app.simulation.ew.models import EWEmitter, EWState, EWEffect, JammingType

logger=structlog.get_logger()
EARTH_RADIUS_M=6_371_000.0; GPS_L1_FREQ=1575.42; GPS_L2_FREQ=1227.60

def _haversine_m(lat1,lon1,lat2,lon2):
    r=EARTH_RADIUS_M; p=math.pi/180
    a=(math.sin((lat2-lat1)*p/2)**2+math.cos(lat1*p)*math.cos(lat2*p)*math.sin((lon2-lon1)*p/2)**2)
    return 2*r*math.asin(math.sqrt(a))

def _fsl_db(dist_m,freq_mhz):
    if dist_m<1: dist_m=1.0
    return 20*math.log10(dist_m)+20*math.log10(freq_mhz)+20*math.log10(4*math.pi/299.792)

def _js_db(emitter,ulat,ulon,ualt,sig_dbm=-130.0,gps_bands=None):
    dist_m=_haversine_m(emitter.lat,emitter.lon,ulat,ulon)
    dist_3d=math.sqrt(dist_m**2+abs(ualt-emitter.altitude_m)**2)
    jpower=10*math.log10(emitter.power_kw*1_000_000)
    freq=GPS_L1_FREQ
    if gps_bands and "L2" in gps_bands: freq=(GPS_L1_FREQ+GPS_L2_FREQ)/2
    return jpower-_fsl_db(dist_3d,freq)-sig_dbm

class EWEngine:
    GPS_DEG=10.0; GPS_DENY=25.0; GPS_SPOOF=35.0; LINK_DEG=15.0; LINK_DENY=30.0

    def __init__(self, emitters=None):
        self._emitters=emitters or []

    def add_emitter(self,e): self._emitters.append(e)
    def remove_emitter(self,eid): self._emitters=[e for e in self._emitters if e.id!=eid]
    def get_emitters(self): return self._emitters

    def compute(self,uav_id,uav_lat,uav_lon,uav_alt_m,uav_gps_bands,uav_datalink_freq_mhz,dt=1.0,prev_state=None):
        state=EWState(); 
        if prev_state: state.gps_drift_ms=prev_state.gps_drift_ms
        active=[e for e in self._emitters if e.active]
        if not active: return state

        max_gps_js=-999.0; spoof_emitter=None
        for emitter in active:
            has_gps=any(jt in emitter.jamming_types for jt in [JammingType.GPS_L1,JammingType.GPS_L1_L2,JammingType.BROADBAND])
            has_spoof=JammingType.SPOOFING in emitter.jamming_types
            if not (has_gps or has_spoof): continue
            js=_js_db(emitter,uav_lat,uav_lon,uav_alt_m,gps_bands=uav_gps_bands)
            if len(uav_gps_bands)>=2 and JammingType.GPS_L1_L2 not in emitter.jamming_types: js-=15.0
            if js>max_gps_js: max_gps_js=js
            if has_spoof and js>self.GPS_SPOOF: spoof_emitter=emitter

        if max_gps_js>self.GPS_DENY:
            state.gps_effect=EWEffect.DENIED; state.gps_accuracy_m=999.0
            state.gps_drift_ms=state.gps_drift_ms+(0.5+random.uniform(0,0.3))*dt
        elif max_gps_js>self.GPS_DEG:
            state.gps_effect=EWEffect.DEGRADED
            f=(max_gps_js-self.GPS_DEG)/(self.GPS_DENY-self.GPS_DEG)
            state.gps_accuracy_m=2.5+f*97.5; state.gps_drift_ms=max(0.0,state.gps_drift_ms-0.05*dt)
        else:
            state.gps_effect=EWEffect.NONE; state.gps_accuracy_m=2.5+random.gauss(0,0.3)
            state.gps_drift_ms=max(0.0,state.gps_drift_ms-0.1*dt)

        if spoof_emitter and state.gps_effect!=EWEffect.DENIED:
            state.gps_effect=EWEffect.SPOOFED
            state.spoofed_lat=uav_lat+spoof_emitter.spoof_lat_offset+random.gauss(0,0.0001)
            state.spoofed_lon=uav_lon+spoof_emitter.spoof_lon_offset+random.gauss(0,0.0001)

        max_dl_js=-999.0
        DLINK_FREQS={"2.4GHz":2400.0,"5.8GHz":5800.0,"1.2GHz":1200.0,"900MHz":900.0}
        for emitter in active:
            has_dl=any(jt in emitter.jamming_types for jt in [JammingType.DATALINK,JammingType.BROADBAND])
            if not has_dl: continue
            if uav_datalink_freq_mhz:
                if not any(abs(uav_datalink_freq_mhz-f)<200 for f in DLINK_FREQS.values()): continue
            js=_js_db(emitter,uav_lat,uav_lon,uav_alt_m,sig_dbm=-100.0)
            if js>max_dl_js: max_dl_js=js

        if max_dl_js>self.LINK_DENY:
            state.datalink_effect=EWEffect.DENIED; state.link_quality=max(0.0,0.1+random.uniform(-0.1,0.1))
            state.packet_loss_pct=random.uniform(70,100); state.latency_ms=random.uniform(500,2000)
        elif max_dl_js>self.LINK_DEG:
            state.datalink_effect=EWEffect.DEGRADED
            f=(max_dl_js-self.LINK_DEG)/(self.LINK_DENY-self.LINK_DEG)
            state.link_quality=max(0.1,1.0-f*0.8+random.gauss(0,0.05))
            state.packet_loss_pct=f*60+random.uniform(0,10); state.latency_ms=50+f*450+random.uniform(0,50)
        else:
            state.datalink_effect=EWEffect.NONE; state.link_quality=min(1.0,0.95+random.gauss(0,0.02))
            state.packet_loss_pct=random.uniform(0,2); state.latency_ms=50+random.uniform(-10,20)

        state.threat_level=self._threat(state)
        return state

    def _threat(self,s):
        sc=0
        if s.gps_effect==EWEffect.DENIED: sc+=4
        elif s.gps_effect==EWEffect.SPOOFED: sc+=5
        elif s.gps_effect==EWEffect.DEGRADED: sc+=2
        if s.datalink_effect==EWEffect.DENIED: sc+=4
        elif s.datalink_effect==EWEffect.DEGRADED: sc+=2
        if s.radar_lock: sc+=3
        elif s.radar_warning: sc+=1
        if sc>=8: return "CRITICAL"
        if sc>=5: return "HIGH"
        if sc>=3: return "MEDIUM"
        if sc>=1: return "LOW"
        return "NONE"
