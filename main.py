"""
Personal Finance Tracker - FastAPI MVP.
All monetary values in INR (₹). Uses PostgreSQL via DATABASE_URL.
"""

from dotenv import load_dotenv
from fastapi import FastAPI

from chat.router.chat import router as chat_router
from tracker.router.dashboard import router as dashboard_router
from tracker.router.transactions import router as transactions_router

load_dotenv()

app = FastAPI(title="Personal Finance Tracker", version="0.1.0")


@app.get("/")
async def root():
    return {"message": "Personal Finance Tracker API", "docs": "/docs"}


app.include_router(transactions_router)
app.include_router(dashboard_router)
app.include_router(chat_router)
