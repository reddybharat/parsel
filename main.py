"""
Personal Finance Tracker - FastAPI MVP.
All monetary values in INR (₹). Uses PostgreSQL via DATABASE_URL.
"""

from fastapi import FastAPI

from tracker.api.transactions import router as transactions_router
from chat.api.chat import router as chat_router

app = FastAPI(title="Personal Finance Tracker", version="0.1.0")


@app.get("/")
def root():
    return {"message": "Personal Finance Tracker API", "docs": "/docs"}


app.include_router(transactions_router)
app.include_router(chat_router, prefix="/chat")
