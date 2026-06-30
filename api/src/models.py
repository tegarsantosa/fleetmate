import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, Integer, ForeignKey, DateTime, func, JSON, Computed
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


container_status = ENUM(
    "available", "loading", "full", "dispatched",
    name="container_status", create_type=False,
)
packing_status = ENUM(
    "pending", "planned", "failed",
    name="packing_status", create_type=False,
)


class Container(Base):
    __tablename__ = "containers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    length_cm: Mapped[float] = mapped_column(Numeric)
    width_cm: Mapped[float] = mapped_column(Numeric)
    height_cm: Mapped[float] = mapped_column(Numeric)
    max_volume_cm3: Mapped[float] = mapped_column(
        Numeric, Computed("length_cm * width_cm * height_cm", persisted=True)
    )
    used_volume_cm3: Mapped[float] = mapped_column(Numeric, default=0)
    status: Mapped[str] = mapped_column(container_status, default="available")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plans: Mapped[list["PackingPlan"]] = relationship(back_populates="container")


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_left_path: Mapped[str | None] = mapped_column(String, nullable=True)
    camera_right_path: Mapped[str | None] = mapped_column(String, nullable=True)
    raw_meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    boxes: Mapped[list["Box"]] = relationship(back_populates="scan")


class Box(Base):
    __tablename__ = "boxes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=True)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    length_cm: Mapped[float] = mapped_column(Numeric)
    width_cm: Mapped[float] = mapped_column(Numeric)
    height_cm: Mapped[float] = mapped_column(Numeric)
    volume_cm3: Mapped[float] = mapped_column(
        Numeric, Computed("length_cm * width_cm * height_cm", persisted=True)
    )
    confidence: Mapped[float] = mapped_column(Numeric, default=0)
    status: Mapped[str] = mapped_column(packing_status, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scan: Mapped[Scan | None] = relationship(back_populates="boxes")
    items: Mapped[list["PackingItem"]] = relationship(back_populates="box")


class PackingPlan(Base):
    __tablename__ = "packing_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    container_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("containers.id"))
    volume_utilization: Mapped[float] = mapped_column(Numeric, default=0)
    box_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    container: Mapped[Container] = relationship(back_populates="plans")
    items: Mapped[list["PackingItem"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PackingItem(Base):
    __tablename__ = "packing_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("packing_plans.id"))
    box_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("boxes.id"))
    pos_x: Mapped[float] = mapped_column(Numeric)
    pos_y: Mapped[float] = mapped_column(Numeric)
    pos_z: Mapped[float] = mapped_column(Numeric)
    rot_x: Mapped[int] = mapped_column(Integer, default=0)
    rot_y: Mapped[int] = mapped_column(Integer, default=0)
    rot_z: Mapped[int] = mapped_column(Integer, default=0)
    placed_length_cm: Mapped[float] = mapped_column(Numeric)
    placed_width_cm: Mapped[float] = mapped_column(Numeric)
    placed_height_cm: Mapped[float] = mapped_column(Numeric)

    plan: Mapped[PackingPlan] = relationship(back_populates="items")
    box: Mapped[Box] = relationship(back_populates="items")