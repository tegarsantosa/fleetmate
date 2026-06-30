import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Scan
from ..schemas import ScanOut

router = APIRouter(prefix="/scans", tags=["scans"])

MEDIA_DIR = os.environ.get("MEDIA_DIR", "/media")


@router.post("", response_model=ScanOut)
async def create_scan(
    camera_left: UploadFile | None = File(None),
    camera_right: UploadFile | None = File(None),
    session: AsyncSession = Depends(get_session),
):
    scan_id = uuid.uuid4()
    scan_dir = os.path.join(MEDIA_DIR, "scans", str(scan_id))
    os.makedirs(scan_dir, exist_ok=True)

    left_path = None
    right_path = None

    if camera_left is not None:
        left_path = os.path.join(scan_dir, "left.jpg")
        with open(left_path, "wb") as f:
            f.write(await camera_left.read())

    if camera_right is not None:
        right_path = os.path.join(scan_dir, "right.jpg")
        with open(right_path, "wb") as f:
            f.write(await camera_right.read())

    scan = Scan(
        id=scan_id,
        camera_left_path=left_path,
        camera_right_path=right_path,
        raw_meta={"received_at": datetime.utcnow().isoformat()},
    )
    session.add(scan)
    await session.commit()
    await session.refresh(scan)
    return scan
