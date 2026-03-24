"""Dashboard/Overview tab UI for the Personal Finance Tracker Streamlit app."""

from __future__ import annotations

import math
from html import escape

import altair as alt
import streamlit as st

from common.api_client import ApiClientError
from common.logger import get_logger
from tracker.client import (
    get_dashboard_highlights as api_get_dashboard_highlights,
    get_dashboard_recent as api_get_dashboard_recent,
    get_dashboard_summary as api_get_dashboard_summary,
    get_dashboard_trend as api_get_dashboard_trend,
)

GENERIC_ERROR_MSG = "Sorry, couldn't process your request due to a technical error. Please try again later."

logger = get_logger(__name__)


def _signed_amount(row: dict) -> float:
    amount = float(row.get("amount", 0.0))
    return -amount if bool(row.get("is_debit", True)) else amount


def _fmt_signed(amount: float) -> str:
    if amount < 0:
        return f"-₹{abs(amount):,.2f}"
    return f"₹{amount:,.2f}"


@st.cache_data(ttl=60, show_spinner=False)
def _get_dashboard_summary_cached() -> dict:
    return api_get_dashboard_summary()


@st.cache_data(ttl=60, show_spinner=False)
def _get_dashboard_trend_cached(months: int) -> dict:
    return api_get_dashboard_trend(months=months)


@st.cache_data(ttl=30, show_spinner=False)
def _get_dashboard_recent_cached(limit: int) -> dict:
    return api_get_dashboard_recent(limit=limit)


@st.cache_data(ttl=60, show_spinner=False)
def _get_dashboard_highlights_cached() -> dict:
    return api_get_dashboard_highlights()


def render_dashboard_overview() -> None:

    if st.button("Refresh overview", key="dashboard_refresh"):
        st.cache_data.clear()
        st.rerun()

    try:
        summary = _get_dashboard_summary_cached()
        trend = _get_dashboard_trend_cached(months=6)
        recent = _get_dashboard_recent_cached(limit=4)
        highlights = _get_dashboard_highlights_cached()
    except ApiClientError as e:
        logger.error("Dashboard API error: %s", e, exc_info=True)
        st.error(GENERIC_ERROR_MSG)
        return
    except Exception as e:
        logger.error("Dashboard unexpected error: %s", e, exc_info=True)
        st.error(GENERIC_ERROR_MSG)
        return

    portfolio = float(summary.get("portfolio_net", 0.0))
    current_month_spend = float(summary.get("current_month_spend", 0.0))
    previous_month_spend = float(summary.get("previous_month_spend", 0.0))
    spend_delta_pct = summary.get("spend_delta_pct")
    if spend_delta_pct is not None:
        delta_text = f"{float(spend_delta_pct):+.1f}% vs last month"
    else:
        delta_text = "No previous month baseline"

    c1, c2 = st.columns(2)
    with c1:
        st.markdown(
            f"""
            <div class="overview-metric-card">
                <div class="overview-metric-label">Current Portfolio</div>
                <p class="overview-metric-value">{_fmt_signed(portfolio)}</p>
                <div class="overview-metric-subtle">Net balance</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with c2:
        st.markdown(
            f"""
            <div class="overview-metric-card">
                <div class="overview-metric-label">Monthly Spend</div>
                <p class="overview-metric-value">₹{current_month_spend:,.2f}</p>
                <div class="overview-metric-subtle">{escape(delta_text)}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    st.markdown(
        f'<div class="coffee-muted overview-section-gap">Last month spend: ₹{previous_month_spend:,.2f}</div>',
        unsafe_allow_html=True,
    )

    # Savings Goal intentionally disabled for now.
    # We will add it back after personal-goal logic is finalized.
    # c3.metric("Savings Goal Progress", "0%")

    with st.container(border=True):
        st.subheader("Spending Trend (Last 6 Months)")
        trend_points = trend.get("points", []) or []
        chart_rows = []
        for idx in range(6):
            point = trend_points[idx] if idx < len(trend_points) else {"month_label": "-", "spend": 0}
            raw_spend = float(point.get("spend", 0) or 0)
            spend = abs(raw_spend) if math.isfinite(raw_spend) else 0.0
            chart_rows.append(
                {
                    "month": str(point.get("month_label", "-")),
                    "spend": spend,
                }
            )

        max_spend = max((row["spend"] for row in chart_rows), default=0.0)
        y_axis_max = max(max_spend + 30000.0, 30000.0)

        trend_chart = (
            alt.Chart(alt.Data(values=chart_rows))
            .mark_bar(cornerRadiusTopLeft=6, cornerRadiusTopRight=6, color="#8D6E63")
            .encode(
                x=alt.X(
                    "month:N",
                    title=None,
                    sort=None,
                    axis=alt.Axis(labelAngle=0, labelPadding=8, tickSize=0),
                ),
                y=alt.Y(
                    "spend:Q",
                    title=None,
                    scale=alt.Scale(domain=[0, y_axis_max]),
                    axis=alt.Axis(format=",.0f", gridColor="#EAEAEA", tickCount=5),
                ),
                tooltip=[
                    alt.Tooltip("month:N", title="Month"),
                    alt.Tooltip("spend:Q", title="Spend (INR)", format=",.2f"),
                ],
            )
            .properties(height=320)
            .configure_view(strokeWidth=0)
        )
        st.altair_chart(trend_chart, width="stretch")

    left, right = st.columns([1.8, 1.2], gap="large")
    with left:
        st.subheader("Recent Transactions")
        recent_items = (recent.get("items", []) or [])[:5]
        if not recent_items:
            st.info("No recent transactions found.")
        else:
            for row in recent_items:
                tx_date = str(row.get("transaction_date", ""))
                category = str(row.get("category", ""))
                description = str(row.get("description") or "—")
                signed = _signed_amount(row)
                st.markdown(
                    f"""
                    <div class="overview-list-item">
                        <div><strong>{escape(tx_date)}</strong> | <strong>{escape(category)}</strong> | <strong>{_fmt_signed(signed)}</strong></div>
                        <div class="coffee-muted">{escape(description)}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

    with right:
        top_category = highlights.get("top_category", {}) or {}
        top_category_name = str(top_category.get("category") or "—")
        top_category_spend = float(top_category.get("spend", 0) or 0)
        total_inflow = float(highlights.get("total_inflow", 0) or 0)
        total_outflow = float(highlights.get("total_outflow", 0) or 0)
        st.markdown(
            f"""
            <div class="overview-side-card">
                <h4>Monthly Insights</h4>
                <div><strong>Top Category</strong><br>{escape(top_category_name)} ({_fmt_signed(-top_category_spend)})</div>
                <div class="overview-section-gap"></div>
                <div><strong>Total Inflow</strong><br>{_fmt_signed(total_inflow)}</div>
                <div class="overview-section-gap"></div>
                <div><strong>Total Outflow</strong><br>{_fmt_signed(-total_outflow)}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

