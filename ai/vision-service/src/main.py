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
    camera_top: UploadFile = File(...),
    camera_side: UploadFile | None = File(None),
    label: str | None = None,
):
    top_bytes = await camera_top.read()
    side_bytes = await camera_side.read() if camera_side is not None else None

    dimensions = estimate_dimensions(top_bytes, side_bytes)

    async with httpx.AsyncClient(timeout=30) as client:
        scan_response = await client.post(
            f"{API_BASE_URL}/scans",
            files={
                "camera_top": ("top.jpg", top_bytes, "image/jpeg"),
                **({"camera_side": ("side.jpg", side_bytes, "image/jpeg")} if side_bytes else {}),
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
