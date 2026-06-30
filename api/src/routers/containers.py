import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Container
from ..schemas import ContainerOut

router = APIRouter(prefix="/containers", tags=["containers"])


@router.get("", response_model=list[ContainerOut])
async def list_containers(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Container).order_by(Container.code))
    return result.scalars().all()


@router.get("/{container_id}", response_model=ContainerOut)
async def get_container(container_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    container = await session.get(Container, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="container not found")
    return container


@router.post("/{container_id}/reset", response_model=ContainerOut)
async def reset_container(container_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    container = await session.get(Container, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="container not found")
    container.used_volume_cm3 = 0
    container.status = "available"
    await session.commit()
    await session.refresh(container)
    return container
