import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..db import get_session
from ..models import ApiKey
from ..schemas import ApiKeyOut, ApiKeyCreate

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


@router.get("/", response_model=list[ApiKeyOut])
async def get_api_keys(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=ApiKeyOut)
async def create_api_key(payload: ApiKeyCreate, db: AsyncSession = Depends(get_session)):
    key_value = f"fm_live_{secrets.token_hex(16)}"
    api_key = ApiKey(key=key_value, name=payload.name)
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return api_key


@router.delete("/{key_id}")
async def delete_api_key(key_id: uuid.UUID, db: AsyncSession = Depends(get_session)):
    api_key = await db.get(ApiKey, key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="api key not found")
    await db.delete(api_key)
    await db.commit()
    return {"ok": True}
