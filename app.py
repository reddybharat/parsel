"""
Simple Streamlit UI for the Personal Finance Tracker.
Tabs: Dashboard/Overview, Ledger, AI Chat.
"""

from dotenv import load_dotenv
import streamlit as st

from common.logger import get_logger  # noqa: F401 — triggers logging config on app start

from chat.ui.chat_tab import render_chat
from tracker.ui.common import apply_theme
from tracker.ui.tabs.add_txn_tab import render_add_transaction
from tracker.ui.tabs.dashboard_tab import render_dashboard_overview
from tracker.ui.tabs.search_tab import render_search

load_dotenv()

st.set_page_config(page_title="Personal Finance Tracker", page_icon="💰", layout="centered")
apply_theme()

top_nav = st.radio(
    "Navigation",
    options=["Overview", "Ledger", "AI Chat"],
    horizontal=True,
    label_visibility="collapsed",
    key="top_navigation",
)

if top_nav == "Overview":
    render_dashboard_overview()

elif top_nav == "Ledger":
    ledger_nav = st.radio(
        "Ledger Navigation",
        options=["Search", "Add"],
        horizontal=True,
        label_visibility="collapsed",
        key="ledger_navigation",
    )

    if ledger_nav == "Search":
        render_search()

    else:
        render_add_transaction()

else:
    render_chat()
