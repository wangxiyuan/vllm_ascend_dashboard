"""
安全工具模块
"""
import logging
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import ExpiredSignatureError, JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """密码加密"""
    # 将密码转换为字节
    password_bytes = password.encode('utf-8')
    # 生成盐并哈希密码
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    try:
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except ValueError as e:
        # 捕获 bcrypt 特定错误（如无效的 hash）
        logger = logging.getLogger(__name__)
        logger.warning(f"Password verification error: {e}")
        return False
    except Exception as e:
        # 记录其他异常以便调试
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error during password verification: {e}")
        return False


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None
) -> str:
    """生成访问 Token"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire, "iat": datetime.now(UTC)})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )

    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """生成刷新 Token（7 天有效期）"""
    return create_access_token(data, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))


def decode_token(token: str) -> dict | None:
    """解码 Token"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except ExpiredSignatureError:
        # Token 已过期
        return None
    except JWTError as e:
        # Token 无效 - 记录详细错误以便调试
        logger = logging.getLogger(__name__)
        logger.warning(f"JWT decode error: {e}, token: {token[:20]}...")
        return None
    except Exception as e:
        # 记录其他异常以便调试
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error during token decoding: {e}")
        return None
