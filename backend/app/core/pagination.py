"""
Reusable pagination primitives.
"""
from typing import TypeVar, Generic, Sequence
from pydantic import BaseModel, Field
from fastapi import Query

T = TypeVar("T")


class PageParams:
    """FastAPI dependency for consistent pagination params."""
    def __init__(
        self,
        limit:  int = Query(50,  ge=1,  le=200, description="Items per page"),
        offset: int = Query(0,   ge=0,           description="Items to skip"),
    ):
        self.limit  = limit
        self.offset = offset


class CursorParams:
    """Cursor-based pagination (for large datasets)."""
    def __init__(
        self,
        limit:  int       = Query(50, ge=1, le=200),
        cursor: str | None = Query(None, description="Cursor from previous page"),
    ):
        self.limit  = limit
        self.cursor = cursor


class Page(BaseModel, Generic[T]):
    """Paginated response envelope."""
    items:   list[T]
    total:   int
    limit:   int
    offset:  int
    has_more:bool

    @classmethod
    def of(cls, items: Sequence[T], total: int, params: PageParams) -> "Page[T]":
        return cls(
            items    = list(items),
            total    = total,
            limit    = params.limit,
            offset   = params.offset,
            has_more = params.offset + len(items) < total,
        )
