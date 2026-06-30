import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..db import get_session
from ..models import Container, Box, PackingPlan, PackingItem
from ..schemas import PackingPlanOut, PackingPlanCreate

router = APIRouter(prefix="/packing-plans", tags=["packing"])


@router.get("", response_model=list[PackingPlanOut])
async def list_plans(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(PackingPlan).options(selectinload(PackingPlan.items)).order_by(PackingPlan.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{plan_id}", response_model=PackingPlanOut)
async def get_plan(plan_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(PackingPlan).options(selectinload(PackingPlan.items)).where(PackingPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="plan not found")
    return plan


@router.post("", response_model=PackingPlanOut)
async def create_plan(payload: PackingPlanCreate, session: AsyncSession = Depends(get_session)):
    container = await session.get(Container, payload.container_id)
    if not container:
        raise HTTPException(status_code=404, detail="container not found")

    plan = PackingPlan(
        container_id=container.id,
        volume_utilization=payload.volume_utilization,
        box_count=len(payload.items),
    )
    session.add(plan)
    await session.flush()

    placed_volume = 0
    for item in payload.items:
        box = await session.get(Box, uuid.UUID(item["box_id"]))
        if not box:
            continue
        box.status = "planned"
        placed_volume += float(box.volume_cm3)
        session.add(
            PackingItem(
                plan_id=plan.id,
                box_id=box.id,
                pos_x=item["pos_x"],
                pos_y=item["pos_y"],
                pos_z=item["pos_z"],
                rot_x=item.get("rot_x", 0),
                rot_y=item.get("rot_y", 0),
                rot_z=item.get("rot_z", 0),
                placed_length_cm=item["placed_length_cm"],
                placed_width_cm=item["placed_width_cm"],
                placed_height_cm=item["placed_height_cm"],
            )
        )

    container.used_volume_cm3 = float(container.used_volume_cm3) + placed_volume
    utilization = float(container.used_volume_cm3) / float(container.max_volume_cm3)
    container.status = "full" if utilization >= 0.97 else "loading"

    await session.commit()

    result = await session.execute(
        select(PackingPlan).options(selectinload(PackingPlan.items)).where(PackingPlan.id == plan.id)
    )
    return result.scalar_one()
