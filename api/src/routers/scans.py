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
    camera_top: UploadFile | None = File(None),
    camera_side: UploadFile | None = File(None),
    session: AsyncSession = Depends(get_session),
):
    scan_id = uuid.uuid4()
    scan_dir = os.path.join(MEDIA_DIR, "scans", str(scan_id))
    os.makedirs(scan_dir, exist_ok=True)

    top_path = None
    side_path = None

    if camera_top is not None:
        top_path = os.path.join(scan_dir, "top.jpg")
        with open(top_path, "wb") as f:
            f.write(await camera_top.read())

    if camera_side is not None:
        side_path = os.path.join(scan_dir, "side.jpg")
        with open(side_path, "wb") as f:
            f.write(await camera_side.read())

    scan = Scan(
        id=scan_id,
        camera_top_path=top_path,
        camera_side_path=side_path,
        raw_meta={"received_at": datetime.utcnow().isoformat()},
    )
    session.add(scan)
    await session.commit()
    await session.refresh(scan)
    return scan
