"""
Simple Streamlit UI for the Personal Finance Tracker.
Tabs: Add Transaction, Search, Chat.
"""

from dotenv import load_dotenv
import streamlit as st

from common.logger import get_logger  # noqa: F401 — triggers logging config on app start

from tracker.ui.tabs.add_txn_tab import render_add_transaction
from tracker.ui.tabs.search_tab import render_search
from chat.ui.chat_tab import render_chat

load_dotenv()

st.set_page_config(page_title="Personal Finance Tracker", page_icon="💰", layout="centered")

nav_transactions, nav_chat = st.tabs(["Transactions", "Chat"])

with nav_transactions:
    st.title("Transactions")

    search_tab, add_tab = st.tabs(["Search", "Add"])

    with search_tab:
        render_search()

    with add_tab:
        render_add_transaction()

with nav_chat:
    st.title("Chat")
    render_chat()
