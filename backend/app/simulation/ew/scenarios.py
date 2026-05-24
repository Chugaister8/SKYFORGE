from app.simulation.ew.models import EWEmitter, JammingType

def scenario_gps_denial_zone(lat,lon):
    return [EWEmitter(id="pole-21-alpha",name="GPS Denial (Pole-21)",lat=lat,lon=lon,
        jamming_types=[JammingType.GPS_L1,JammingType.GPS_L1_L2],power_kw=2.0,effective_range_km=80.0)]

def scenario_datalink_jamming(lat,lon):
    return [
        EWEmitter(id="leer-3-alpha",name="Datalink Jammer (Leer-3)",lat=lat,lon=lon+0.05,
            jamming_types=[JammingType.DATALINK],power_kw=3.0,effective_range_km=50.0),
        EWEmitter(id="leer-3-beta",name="Datalink Jammer #2",lat=lat+0.03,lon=lon-0.02,
            jamming_types=[JammingType.DATALINK],power_kw=3.0,effective_range_km=50.0),
    ]

def scenario_full_spectrum(lat,lon):
    return [EWEmitter(id="krasukha-alpha",name="Broadband EW (Krasukha-4)",lat=lat,lon=lon,
        jamming_types=[JammingType.BROADBAND,JammingType.GPS_L1,JammingType.GPS_L1_L2,JammingType.DATALINK,JammingType.RADAR],
        power_kw=10.0,effective_range_km=150.0)]

def scenario_gps_spoofing(lat,lon,off_lat=0.05,off_lon=0.05):
    return [EWEmitter(id="spoofer-alpha",name="GPS Spoofer",lat=lat,lon=lon,
        jamming_types=[JammingType.SPOOFING,JammingType.GPS_L1],
        power_kw=5.0,effective_range_km=30.0,spoof_lat_offset=off_lat,spoof_lon_offset=off_lon)]

BUILTIN_SCENARIOS={"gps_denial":scenario_gps_denial_zone,"datalink_jam":scenario_datalink_jamming,
    "full_spectrum":scenario_full_spectrum,"gps_spoofing":scenario_gps_spoofing}
