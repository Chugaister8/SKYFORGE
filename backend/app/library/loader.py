import json
import structlog
from pathlib import Path
from typing import Any

from app.library.schema import (
    UAVLibraryEntry, SAMLibraryEntry,
    EWLibraryEntry, GroundVehicleLibraryEntry,
    LibraryEntryMeta, EntityCategory, Faction,
)

logger = structlog.get_logger()
LIBRARY_ROOT = Path(__file__).parent / "data"
_CACHE: dict[str, Any] = {}


def _load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _parse_entry(data: dict) -> Any:
    category = data.get("category")
    match category:
        case "UAV":
            return UAVLibraryEntry(**data)
        case "AIR_DEFENSE":
            return SAMLibraryEntry(**data)
        case "EW_SYSTEM":
            return EWLibraryEntry(**data)
        case "GROUND_VEHICLE":
            return GroundVehicleLibraryEntry(**data)
        case _:
            raise ValueError(f"Unknown category: {category}")


def load_library() -> dict[str, Any]:
    global _CACHE
    if _CACHE:
        return _CACHE

    entries: dict[str, Any] = {}
    json_files = list(LIBRARY_ROOT.rglob("*.json"))

    for path in json_files:
        try:
            data  = _load_json(path)
            entry = _parse_entry(data)
            entries[entry.id] = entry
            logger.debug("library.loaded", id=entry.id)
        except Exception as e:
            logger.error("library.load_error", path=str(path), error=str(e))

    _CACHE = entries
    logger.info("library.ready", count=len(entries))
    return entries


def get_entry(entry_id: str) -> Any | None:
    return load_library().get(entry_id)


def get_all_meta() -> list[LibraryEntryMeta]:
    library = load_library()
    result  = []
    for entry in library.values():
        subtype = (
            getattr(entry, "uav_subtype",   None) or
            getattr(entry, "sam_class",     None) or
            getattr(entry, "ew_type",       None) or
            getattr(entry, "vehicle_type",  None) or
            "UNKNOWN"
        )
        result.append(LibraryEntryMeta(
            id           = entry.id,
            name         = entry.name,
            faction      = entry.faction,
            category     = entry.category,
            subtype      = subtype,
            country      = getattr(entry, "country_of_origin", "—"),
            threat_level = entry.threat_level,
            tags         = entry.tags,
            image_url    = getattr(entry, "image_url", None),
        ))
    return sorted(result, key=lambda x: (x.category, x.faction, x.name))


def get_by_faction(faction: Faction) -> list[LibraryEntryMeta]:
    return [e for e in get_all_meta() if e.faction == faction]


def get_by_category(category: EntityCategory) -> list[LibraryEntryMeta]:
    return [e for e in get_all_meta() if e.category == category]
