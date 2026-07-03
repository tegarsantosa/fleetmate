import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Container, PackingPlan, PackingItem, Box
from ..schemas import ContainerOut, ContainerCreate, ContainerUpdate

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


@router.post("", response_model=ContainerOut)
async def create_container(payload: ContainerCreate, session: AsyncSession = Depends(get_session)):
    container = Container(
        code=payload.code,
        name=payload.name,
        length_cm=payload.length_cm,
        width_cm=payload.width_cm,
        height_cm=payload.height_cm,
    )
    session.add(container)
    await session.commit()
    await session.refresh(container)
    return container


@router.put("/{container_id}", response_model=ContainerOut)
async def update_container(container_id: uuid.UUID, payload: ContainerUpdate, session: AsyncSession = Depends(get_session)):
    container = await session.get(Container, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="container not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(container, field, value)
    await session.commit()
    await session.refresh(container)
    return container


@router.delete("/{container_id}")
async def delete_container(container_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    container = await session.get(Container, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="container not found")
    await session.delete(container)
    await session.commit()
    return {"ok": True}


@router.post("/{container_id}/reset", response_model=ContainerOut)
async def reset_container(container_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    container = await session.get(Container, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="container not found")

    plan_ids_result = await session.execute(
        select(PackingPlan.id).where(PackingPlan.container_id == container_id)
    )
    plan_ids = [row[0] for row in plan_ids_result.all()]

    if plan_ids:
        box_ids_result = await session.execute(
            select(PackingItem.box_id).where(PackingItem.plan_id.in_(plan_ids))
        )
        box_ids = list(set(row[0] for row in box_ids_result.all()))

        await session.execute(delete(PackingItem).where(PackingItem.plan_id.in_(plan_ids)))
        await session.execute(delete(PackingPlan).where(PackingPlan.id.in_(plan_ids)))

        if box_ids:
            for box_id in box_ids:
                box = await session.get(Box, box_id)
                if box:
                    box.status = "pending"

    container.used_volume_cm3 = 0
    container.status = "available"
    await session.commit()
    await session.refresh(container)
    return container


@router.post("/{container_id}/dispatch", response_model=ContainerOut)
async def dispatch_container(container_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    container = await session.get(Container, container_id)
    if not container:
        raise HTTPException(status_code=404, detail="container not found")
    container.status = "shipped"
    await session.commit()
    await session.refresh(container)
    return container
