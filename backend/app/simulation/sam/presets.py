from app.simulation.sam.models import SAMSite

SAM_PRESETS={
    "tor-m1":  {"radar_band":"H","search_range_km":25,"track_range_km":20,"min_rcs_m2":0.1,
                "missile_max_range_km":12,"missile_min_range_km":1.5,"missile_max_alt_m":6000,"missile_min_alt_m":10,
                "missile_speed_ms":840,"missile_fuze_radius_m":15,"ready_rounds":8,"reload_time_s":1080,"reaction_time_s":7.4},
    "buk-m2":  {"radar_band":"G","search_range_km":160,"track_range_km":45,"min_rcs_m2":0.05,
                "missile_max_range_km":45,"missile_min_range_km":3.0,"missile_max_alt_m":25000,"missile_min_alt_m":15,
                "missile_speed_ms":1200,"missile_fuze_radius_m":20,"ready_rounds":16,"reload_time_s":1500,"reaction_time_s":22},
    "zu-23-2": {"radar_band":"OPTICAL","search_range_km":2.5,"track_range_km":2.5,"min_rcs_m2":0.01,
                "missile_max_range_km":2.5,"missile_min_range_km":0.1,"missile_max_alt_m":1500,"missile_min_alt_m":0,
                "missile_speed_ms":1020,"missile_fuze_radius_m":5,"ready_rounds":50,"reload_time_s":30,"reaction_time_s":3},
    "manpads": {"radar_band":"IR","search_range_km":6,"track_range_km":6,"min_rcs_m2":999,
                "missile_max_range_km":6,"missile_min_range_km":0.5,"missile_max_alt_m":3500,"missile_min_alt_m":10,
                "missile_speed_ms":570,"missile_fuze_radius_m":8,"ready_rounds":1,"reload_time_s":30,"reaction_time_s":13},
}

def make_site(site_id,name,lat,lon,preset="tor-m1",altitude_m=0.0):
    p=SAM_PRESETS.get(preset,SAM_PRESETS["tor-m1"])
    return SAMSite(id=site_id,name=name,lat=lat,lon=lon,altitude_m=altitude_m,
        current_rounds=p["ready_rounds"],**p)
