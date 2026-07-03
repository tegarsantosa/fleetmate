from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import containers, scans, boxes, packing, api_keys, accounts, inventory, analytics

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
app.include_router(api_keys.router)
app.include_router(accounts.router)
app.include_router(inventory.router)
app.include_router(analytics.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
