import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ContainerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name: str
    length_cm: float
    width_cm: float
    height_cm: float
    max_volume_cm3: float
    used_volume_cm3: float
    status: str


class ScanCreate(BaseModel):
    camera_left_path: str | None = None
    camera_right_path: str | None = None
    raw_meta: dict = {}


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    camera_left_path: str | None
    camera_right_path: str | None
    raw_meta: dict
    created_at: datetime


class BoxCreate(BaseModel):
    scan_id: uuid.UUID | None = None
    label: str | None = None
    length_cm: float
    width_cm: float
    height_cm: float
    confidence: float = 0


class BoxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    scan_id: uuid.UUID | None
    label: str | None
    length_cm: float
    width_cm: float
    height_cm: float
    volume_cm3: float
    confidence: float
    status: str
    created_at: datetime


class PackingItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    box_id: uuid.UUID
    pos_x: float
    pos_y: float
    pos_z: float
    rot_x: int
    rot_y: int
    rot_z: int
    placed_length_cm: float
    placed_width_cm: float
    placed_height_cm: float


class PackingPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    container_id: uuid.UUID
    volume_utilization: float
    box_count: int
    created_at: datetime
    items: list[PackingItemOut] = []


class PackingPlanCreate(BaseModel):
    container_id: uuid.UUID
    volume_utilization: float
    items: list[dict]
