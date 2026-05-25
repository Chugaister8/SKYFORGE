"""
Unit library API — paginated, filterable.
"""
import structlog
from fastapi import APIRouter, HTTPException, Depends, Query
from app.api.auth import get_current_user
from app.models.user import User
from app.library.loader import get_library, get_unit

logger = structlog.get_logger()
router = APIRouter()


@router.get("/")
async def list_library(
    category:     str | None = Query(None, description="Filter by category"),
    faction:      str | None = Query(None, description="Filter by faction: friendly/hostile"),
    search:       str | None = Query(None, description="Search by name/id"),
    limit:        int        = Query(50, ge=1, le=200),
    offset:       int        = Query(0, ge=0),
    current_user: User       = Depends(get_current_user),
):
    all_units = list(get_library().values())

    # Filter
    if category:
        all_units = [u for u in all_units if u.get("category","").lower() == category.lower()]
    if faction:
        all_units = [u for u in all_units if u.get("faction","").lower() == faction.lower()]
    if search:
        s = search.lower()
        all_units = [
            u for u in all_units
            if s in u.get("id","").lower() or s in u.get("name","").lower()
        ]

    total  = len(all_units)
    paged  = all_units[offset : offset + limit]

    return {
        "units":    paged,
        "total":    total,
        "limit":    limit,
        "offset":   offset,
        "has_more": offset + len(paged) < total,
    }


@router.get("/stats")
async def library_stats(current_user: User = Depends(get_current_user)):
    lib = get_library()
    categories: dict[str, int] = {}
    factions:   dict[str, int] = {}
    for u in lib.values():
        categories[u.get("category","unknown")] = categories.get(u.get("category","unknown"), 0) + 1
        factions[u.get("faction","unknown")]     = factions.get(u.get("faction","unknown"), 0) + 1
    return {
        "total":      len(lib),
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
