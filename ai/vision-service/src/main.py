import os
import httpx
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .dimension import estimate_dimensions

API_BASE_URL = os.environ.get("API_BASE_URL", "http://api:8000")

app = FastAPI(title="FleetMate Vision Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/scan")
async def scan_box(
    camera_left: UploadFile = File(...),
    camera_right: UploadFile | None = File(None),
    label: str | None = None,
):
    left_bytes = await camera_left.read()
    right_bytes = await camera_right.read() if camera_right is not None else None

    dimensions = estimate_dimensions(left_bytes, right_bytes)

    async with httpx.AsyncClient(timeout=30) as client:
        scan_response = await client.post(
            f"{API_BASE_URL}/scans",
            files={
                "camera_left": ("left.jpg", left_bytes, "image/jpeg"),
                **({"camera_right": ("right.jpg", right_bytes, "image/jpeg")} if right_bytes else {}),
            },
        )
        scan_response.raise_for_status()
        scan = scan_response.json()

        box_response = await client.post(
            f"{API_BASE_URL}/boxes",
            json={
                "scan_id": scan["id"],
                "label": label,
                "length_cm": dimensions["length_cm"],
                "width_cm": dimensions["width_cm"],
                "height_cm": dimensions["height_cm"],
                "confidence": dimensions["confidence"],
            },
        )
        box_response.raise_for_status()
        box = box_response.json()

    return {"scan": scan, "box": box, "vision_meta": dimensions}
