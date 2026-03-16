"""
Simple Streamlit UI for the Personal Finance Tracker.
Tabs: Add Transaction, Search, Chat.
"""

from dotenv import load_dotenv
import streamlit as st

from common.logger import get_logger  # noqa: F401 — triggers logging config on app start

from common.database import open_session_connection
from tracker.ui.tabs.add_txn_tab import render_add_transaction
from tracker.ui.tabs.search_tab import render_search
from chat.ui.chat_tab import render_chat

load_dotenv()

st.set_page_config(page_title="Personal Finance Tracker", page_icon="💰", layout="centered")

# Create one DB connection when the app loads; reuse for the whole session
if "db_conn" not in st.session_state:
    try:
        st.session_state.db_conn = open_session_connection()
    except ValueError:
        st.session_state.db_conn = None

tab1, tab2, tab3 = st.tabs(["Add", "Search", "Chat"])
with tab1:
    render_add_transaction()
with tab2:
    render_search()
with tab3:
    render_chat()
