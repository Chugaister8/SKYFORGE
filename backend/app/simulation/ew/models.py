from dataclasses import dataclass, field
from enum import Enum
import math, random

class JammingType(str, Enum):
    GPS_L1="GPS_L1"; GPS_L1_L2="GPS_L1_L2"; DATALINK="DATALINK"
    BROADBAND="BROADBAND"; RADAR="RADAR"; SPOOFING="SPOOFING"

class EWEffect(str, Enum):
    NONE="NONE"; DEGRADED="DEGRADED"; DENIED="DENIED"; SPOOFED="SPOOFED"

@dataclass
class EWEmitter:
    id: str; name: str; lat: float; lon: float; altitude_m: float=0.0
    jamming_types: list[JammingType]=field(default_factory=list)
    power_kw: float=1.0; effective_range_km: float=20.0; active: bool=True
    spoof_lat_offset: float=0.0; spoof_lon_offset: float=0.0

@dataclass
class EWState:
    gps_effect: EWEffect=EWEffect.NONE; gps_accuracy_m: float=2.5
    gps_drift_ms: float=0.0; spoofed_lat: float|None=None; spoofed_lon: float|None=None
    datalink_effect: EWEffect=EWEffect.NONE; link_quality: float=1.0
    packet_loss_pct: float=0.0; latency_ms: float=50.0
    radar_warning: bool=False; radar_lock: bool=False; threat_level: str="NONE"

    def to_dict(self) -> dict:
        return {
            "gps_effect":self.gps_effect.value,"gps_accuracy_m":round(self.gps_accuracy_m,2),
            "gps_drift_ms":round(self.gps_drift_ms,3),"spoofed_lat":self.spoofed_lat,"spoofed_lon":self.spoofed_lon,
            "datalink_effect":self.datalink_effect.value,"link_quality":round(self.link_quality,3),
            "packet_loss_pct":round(self.packet_loss_pct,1),"latency_ms":round(self.latency_ms,1),
            "radar_warning":self.radar_warning,"radar_lock":self.radar_lock,"threat_level":self.threat_level,
        }
