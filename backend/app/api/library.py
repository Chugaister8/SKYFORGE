from fastapi import APIRouter, HTTPException, Query
from app.library.loader import get_all_meta, get_entry
from app.library.schema import LibraryEntryMeta, EntityCategory, Faction

router = APIRouter()


@router.get("/", response_model=list[LibraryEntryMeta])
async def list_library(
    faction:  Faction | None        = Query(None),
    category: EntityCategory | None = Query(None),
    search:   str | None            = Query(None),
):
    entries = get_all_meta()
    if faction:
        entries = [e for e in entries if e.faction == faction]
    if category:
        entries = [e for e in entries if e.category == category]
    if search:
        q = search.lower()
        entries = [
            e for e in entries
            if q in e.name.lower()
            or q in e.id.lower()
            or any(q in t for t in e.tags)
        ]
    return entries


@router.get("/stats")
async def library_stats():
    entries = get_all_meta()
    stats: dict = {}
    for e in entries:
        key = f"{e.category}_{e.faction}"
        stats[key] = stats.get(key, 0) + 1
    return {"total": len(entries), "by_category_faction": stats}


@router.get("/{entry_id}")
async def get_library_entry(entry_id: str):
    entry = get_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Entry '{entry_id}' not found")
    return entry
