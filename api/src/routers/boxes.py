import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Box
from ..schemas import BoxCreate, BoxOut

router = APIRouter(prefix="/boxes", tags=["boxes"])


@router.get("", response_model=list[BoxOut])
async def list_boxes(status: str | None = None, session: AsyncSession = Depends(get_session)):
    query = select(Box).order_by(Box.created_at.desc())
    if status:
        query = query.where(Box.status == status)
    result = await session.execute(query)
    return result.scalars().all()


@router.post("", response_model=BoxOut)
async def create_box(payload: BoxCreate, session: AsyncSession = Depends(get_session)):
    box = Box(
        scan_id=payload.scan_id,
        label=payload.label,
        length_cm=payload.length_cm,
        width_cm=payload.width_cm,
        height_cm=payload.height_cm,
        confidence=payload.confidence,
    )
    session.add(box)
    await session.commit()
    await session.refresh(box)
    return box


@router.get("/{box_id}", response_model=BoxOut)
async def get_box(box_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    box = await session.get(Box, box_id)
    if not box:
        raise HTTPException(status_code=404, detail="box not found")
    return box