from pydantic import BaseModel
from enum import Enum
from typing import Any


class Faction(str, Enum):
    FRIENDLY = "FRIENDLY"
    HOSTILE  = "HOSTILE"
    NEUTRAL  = "NEUTRAL"


class EntityCategory(str, Enum):
    UAV            = "UAV"
    AIR_DEFENSE    = "AIR_DEFENSE"
    EW_SYSTEM      = "EW_SYSTEM"
    GROUND_VEHICLE = "GROUND_VEHICLE"
    NAVAL          = "NAVAL"
    STATIC         = "STATIC"


class ThreatLevel(str, Enum):
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"


class SignatureLevel(str, Enum):
    VERY_LOW = "VERY_LOW"
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    VERY_HIGH= "VERY_HIGH"


class UAVPerformance(BaseModel):
    max_speed_kmh:     float
    cruise_speed_kmh:  float
    max_range_km:      float
    endurance_hrs:     float
    max_altitude_m:    float
    min_altitude_m:    float = 0.0
    climb_rate_ms:     float | None = None
    service_ceiling_m: float | None = None


class UAVPropulsion(BaseModel):
    type:             str
    thrust_kg:        float | None = None
    battery_mah:      float | None = None
    fuel_capacity_l:  float | None = None
    fuel_burn_lph:    float | None = None
    motor_count:      int   = 1
    propeller_config: str | None = None


class UAVNavigation(BaseModel):
    gps_bands:          list[str] = []
    has_ins:            bool = False
    has_optical_nav:    bool = False
    has_terrain_follow: bool = False
    datalink_freq_mhz:  float | None = None
    datalink_range_km:  float | None = None
    is_fire_and_forget: bool = False
    has_terminal_seeker:bool = False
    seeker_type:        str | None = None


class UAVPayload(BaseModel):
    max_payload_kg: float = 0.0
    warhead_kg:     float | None = None
    warhead_type:   str | None = None
    has_eo:         bool = False
    has_ir:         bool = False
    has_sar:        bool = False
    has_sigint:     bool = False
    has_lidar:      bool = False


class UAVSignatures(BaseModel):
    rcs_m2:             float
    ir_signature:       SignatureLevel
    acoustic_signature: SignatureLevel
    visual_signature:   SignatureLevel


class UAVVulnerability(BaseModel):
    vs_gps_jamming:  ThreatLevel
    vs_datalink_jam: ThreatLevel
    vs_sam:          ThreatLevel
    vs_aaa:          ThreatLevel
    vs_manpads:      ThreatLevel
    has_flares:      bool = False
    has_chaff:       bool = False
    has_ecm:         bool = False


class UAVSimParams(BaseModel):
    mass_kg:          float
    wingspan_m:       float
    length_m:         float
    drag_coefficient: float
    lift_coefficient: float
    wing_area_m2:     float
    pid_roll:         dict[str, float] = {"p": 1.0, "i": 0.1, "d": 0.05}
    pid_pitch:        dict[str, float] = {"p": 1.0, "i": 0.1, "d": 0.05}
    pid_yaw:          dict[str, float] = {"p": 0.8, "i": 0.05,"d": 0.02}
    pid_altitude:     dict[str, float] = {"p": 1.2, "i": 0.15,"d": 0.1}


class UAVLibraryEntry(BaseModel):
    id:                str
    name:              str
    nato_designation:  str | None = None
    country_of_origin: str
    operators:         list[str] = []
    faction:           Faction
    category:          EntityCategory = EntityCategory.UAV
    uav_subtype:       str
    generation:        str | None = None
    in_service_since:  int | None = None
    performance:       UAVPerformance
    propulsion:        UAVPropulsion
    navigation:        UAVNavigation
    payload:           UAVPayload
    signatures:        UAVSignatures
    vulnerability:     UAVVulnerability
    sim_params:        UAVSimParams
    threat_level:      ThreatLevel
    description:       str
    how_to_detect:     list[str] = []
    how_to_counter:    list[str] = []
    image_url:         str | None = None
    tags:              list[str] = []


class RadarSpecs(BaseModel):
    band:           str
    search_range_km:float
    track_range_km: float
    max_targets:    int
    min_rcs_m2:     float
    rotation_rpm:   float | None = None
    elevation_deg:  float = 360.0


class MissileSpecs(BaseModel):
    designation:  str
    speed_mach:   float
    max_range_km: float
    min_range_km: float
    max_altitude_m:float
    min_altitude_m:float
    warhead_kg:   float
    fuze_type:    str
    guidance:     str


class SAMLibraryEntry(BaseModel):
    id:                str
    name:              str
    nato_designation:  str | None = None
    country_of_origin: str
    faction:           Faction
    category:          EntityCategory = EntityCategory.AIR_DEFENSE
    sam_class:         str
    radar:             RadarSpecs
    missile:           MissileSpecs
    ready_rounds:      int
    reload_time_min:   float
    reaction_time_sec: float
    crew:              int
    vs_arm:            ThreatLevel
    vs_jamming:        ThreatLevel
    vs_low_slow:       ThreatLevel
    engagement_probability_curve: dict[str, Any] = {}
    threat_level:      ThreatLevel
    description:       str
    how_to_detect:     list[str] = []
    how_to_counter:    list[str] = []
    tags:              list[str] = []


class EWLibraryEntry(BaseModel):
    id:                str
    name:              str
    country_of_origin: str
    faction:           Faction
    category:          EntityCategory = EntityCategory.EW_SYSTEM
    ew_type:           str
    freq_bands_mhz:    list[list[float]] = []
    jamming_power_kw:  float
    effective_range_km:float
    targets:           list[str] = []
    platform:          str
    gps_denial_radius_km:      float = 0.0
    datalink_denial_radius_km: float = 0.0
    jamming_effectiveness:     float = 0.8
    threat_level:      ThreatLevel
    description:       str
    how_to_detect:     list[str] = []
    how_to_counter:    list[str] = []
    tags:              list[str] = []


class GroundVehicleLibraryEntry(BaseModel):
    id:                str
    name:              str
    nato_designation:  str | None = None
    country_of_origin: str
    faction:           Faction
    category:          EntityCategory = EntityCategory.GROUND_VEHICLE
    vehicle_type:      str
    mass_tonnes:       float
    length_m:          float
    width_m:           float
    height_m:          float
    max_speed_kmh:     float
    crew:              int
    main_gun:          str | None = None
    caliber_mm:        float | None = None
    secondary:         list[str] = []
    armor_type:        str | None = None
    vs_atgm:           ThreatLevel
    vs_uav:            ThreatLevel
    ir_signature:      SignatureLevel
    acoustic_signature:SignatureLevel
    threat_level:      ThreatLevel
    description:       str
    how_to_detect:     list[str] = []
    how_to_counter:    list[str] = []
    tags:              list[str] = []


class LibraryEntryMeta(BaseModel):
    id:           str
    name:         str
    faction:      Faction
    category:     EntityCategory
    subtype:      str
    country:      str
    threat_level: ThreatLevel
    tags:         list[str]
    image_url:    str | None = None
