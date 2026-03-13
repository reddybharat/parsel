"""Components for rendering search results table and edit/delete actions on the Search tab."""

from datetime import date

import streamlit as st

from tracker.constants import CATEGORIES
from tracker.database import execute_update_delete, execute_update_returning
from tracker.validations import validate_amount, validate_category, validate_transaction_date


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


def _render_edit_form(row: dict) -> None:
    row_id = row.get("id")
    if not row_id:
        return
    with st.form(key="edit_txn_form"):
        st.caption("Edit transaction")
        amount = st.number_input(
            "Amount (₹)",
            min_value=0.01,
            value=float(row.get("amount", 0)),
            step=0.01,
            format="%.2f",
            key="edit_amount",
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
            try:
                validate_amount(amount)
                validate_category(category)
                validate_transaction_date(txn_date)
            except ValueError as e:
                st.error(str(e))
                return
            try:
                sql = """
                    UPDATE transactions
                    SET amount = %s, category = %s, transaction_date = %s, description = %s
                    WHERE id = %s
                    RETURNING id
                """
                params = (amount, category.strip(), txn_date.isoformat(), (description or "").strip() or None, row_id)
                execute_update_returning(sql, params)
                if "editing_transaction" in st.session_state:
                    del st.session_state.editing_transaction
                st.success("Transaction updated.")
                st.rerun()
            except Exception as e:
                st.error(f"Update failed: {str(e)[:200]}")


def _render_delete_confirm(row: dict) -> None:
    row_id = row.get("id")
    if not row_id:
        return
    amt = row.get("amount", 0)
    cat = row.get("category", "")
    st.warning(f"Delete this transaction? **₹{float(amt):,.2f}** — {cat}")
    col1, col2, _ = st.columns([1, 1, 2])
    with col1:
        if st.button("Confirm delete", type="primary", key="confirm_del"):
            try:
                rowcount = execute_update_delete("DELETE FROM transactions WHERE id = %s", (row_id,))
                if rowcount > 0:
                    if "deleting_transaction" in st.session_state:
                        del st.session_state.deleting_transaction
                    st.success("Transaction deleted.")
                    st.rerun()
                else:
                    st.error("Transaction not found or already deleted.")
            except Exception as e:
                st.error(f"Delete failed: {str(e)[:200]}")
    with col2:
        if st.button("Cancel", key="cancel_del"):
            if "deleting_transaction" in st.session_state:
                del st.session_state.deleting_transaction
            st.rerun()


def render_search_results(rows: list[dict], total_count: int | None, page_size: int) -> None:
    """Render the paginated search results table with edit/delete actions."""
    if not rows:
        return

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
        _render_delete_confirm(st.session_state.deleting_transaction)
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
        cols = st.columns([1, 1, 1, 2, 2])
        with cols[0]:
            st.text(r.get("transaction_date", ""))
        with cols[1]:
            st.text(f"₹{float(r.get('amount', 0)):,.2f}")
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
