"""
Unit library API — paginated, filterable.
Uses get_all_meta() for fast listing, get_unit() for detail.
"""
import structlog
from fastapi import APIRouter, HTTPException, Depends, Query
from app.api.auth import get_current_user
from app.models.user import User
from app.library.loader import get_all_meta, get_unit, load_library
from app.library.schema import Faction, EntityCategory

logger = structlog.get_logger()
router = APIRouter()


@router.get("/")
async def list_library(
    category:     str | None = Query(None),
    faction:      str | None = Query(None),
    search:       str | None = Query(None, description="Search name/id/tags"),
    limit:        int        = Query(50,  ge=1, le=200),
    offset:       int        = Query(0,   ge=0),
    current_user: User       = Depends(get_current_user),
):
    all_meta = get_all_meta()

    # Filter
    filtered = []
    cat_upper = category.upper() if category else None
    fac_upper = faction.upper()  if faction  else None
    srch      = search.lower()   if search   else None

    for m in all_meta:
        if cat_upper and m.category.value != cat_upper:
            continue
        if fac_upper and m.faction.value  != fac_upper:
            continue
        if srch:
            haystack = f"{m.id} {m.name} {' '.join(m.tags)}".lower()
            if srch not in haystack:
                continue
        filtered.append(m)

    total  = len(filtered)
    paged  = filtered[offset : offset + limit]

    return {
        "units": [
            {
                "id":           e.id,
                "name":         e.name,
                "category":     e.category.value,
                "faction":      e.faction.value,
                "subtype":      e.subtype,
                "country":      e.country,
                "threat_level": e.threat_level.value,
                "tags":         e.tags,
            }
            for e in paged
        ],
        "total":    total,
        "limit":    limit,
        "offset":   offset,
        "has_more": offset + len(paged) < total,
    }


@router.get("/stats")
async def library_stats(current_user: User = Depends(get_current_user)):
    all_meta   = get_all_meta()
    categories: dict[str, int] = {}
    factions:   dict[str, int] = {}
    for m in all_meta:
        cv = m.category.value
        fv = m.faction.value
        categories[cv] = categories.get(cv, 0) + 1
        factions[fv]   = factions.get(fv, 0) + 1
    return {
        "total":      len(all_meta),
        "categories": categories,
        "factions":   factions,
    }


@router.get("/{unit_id}")
async def get_unit_detail(
    unit_id:      str,
    current_user: User = Depends(get_current_user),
):
    unit = get_unit(unit_id)
    if not unit:
        raise HTTPException(404, f"Unit '{unit_id}' not found")
    return unit
