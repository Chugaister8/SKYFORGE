export const APP_NAME = "SKYFORGE" as const;
export const APP_VERSION = "0.1.0" as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000";

export const UAV_CLASSES = [
  "NANO",
  "MICRO_FPV",
  "STRIKE_FPV",
  "TACTICAL_MULTIROTOR",
  "TACTICAL_VTOL",
  "FIXED_WING_ISR",
  "LOITERING_MUNITION",
  "MALE",
  "HALE",
] as const;

export type UAVClass = (typeof UAV_CLASSES)[number];

export const THREAT_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ThreatLevel = (typeof THREAT_LEVELS)[number];

export const USER_ROLES = ["PILOT", "ENGINEER", "COMMANDER", "INSTRUCTOR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];
