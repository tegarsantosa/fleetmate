from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..db import get_session
from ..models import Box, PackingPlan, Container, ScheduledShipment

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard")
async def get_dashboard_stats(db: AsyncSession = Depends(get_session)):
    # Total boxes scanned
    boxes_result = await db.execute(select(func.count(Box.id)))
    total_boxes = boxes_result.scalar() or 0

    # Total containers
    containers_result = await db.execute(select(func.count(Container.id)))
    total_containers = containers_result.scalar() or 0

    # Total scheduled shipments
    shipments_result = await db.execute(select(func.count(ScheduledShipment.id)))
    total_shipments = shipments_result.scalar() or 0

    # Average Utilization (mock aggregation)
    plans_result = await db.execute(select(func.avg(PackingPlan.volume_utilization)))
    avg_utilization = plans_result.scalar() or 0.0

    return {
        "total_boxes": total_boxes,
        "total_containers": total_containers,
        "total_shipments": total_shipments,
        "avg_utilization_percent": round(avg_utilization * 100, 2)
    }
