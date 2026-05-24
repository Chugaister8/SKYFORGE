import math, random, structlog
from app.simulation.sam.models import SAMSite, EngagementResult, SAMState

logger=structlog.get_logger()
EARTH_R=6_371_000.0

def _haversine_m(lat1,lon1,lat2,lon2):
    p=math.pi/180
    a=(math.sin((lat2-lat1)*p/2)**2+math.cos(lat1*p)*math.cos(lat2*p)*math.sin((lon2-lon1)*p/2)**2)
    return 2*EARTH_R*math.asin(math.sqrt(a))

def _los_m(site,ulat,ulon,ualt):
    g=_haversine_m(site.lat,site.lon,ulat,ulon)
    return math.sqrt(g**2+abs(ualt-site.altitude_m)**2)

def _detection_probability(site,dist_m,rcs):
    if not site.radar_active or rcs<site.min_rcs_m2*0.3: return 0.0
    max_r=site.search_range_km*1000
    snr=(rcs/site.min_rcs_m2)*(max_r/max(dist_m,1))**4
    pd=1.0/(1.0+math.exp(-3.0*(snr-1.0)))*random.uniform(0.90,1.0)
    return max(0.0,min(1.0,pd))

def _kill_probability(site,dist_m,rcs,speed_ms,alt_m,has_ecm=False):
    max_r=site.missile_max_range_km*1000; min_r=site.missile_min_range_km*1000
    if dist_m>max_r or dist_m<min_r: return 0.0
    if alt_m>site.missile_max_alt_m or alt_m<site.missile_min_alt_m: return 0.0
    mid_r=(max_r+min_r)/2
    rf=max(0.1,1.0-((dist_m-mid_r)/(max_r-min_r))**2)
    rcf=min(1.0,math.sqrt(rcs/site.min_rcs_m2))
    sf=max(0.3,1.0-speed_ms/600.0)
    ef=0.55 if has_ecm else 1.0
    return max(0.05,min(0.95,rf*rcf*sf*ef))

class SAMEngine:
    def __init__(self,sites=None):
        self._sites=sites or []; self._track_time={}

    def add_site(self,s): self._sites.append(s)
    def remove_site(self,sid): self._sites=[s for s in self._sites if s.id!=sid]
    def get_sites(self): return self._sites
    def toggle_radar(self,sid):
        for s in self._sites:
            if s.id==sid:
                s.radar_active=not s.radar_active
                s.state=SAMState.STANDBY if not s.radar_active else SAMState.SEARCHING

    def tick(self,uav_id,uav_lat,uav_lon,uav_alt_m,uav_rcs_m2,uav_speed_ms,uav_has_ecm=False,dt=1.0):
        results={"sites":[],"radar_warning":False,"radar_lock":False,"missile_inbound":False,"engagement":None}
        for site in [s for s in self._sites if s.radar_active]:
            dist_m=_los_m(site,uav_lat,uav_lon,uav_alt_m); dist_km=dist_m/1000
            if site.state==SAMState.RELOADING:
                site.reload_elapsed_s+=dt
                if site.reload_elapsed_s>=site.reload_time_s:
                    site.current_rounds=site.ready_rounds; site.state=SAMState.SEARCHING; site.reload_elapsed_s=0
                results["sites"].append(self._st(site,dist_km)); continue
            if dist_km>site.search_range_km:
                site.state=SAMState.SEARCHING; self._track_time.pop(site.id,None)
                results["sites"].append(self._st(site,dist_km)); continue
            pd=_detection_probability(site,dist_m,uav_rcs_m2)
            if pd<0.3 or random.random()>pd:
                site.state=SAMState.SEARCHING; self._track_time.pop(site.id,None)
                results["sites"].append(self._st(site,dist_km)); continue
            results["radar_warning"]=True
            if dist_km<=site.track_range_km:
                self._track_time[site.id]=self._track_time.get(site.id,0)+dt
                site.state=SAMState.TRACKING
                if self._track_time[site.id]>=site.reaction_time_s:
                    results["radar_lock"]=True
                    if (site.current_rounds>0 and site.state!=SAMState.ENGAGING
                        and dist_km>=site.missile_min_range_km and dist_km<=site.missile_max_range_km
                        and uav_alt_m>=site.missile_min_alt_m and uav_alt_m<=site.missile_max_alt_m):
                        pk=_kill_probability(site,dist_m,uav_rcs_m2,uav_speed_ms,uav_alt_m,uav_has_ecm)
                        killed=random.random()<pk
                        site.current_rounds-=1; site.state=SAMState.ENGAGING
                        if site.current_rounds==0: site.state=SAMState.RELOADING
                        results["engagement"]={"site_id":site.id,"site_name":site.name,"pk":round(pk,3),
                            "killed":killed,"reason":"HIT" if killed else "MISS","rounds_remaining":site.current_rounds}
            results["sites"].append(self._st(site,dist_km))
        results["missile_inbound"]=results["radar_lock"]
        return results

    def _st(self,site,dist_km):
        return {"id":site.id,"name":site.name,"lat":site.lat,"lon":site.lon,"state":site.state.value,
                "dist_km":round(dist_km,2),"rounds":site.current_rounds,"radar_on":site.radar_active,
                "search_range_km":site.search_range_km,"missile_range_km":site.missile_max_range_km}
