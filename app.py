"""
Simple Streamlit UI for the Personal Finance Tracker.
Tabs: Add Transaction, Search, Chat. (Summary tab hidden for now.)
"""

import streamlit as st

from common.logger import get_logger  # noqa: F401 — triggers logging config on app start

# Summary tab hidden for now; code kept in tracker.ui.tabs.summary_tab
from tracker.ui.tabs.add_txn_tab import render_add_transaction
from tracker.ui.tabs.search_tab import render_search
from chat.ui.chat_tab import render_chat

st.set_page_config(page_title="Personal Finance Tracker", page_icon="💰", layout="centered")

tab1, tab2, tab3 = st.tabs(["Add", "Search", "Chat"])
with tab1:
    render_add_transaction()
with tab2:
    render_search()
with tab3:
    render_chat()
