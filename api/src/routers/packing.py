import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, delete, func
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


@router.delete("/items/{item_id}")
async def remove_plan_item(item_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    """Un-pack one box: pull it off the load plan and put it back in the
    pending queue. The container's used volume shrinks accordingly and a
    plan that loses its last item is deleted outright."""
    # Core statements only — no ORM instances, so no lazy-load / cascade /
    # expiry landmines in the async session (MissingGreenlet).
    row = (
        await session.execute(
            select(PackingItem.plan_id, PackingItem.box_id).where(PackingItem.id == item_id)
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="plan item not found")
    plan_id, box_id = row

    container_id = (
        await session.execute(select(PackingPlan.container_id).where(PackingPlan.id == plan_id))
    ).scalar_one_or_none()
    box_volume = (
        await session.execute(select(Box.volume_cm3).where(Box.id == box_id))
    ).scalar_one_or_none()

    # 1. box back to the pending queue
    await session.execute(update(Box).where(Box.id == box_id).values(status="pending"))

    # 2. drop the plan item; shrink or drop the plan itself
    await session.execute(delete(PackingItem).where(PackingItem.id == item_id))
    left = (
        await session.execute(
            select(func.count()).select_from(PackingItem).where(PackingItem.plan_id == plan_id)
        )
    ).scalar_one()
    if left == 0:
        await session.execute(delete(PackingPlan).where(PackingPlan.id == plan_id))
    else:
        await session.execute(
            update(PackingPlan).where(PackingPlan.id == plan_id).values(box_count=left)
        )

    # 3. shrink the container's used volume + recompute status
    if container_id is not None and box_volume is not None:
        vals = (
            await session.execute(
                select(Container.used_volume_cm3, Container.max_volume_cm3, Container.status)
                .where(Container.id == container_id)
            )
        ).first()
        if vals:
            used, max_vol, status = float(vals[0]), float(vals[1]), vals[2]
            new_used = max(0.0, used - float(box_volume))
            new_status = status
            if status != "shipped":
                utilization = new_used / max_vol if max_vol else 0.0
                new_status = (
                    "available" if new_used <= 0
                    else "full" if utilization >= 0.97
                    else "loading"
                )
            await session.execute(
                update(Container)
                .where(Container.id == container_id)
                .values(used_volume_cm3=new_used, status=new_status)
            )

    await session.commit()
    return {"ok": True, "box_id": str(box_id)}


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
