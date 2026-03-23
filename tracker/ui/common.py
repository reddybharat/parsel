"""Shared UI helpers for the tracker Streamlit tabs (error messages, connection checks)."""

import streamlit as st

DATABASE_ERROR_MSG = (
    "**Could not reach the database.** This is usually one of:\n\n"
    "• **Database paused or restarting** — If you are using a managed Postgres service (e.g. Supabase, Render, Railway), "
    "check its dashboard and resume/restart the instance if needed.\n\n"
    "• **Temporary outage** — Try again in a few minutes.\n\n"
    "• **Network/firewall** — Check VPN or corporate network if the problem continues.\n\n"
    "• **DATABASE_URL** — Ensure `.env` has a valid `DATABASE_URL` (PostgreSQL connection string)."
)


def is_db_connection_error(err: str) -> bool:
    """Detect connection/SSL/timeout-style errors from the database."""
    err_lower = err.lower()
    return (
        "525" in err
        or "ssl" in err_lower
        or "connection" in err_lower
        or "timeout" in err_lower
        or "could not connect" in err_lower
        or "operationalerror" in err_lower
    )


def apply_theme() -> None:
    """Inject global coffee-themed styles for all app tabs."""
    st.markdown(
        """
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

            :root {
                --coffee-bg: #EFEBE9;
                --coffee-surface: #FFFFFF;
                --coffee-text: #3E2723;
                --coffee-muted: #77574D;
                --coffee-accent: #6D4C41;
                --coffee-income: #4E342E;
                --coffee-expense: #A1887F;
                --coffee-alert: #BCAAA4;
                --coffee-radius: 8px;
                --coffee-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            }

            [data-theme="dark"] {
                --coffee-bg: #271310;
                --coffee-surface: #3E2723;
                --coffee-text: #FDF8F6;
                --coffee-muted: #A1887F;
                --coffee-accent: #BCAAA4;
            }

            .stApp {
                background: var(--coffee-bg);
                color: var(--coffee-text);
                font-family: 'Inter', sans-serif;
            }

            .stApp [data-testid="stHeader"] {
                background: transparent;
            }

            .stApp, .stMarkdown, p, span, label, div {
                font-family: 'Inter', sans-serif;
            }

            .chat-main-header {
                padding: 0.6rem 1rem;
                border-radius: var(--coffee-radius);
                background: var(--coffee-surface);
                border: 1px solid var(--coffee-alert);
                box-shadow: var(--coffee-shadow);
                margin-bottom: 0.8rem;
            }
            .chat-main-header h2 {
                margin: 0;
                font-size: 1.35rem;
                color: var(--coffee-text);
                font-weight: 700;
            }

            div[data-testid="stMetric"] {
                background: var(--coffee-surface);
                border: 1px solid var(--coffee-alert);
                border-radius: var(--coffee-radius);
                padding: 0.75rem;
                box-shadow: var(--coffee-shadow);
            }

            .stButton > button {
                border-radius: var(--coffee-radius);
                border: 1px solid var(--coffee-alert);
                background: var(--coffee-surface);
                color: var(--coffee-text);
                font-weight: 600;
            }
            .stButton > button[kind="primary"] {
                background: var(--coffee-accent);
                color: #FDF8F6;
                border-color: var(--coffee-accent);
            }

            div[data-baseweb="input"] > div,
            div[data-baseweb="select"] > div,
            textarea {
                border-radius: var(--coffee-radius) !important;
                border-color: var(--coffee-alert) !important;
            }

            .coffee-income {
                color: var(--coffee-income);
                font-weight: 600;
            }
            .coffee-expense {
                color: var(--coffee-expense);
                font-weight: 600;
            }
            .coffee-muted {
                color: var(--coffee-muted);
            }

            .overview-metric-card {
                background: var(--coffee-surface);
                border: 1px solid var(--coffee-alert);
                border-radius: var(--coffee-radius);
                box-shadow: var(--coffee-shadow);
                padding: 14px 16px;
                min-height: 118px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .overview-metric-label {
                color: var(--coffee-muted);
                font-size: 0.95rem;
                margin-bottom: 4px;
            }
            .overview-metric-value {
                color: var(--coffee-text);
                font-size: 2.15rem;
                line-height: 1.15;
                font-weight: 600;
                margin: 0;
            }
            .overview-metric-subtle {
                color: var(--coffee-muted);
                font-size: 0.9rem;
                margin-top: 6px;
            }
            .overview-section-gap {
                margin-top: 8px;
                margin-bottom: 8px;
            }
            .overview-list-item {
                background: var(--coffee-surface);
                border: 1px solid var(--coffee-alert);
                border-radius: var(--coffee-radius);
                box-shadow: var(--coffee-shadow);
                padding: 10px 12px;
                margin-bottom: 8px;
            }
            .overview-trend-card {
                background: var(--coffee-surface);
                border: 1px solid var(--coffee-alert);
                border-radius: var(--coffee-radius);
                box-shadow: var(--coffee-shadow);
                padding: 10px 12px 12px 12px;
                margin: 8px 0 16px 0;
            }
            .overview-side-card {
                background: var(--coffee-surface);
                border: 1px solid var(--coffee-alert);
                border-radius: var(--coffee-radius);
                box-shadow: var(--coffee-shadow);
                padding: 8px 12px;
                min-height: 300px;
                margin-top: 67px;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }
            .overview-side-card h4 {
                margin: 0 0 6px 0;
                color: var(--coffee-text);
            }
            .overview-side-card p {
                margin: 0;
            }

        </style>
        """,
        unsafe_allow_html=True,
    )
