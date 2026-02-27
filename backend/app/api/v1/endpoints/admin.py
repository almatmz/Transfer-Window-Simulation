from fastapi import APIRouter, Depends
from app.models.user import User
from app.schemas.user import UserResponse, AdminUserUpdateRequest
from app.core.deps import require_admin
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=list[UserResponse], summary="List all users")
async def list_users(_: User = Depends(require_admin)):
    users = await User.find_all().to_list()
    return [
        UserResponse(
            id=str(u.id), email=u.email, username=u.username, role=u.role,
            full_name=u.full_name, club_affiliation=u.club_affiliation, created_at=u.created_at,
        )
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=UserResponse, summary="Update user role or status")
async def update_user(
    user_id: str,
    body: AdminUserUpdateRequest,
    _: User = Depends(require_admin),
):
    user = await User.get(user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    update = body.model_dump(exclude_unset=True)
    update["updated_at"] = datetime.utcnow()
    await user.set(update)

    return UserResponse(
        id=str(user.id), email=user.email, username=user.username, role=user.role,
        full_name=user.full_name, club_affiliation=user.club_affiliation, created_at=user.created_at,
    )