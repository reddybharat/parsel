"""
Personal Finance Tracker - FastAPI MVP.
All monetary values in INR (₹). Uses PostgreSQL via DATABASE_URL.
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from chat.router.chat import router as chat_router
from tracker.router.config import router as config_router
from tracker.router.dashboard import router as dashboard_router
from tracker.router.transactions import router as transactions_router

load_dotenv()

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="Parsel API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Parsel API", "docs": "/docs"}


app.include_router(transactions_router)
app.include_router(dashboard_router)
app.include_router(chat_router)
app.include_router(config_router)
