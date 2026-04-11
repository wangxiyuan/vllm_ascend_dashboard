"""
认证 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy import select

from app.api.deps import DbSession, get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas import LoginRequest, Message, PasswordChange, Token, UserResponse

router = APIRouter()
security = HTTPBearer(auto_error=False)


@router.post("/login", response_model=Token)
async def login(
    db: DbSession,
    login_data: LoginRequest
):
    """用户登录"""
    # 查找用户
    stmt = select(User).where(User.username == login_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户账号已被禁用",
        )

    # 生成 Token
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": 86400,  # 24 小时
    }


@router.post("/logout", response_model=Message)
async def logout(
    current_user: User = Depends(get_current_user)
):
    """用户登出"""
    # TODO: 可以将 token 加入黑名单
    return {"message": "已成功登出"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """获取当前用户信息"""
    return current_user


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    db: DbSession
):
    """刷新 Token

    使用刷新 Token 获取新的访问 Token 和刷新 Token
    客户端需要在 Authorization header 中提供刷新 Token:
    Authorization: Bearer <refresh_token>
    """
    # 从 header 中获取刷新 token
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少刷新 Token",
        )

    token = auth_header.split(" ")[1]
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="刷新 Token 无效或已过期",
        )

    username = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="刷新 Token 无效",
        )

    # 验证用户是否仍然存在且活跃
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被禁用",
        )

    # 生成新的 Token
    access_token = create_access_token(data={"sub": username})
    refresh_token = create_refresh_token(data={"sub": username})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": 86400,
    }


@router.post("/change-password", response_model=Message)
async def change_password(
    db: DbSession,
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user)
):
    """修改自己的密码

    需要提供当前密码进行验证
    """
    # 验证当前密码
    if not verify_password(password_data.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="当前密码不正确",
        )

    # 更新密码
    current_user.password_hash = hash_password(password_data.new_password)
    await db.commit()

    return {"message": "密码已成功修改"}
