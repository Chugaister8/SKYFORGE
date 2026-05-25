"""
Role-Based Access Control decorators and dependencies.
"""
import structlog
from fastapi import Depends, HTTPException, status
from app.api.auth import get_current_user
from app.models.user import User, UserRole

logger = structlog.get_logger()

# Role hierarchy: higher index = more permissions
_ROLE_LEVEL = {
    UserRole.PILOT:      1,
    UserRole.ENGINEER:   2,
    UserRole.COMMANDER:  3,
    UserRole.INSTRUCTOR: 4,
    UserRole.ADMIN:      5,
}


def require_role(*roles: UserRole):
    """
    FastAPI dependency factory.
    Usage:
        @router.get("/secret")
        async def secret(user = Depends(require_role(UserRole.COMMANDER))):
            ...
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles and current_user.role != UserRole.ADMIN:
            logger.warning(
                "rbac.denied",
                user_id=current_user.id,
                role=current_user.role,
                required=roles,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {current_user.role} not authorized. Required: {[r.value for r in roles]}",
            )
        return current_user
    return _check


def require_min_level(min_role: UserRole):
    """Require at least this role level (and above)."""
    min_level = _ROLE_LEVEL[min_role]

    async def _check(current_user: User = Depends(get_current_user)) -> User:
        user_level = _ROLE_LEVEL.get(current_user.role, 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Minimum role required: {min_role.value}",
            )
        return current_user
    return _check


# Convenience shortcuts
require_commander = require_min_level(UserRole.COMMANDER)
require_instructor = require_min_level(UserRole.INSTRUCTOR)
require_admin      = require_role(UserRole.ADMIN)
