import json
import urllib.error
import urllib.request
from functools import lru_cache

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

from app.core.config import settings

security = HTTPBearer(auto_error=False)

LOCAL_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"
LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"


def get_jwt_secret() -> str:
    return settings.supabase_jwt_secret or LOCAL_JWT_SECRET


def get_supabase_url() -> str:
    return settings.supabase_url or LOCAL_SUPABASE_URL


@lru_cache(maxsize=1)
def _fetch_jwks() -> dict:
    url = f"{get_supabase_url().rstrip('/')}/auth/v1/.well-known/jwks.json"
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.loads(response.read())


def _decode_es256(token: str) -> str | None:
    header = jwt.get_unverified_header(token)
    if header.get("alg") != "ES256":
        return None

    kid = header.get("kid")
    if not kid:
        return None

    jwks = _fetch_jwks()
    key_dict = next((item for item in jwks.get("keys", []) if item.get("kid") == kid), None)
    if key_dict is None:
        return None

    public_key = jwk.construct(key_dict)
    payload = jwt.decode(
        token,
        public_key,
        algorithms=["ES256"],
        audience="authenticated",
    )
    user_id = payload.get("sub")
    return str(user_id) if user_id else None


def _decode_hs256(token: str) -> str | None:
    payload = jwt.decode(
        token,
        get_jwt_secret(),
        algorithms=["HS256"],
        audience="authenticated",
    )
    user_id = payload.get("sub")
    return str(user_id) if user_id else None


def _decode_user_id(token: str) -> str | None:
    try:
        user_id = _decode_es256(token)
        if user_id:
            return user_id
    except JWTError:
        _fetch_jwks.cache_clear()
        try:
            user_id = _decode_es256(token)
            if user_id:
                return user_id
        except JWTError:
            pass
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, StopIteration, ValueError):
        pass

    try:
        return _decode_hs256(token)
    except JWTError:
        return None


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str | None:
    if credentials is None:
        return None
    return _decode_user_id(credentials.credentials)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authorization header required")

    user_id = _decode_user_id(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id
