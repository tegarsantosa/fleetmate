import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..db import get_session
from ..models import Container, ScheduledShipment
from ..schemas import ContainerOut, ScheduledShipmentOut, ScheduledShipmentCreate, ScheduledShipmentUpdate

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/containers", response_model=list[ContainerOut])
async def get_containers(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(Container).order_by(Container.code))
    return result.scalars().all()


@router.get("/shipments", response_model=list[ScheduledShipmentOut])
async def get_shipments(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(ScheduledShipment).order_by(ScheduledShipment.scheduled_date.asc()))
    return result.scalars().all()


@router.post("/shipments", response_model=ScheduledShipmentOut)
async def create_shipment(payload: ScheduledShipmentCreate, db: AsyncSession = Depends(get_session)):
    container = await db.get(Container, payload.container_id)
    if not container:
        raise HTTPException(status_code=404, detail="container not found")
    shipment = ScheduledShipment(
        container_id=payload.container_id,
        scheduled_date=payload.scheduled_date,
        destination=payload.destination,
    )
    db.add(shipment)
    await db.commit()
    await db.refresh(shipment)
    return shipment


@router.put("/shipments/{shipment_id}", response_model=ScheduledShipmentOut)
async def update_shipment(shipment_id: uuid.UUID, payload: ScheduledShipmentUpdate, db: AsyncSession = Depends(get_session)):
    shipment = await db.get(ScheduledShipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="shipment not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(shipment, field, value)
    await db.commit()
    await db.refresh(shipment)
    return shipment


@router.delete("/shipments/{shipment_id}")
async def delete_shipment(shipment_id: uuid.UUID, db: AsyncSession = Depends(get_session)):
    shipment = await db.get(ScheduledShipment, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="shipment not found")
    await db.delete(shipment)
    await db.commit()
    return {"ok": True}
