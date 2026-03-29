"""Components for rendering search results table and edit/delete actions on the Search tab."""

from datetime import date, datetime

import streamlit as st

from common.api_client import ApiClientError
from common.logger import get_logger
from tracker.client import delete_transaction as api_delete_transaction
from tracker.client import update_transaction as api_update_transaction
from tracker.constants import CATEGORIES, PAYMENT_METHODS
from tracker.validations import (
    validate_amount,
    validate_category,
    validate_payment_method,
    validate_transaction_date,
)

GENERIC_ERROR_MSG = "Sorry, couldn't process your request due to a technical error. Please try again later."

logger = get_logger(__name__)


def _show_pagination_footer(total_count: int, page_size: int, current_page: int) -> None:
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    col_prev, col_next, _ = st.columns([1, 1, 2])
    with col_prev:
        prev_clicked = st.button(
            "Prev",
            disabled=(current_page <= 1),
            key="search_prev",
            icon=":material/chevron_left:",
            type="tertiary",
            help="Previous page",
        )
    with col_next:
        next_clicked = st.button(
            "Next",
            disabled=(current_page >= total_pages),
            key="search_next",
            icon=":material/chevron_right:",
            type="tertiary",
            help="Next page",
        )
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


def _render_edit_form(row: dict) -> None:
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
        col_credit_debit, col_amount = st.columns(2)
        with col_credit_debit:
            credit_debit = st.selectbox(
                "Credit/Debit",
                options=["Debit", "Credit"],
                index=0 if row.get("is_debit", True) else 1,
                key="edit_credit_debit",
            )
        with col_amount:
            amount = st.number_input(
                "Amount (₹)",
                min_value=0.01,
                value=float(row.get("amount", 0)),
                step=0.01,
                format="%.2f",
                key="edit_amount",
            )

        col_category, col_payment, col_date = st.columns(3)
        with col_category:
            category = st.selectbox(
                "Category",
                options=CATEGORIES,
                index=CATEGORIES.index(row["category"]) if row.get("category") in CATEGORIES else 0,
                key="edit_category",
            )
        with col_payment:
            pm = row.get("payment_method") or "Other"
            payment_method = st.selectbox(
                "Payment method",
                options=PAYMENT_METHODS,
                index=PAYMENT_METHODS.index(pm) if pm in PAYMENT_METHODS else 0,
                key="edit_payment_method",
            )
        with col_date:
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
            submitted = st.form_submit_button(
                "Save",
                icon=":material/check:",
                type="primary",
            )
        with col2:
            cancel = st.form_submit_button(
                "Cancel",
                icon=":material/close:",
                type="tertiary",
            )
        if cancel:
            if "editing_transaction" in st.session_state:
                del st.session_state.editing_transaction
            st.rerun()
        if submitted:
            is_debit = credit_debit == "Debit"
            try:
                validate_amount(amount)
                validate_category(category)
                validate_payment_method(payment_method)
                validate_transaction_date(txn_date)
            except ValueError as e:
                st.error(str(e))
                return
            try:
                api_update_transaction(
                    transaction_id=str(row_id),
                    amount=float(amount),
                    category=category.strip(),
                    payment_method=payment_method.strip(),
                    transaction_date=txn_date,
                    description=(description or "").strip() or None,
                    is_debit=is_debit,
                )
                if "editing_transaction" in st.session_state:
                    del st.session_state.editing_transaction
                # Force a fresh fetch after mutation.
                st.session_state.search_cached_result = None
                st.session_state.search_query_signature = None
                st.session_state.search_last_message = ("Transaction updated.", "success")
                st.rerun()
            except ApiClientError as e:
                logger.error("Update transaction API error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)
            except Exception as e:
                logger.error("Update transaction unexpected error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)


def _render_delete_confirm(row: dict, *, page_row_count: int = 1) -> None:
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
        if st.button(
            "Delete",
            type="primary",
            key="confirm_del",
            icon=":material/delete_forever:",
            help="Permanently delete this transaction",
        ):
            try:
                api_delete_transaction(transaction_id=str(row_id))
                if "deleting_transaction" in st.session_state:
                    del st.session_state.deleting_transaction
                # If the last item on a non-first page was deleted, move back one page.
                current_page = int(st.session_state.get("search_page", 1))
                if current_page > 1 and page_row_count == 1:
                    st.session_state.search_page = current_page - 1
                # Force a fresh fetch after mutation.
                st.session_state.search_cached_result = None
                st.session_state.search_query_signature = None
                st.session_state.search_last_message = ("Transaction deleted.", "success")
                st.rerun()
            except ApiClientError as e:
                logger.error("Delete transaction API error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)
            except Exception as e:
                logger.error("Delete transaction unexpected error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)
    with col2:
        if st.button(
            "Cancel",
            key="cancel_del",
            icon=":material/close:",
            type="tertiary",
        ):
            if "deleting_transaction" in st.session_state:
                del st.session_state.deleting_transaction
            st.rerun()


def render_search_results(rows: list[dict], total_count: int | None, page_size: int) -> None:
    """Render the paginated search results table with edit/delete actions."""
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
        _render_edit_form(st.session_state.editing_transaction)
        st.divider()
    if st.session_state.get("deleting_transaction"):
        _render_delete_confirm(
            st.session_state.deleting_transaction,
            page_row_count=len(rows),
        )
        st.divider()

    offset_start = (st.session_state.search_page - 1) * page_size
    start_one = offset_start + 1
    end_one = min(offset_start + len(rows), total_count)
    st.caption(f"Showing **{start_one}–{end_one}** of **{total_count}** transactions")

    header_cols = st.columns([1, 1, 1, 1, 2, 1])
    headers = ["Date", "Amount", "Category", "Payment", "Description", "Actions"]
    for c, h in zip(header_cols, headers):
        c.markdown(f"**{h}**")

    for r in rows:
        row_id = r.get("id")
        if not row_id:
            continue
        amt = float(r.get("amount", 0))
        is_debit = r.get("is_debit", True)
        signed_amount = -amt if is_debit else amt
        cols = st.columns([1, 1, 1, 1, 2, 1])
        with cols[0]:
            st.text(r.get("transaction_date", ""))
        with cols[1]:
            st.text(f"₹{signed_amount:,.2f}")
        with cols[2]:
            st.text(r.get("category", ""))
        with cols[3]:
            st.text(r.get("payment_method") or "—")
        with cols[4]:
            desc = r.get("description") or "—"
            truncated = desc[:40] + ("…" if desc and len(desc) > 40 else "")
            st.text(truncated)
        with cols[5]:
            b1, b2 = st.columns(2)
            with b1:
                edit_clicked = st.button(
                    "",
                    key=f"edit_{row_id}",
                    icon=":material/edit:",
                    type="tertiary",
                )
                if edit_clicked:
                    st.session_state.editing_transaction = r
                    st.session_state.deleting_transaction = None
                    st.rerun()
            with b2:
                delete_clicked = st.button(
                    "",
                    key=f"del_{row_id}",
                    icon=":material/delete_outline:",
                    type="tertiary",
                )
                if delete_clicked:
                    st.session_state.deleting_transaction = r
                    st.session_state.editing_transaction = None
                    st.rerun()

    if total_count and total_count > 0:
        _show_pagination_footer(total_count, page_size, st.session_state.search_page)
