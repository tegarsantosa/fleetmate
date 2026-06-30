from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import containers, scans, boxes, packing

app = FastAPI(title="FleetMate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory="/media"), name="media")

app.include_router(containers.router)
app.include_router(scans.router)
app.include_router(boxes.router)
app.include_router(packing.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
