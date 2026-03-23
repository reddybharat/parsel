"""Components for rendering search results table and edit/delete actions on the Search tab."""

from datetime import date, datetime
from typing import Any, Optional

import streamlit as st

from common.api_client import ApiClientError
from common.logger import get_logger
from tracker.client import delete_transaction as api_delete_transaction
from tracker.client import update_transaction as api_update_transaction
from tracker.constants import CATEGORIES
from tracker.validations import validate_amount, validate_category, validate_transaction_date

GENERIC_ERROR_MSG = "Sorry, couldn't process your request due to a technical error. Please try again later."

logger = get_logger(__name__)


def _show_pagination_footer(total_count: int, page_size: int, current_page: int) -> None:
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    col_prev, col_next, _ = st.columns([1, 1, 2])
    with col_prev:
        prev_clicked = st.button("← Prev", disabled=(current_page <= 1), key="search_prev")
    with col_next:
        next_clicked = st.button("Next →", disabled=(current_page >= total_pages), key="search_next")
    if prev_clicked and current_page > 1:
        st.session_state.search_page = current_page - 1
        st.rerun()
    if next_clicked and current_page < total_pages:
        st.session_state.search_page = current_page + 1
        st.rerun()


def _format_audit_ts(value) -> str:
    """Format created_at/updated_at for display."""
    if value is None:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    s = str(value)
    return s[:16] if len(s) > 16 else s


def _render_edit_form(row: dict, conn: Optional[Any] = None) -> None:
    row_id = row.get("id")
    if not row_id:
        return
    with st.form(key="edit_txn_form"):
        st.caption("Edit transaction")
        if any(row.get(k) is not None for k in ("created_at", "updated_at", "version_no")):
            st.caption(
                f"Created: {_format_audit_ts(row.get('created_at'))} | "
                f"Updated: {_format_audit_ts(row.get('updated_at'))} | "
                f"Version: {row.get('version_no', '—')}"
            )
        amount = st.number_input(
            "Amount (₹)",
            min_value=0.01,
            value=float(row.get("amount", 0)),
            step=0.01,
            format="%.2f",
            key="edit_amount",
        )
        credit_debit = st.selectbox(
            "Credit/Debit",
            options=["Debit", "Credit"],
            index=0 if row.get("is_debit", True) else 1,
            key="edit_credit_debit",
        )
        category = st.selectbox(
            "Category",
            options=CATEGORIES,
            index=CATEGORIES.index(row["category"]) if row.get("category") in CATEGORIES else 0,
            key="edit_category",
        )
        txn_date = st.date_input(
            "Date",
            value=date.fromisoformat(row["transaction_date"]) if isinstance(row.get("transaction_date"), str) else date.today(),
            key="edit_date",
        )
        description = st.text_input(
            "Description (optional)",
            value=row.get("description") or "",
            key="edit_desc",
        )
        col1, col2, _ = st.columns([1, 1, 2])
        with col1:
            submitted = st.form_submit_button("Save")
        with col2:
            cancel = st.form_submit_button("Cancel")
        if cancel:
            if "editing_transaction" in st.session_state:
                del st.session_state.editing_transaction
            st.rerun()
        if submitted:
            is_debit = credit_debit == "Debit"
            try:
                validate_amount(amount)
                validate_category(category)
                validate_transaction_date(txn_date)
            except ValueError as e:
                st.error(str(e))
                return
            try:
                api_update_transaction(
                    transaction_id=str(row_id),
                    amount=float(amount),
                    category=category.strip(),
                    transaction_date=txn_date,
                    description=(description or "").strip() or None,
                    is_debit=is_debit,
                )
                if "editing_transaction" in st.session_state:
                    del st.session_state.editing_transaction
                st.session_state.search_last_message = ("Transaction updated.", "success")
                st.rerun()
            except ApiClientError as e:
                logger.error("Update transaction API error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)
            except Exception as e:
                logger.error("Update transaction unexpected error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)


def _render_delete_confirm(row: dict, conn: Optional[Any] = None) -> None:
    row_id = row.get("id")
    if not row_id:
        return
    amt = row.get("amount", 0)
    is_debit = row.get("is_debit", True)
    cat = row.get("category", "")
    signed_amount = -float(amt) if is_debit else float(amt)
    st.warning(f"Delete this transaction? **₹{signed_amount:,.2f}** — {cat}")
    col1, col2, _ = st.columns([1, 1, 2])
    with col1:
        if st.button("Confirm delete", type="primary", key="confirm_del"):
            try:
                api_delete_transaction(transaction_id=str(row_id))
                if "deleting_transaction" in st.session_state:
                    del st.session_state.deleting_transaction
                st.session_state.search_last_message = ("Transaction deleted.", "success")
                st.rerun()
            except ApiClientError as e:
                logger.error("Delete transaction API error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)
            except Exception as e:
                logger.error("Delete transaction unexpected error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)
    with col2:
        if st.button("Cancel", key="cancel_del"):
            if "deleting_transaction" in st.session_state:
                del st.session_state.deleting_transaction
            st.rerun()


def render_search_results(rows: list[dict], total_count: int | None, page_size: int, conn=None) -> None:
    """Render the paginated search results table with edit/delete actions.
    conn: optional DB connection to reuse for update/delete (avoids extra connection per run)."""
    if not rows:
        return

    # Show last status message (from edit/delete) just above results
    if "search_last_message" in st.session_state:
        msg, level = st.session_state.search_last_message
        if level == "success":
            st.success(msg)
        elif level == "warning":
            st.warning(msg)
        elif level == "error":
            st.error(msg)
        else:
            st.info(msg)
        del st.session_state.search_last_message

    if total_count is None:
        total_count = len(rows)

    page = st.session_state.get("search_page", 1)

    total_pages = max(1, (total_count + page_size - 1) // page_size)
    if page > total_pages:
        st.session_state.search_page = total_pages
        st.rerun()

    if st.session_state.get("editing_transaction"):
        _render_edit_form(st.session_state.editing_transaction, conn=conn)
        st.divider()
    if st.session_state.get("deleting_transaction"):
        _render_delete_confirm(st.session_state.deleting_transaction, conn=conn)
        st.divider()

    offset_start = (st.session_state.search_page - 1) * page_size
    start_one = offset_start + 1
    end_one = min(offset_start + len(rows), total_count)
    st.caption(f"Showing **{start_one}–{end_one}** of **{total_count}** transactions")

    header_cols = st.columns([1, 1, 1, 2, 2])
    headers = ["Date", "Amount", "Category", "Description", ""]
    for c, h in zip(header_cols, headers):
        c.markdown(f"**{h}**")

    for r in rows:
        row_id = r.get("id")
        if not row_id:
            continue
        amt = float(r.get("amount", 0))
        is_debit = r.get("is_debit", True)
        signed_amount = -amt if is_debit else amt
        cols = st.columns([1, 1, 1, 2, 2])
        with cols[0]:
            st.text(r.get("transaction_date", ""))
        with cols[1]:
            st.text(f"₹{signed_amount:,.2f}")
        with cols[2]:
            st.text(r.get("category", ""))
        with cols[3]:
            desc = r.get("description") or "—"
            truncated = desc[:40] + ("…" if desc and len(desc) > 40 else "")
            st.text(truncated)
        with cols[4]:
            b1, b2 = st.columns(2)
            with b1:
                edit_clicked = st.button("Edit", key=f"edit_{row_id}")
                if edit_clicked:
                    st.session_state.editing_transaction = r
                    st.session_state.deleting_transaction = None
                    st.rerun()
            with b2:
                delete_clicked = st.button("Delete", key=f"del_{row_id}")
                if delete_clicked:
                    st.session_state.deleting_transaction = r
                    st.session_state.editing_transaction = None
                    st.rerun()

    if total_count and total_count > 0:
        _show_pagination_footer(total_count, page_size, st.session_state.search_page)
