import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .packer import pack_boxes, Space, select_best_container, ContainerCandidate

API_BASE_URL = os.environ.get("API_BASE_URL", "http://api:8000")

app = FastAPI(title="FleetMate Packing Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PackRequest(BaseModel):
    box_ids: list[str] | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


async def _fetch_pending_boxes(client: httpx.AsyncClient, box_ids):
    response = await client.get(f"{API_BASE_URL}/boxes", params={"status": "pending"})
    response.raise_for_status()
    boxes = response.json()
    if box_ids:
        boxes = [b for b in boxes if b["id"] in box_ids]
    return boxes


async def _fetch_containers(client: httpx.AsyncClient):
    response = await client.get(f"{API_BASE_URL}/containers")
    response.raise_for_status()
    return response.json()


def _initial_space(container: dict) -> Space:
    length = float(container["length_cm"])
    width = float(container["width_cm"])
    height = float(container["height_cm"])
    used = float(container["used_volume_cm3"])

    if used <= 0:
        return Space(0, 0, 0, length, width, height)

    occupied_height = min(used / (length * width), height)
    remaining_height = height - occupied_height
    if remaining_height <= 1e-3:
        return Space(0, 0, height, length, width, 0)

    return Space(0, 0, occupied_height, length, width, remaining_height)


@app.post("/pack")
async def run_packing(payload: PackRequest):
    async with httpx.AsyncClient(timeout=30) as client:
        boxes = await _fetch_pending_boxes(client, payload.box_ids)
        if not boxes:
            return {"plans": [], "unplaced_boxes": []}

        containers = await _fetch_containers(client)

        plans = []
        remaining_boxes = list(boxes)

        while remaining_boxes:
            candidates = [
                ContainerCandidate(
                    id=c["id"],
                    code=c["code"],
                    length_cm=float(c["length_cm"]),
                    width_cm=float(c["width_cm"]),
                    height_cm=float(c["height_cm"]),
                    max_volume_cm3=float(c["max_volume_cm3"]),
                    used_volume_cm3=float(c["used_volume_cm3"]),
                    status=c["status"],
                )
                for c in containers
            ]

            smallest_box_volume = min(
                float(b["length_cm"]) * float(b["width_cm"]) * float(b["height_cm"]) for b in remaining_boxes
            )

            chosen = select_best_container(candidates, smallest_box_volume)
            if chosen is None:
                break

            container = next(c for c in containers if c["id"] == chosen.id)
            free_space = _initial_space(container)

            placed, unplaced, _ = pack_boxes(
                float(container["length_cm"]),
                float(container["width_cm"]),
                float(container["height_cm"]),
                remaining_boxes,
                existing_spaces=[free_space],
            )

            if not placed:
                containers = [c for c in containers if c["id"] != container["id"]]
                if not containers:
                    break
                continue

            placed_volume = sum(p.length * p.width * p.height for p in placed)
            utilization = (float(container["used_volume_cm3"]) + placed_volume) / float(container["max_volume_cm3"])

            plan_response = await client.post(
                f"{API_BASE_URL}/packing-plans",
                json={
                    "container_id": container["id"],
                    "volume_utilization": round(utilization, 4),
                    "items": [
                        {
                            "box_id": p.box_id,
                            "pos_x": p.x,
                            "pos_y": p.y,
                            "pos_z": p.z,
                            "rot_x": p.rot_x,
                            "rot_y": p.rot_y,
                            "rot_z": p.rot_z,
                            "placed_length_cm": p.length,
                            "placed_width_cm": p.width,
                            "placed_height_cm": p.height,
                        }
                        for p in placed
                    ],
                },
            )
            plan_response.raise_for_status()
            plans.append(plan_response.json())

            container["used_volume_cm3"] = float(container["used_volume_cm3"]) + placed_volume
            container["status"] = "full" if container["used_volume_cm3"] / container["max_volume_cm3"] >= 0.97 else "loading"

            placed_ids = {p.box_id for p in placed}
            remaining_boxes = [b for b in remaining_boxes if b["id"] not in placed_ids]

        return {
            "plans": plans,
            "unplaced_boxes": [b["id"] for b in remaining_boxes],
        }
