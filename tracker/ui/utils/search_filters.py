"""Controls and filters for the Search tab (date range, quick ranges, category, sort, page size)."""

from datetime import date, timedelta

import streamlit as st

from tracker.constants import CATEGORIES
from tracker.services import export_transactions_csv


def render_search_filters(conn=None):
    """Render search filters and return selected values and whether Search was clicked.
    conn: optional DB connection to reuse for export (avoids extra connection when user exports)."""
    if "search_sort_column" not in st.session_state:
        st.session_state.search_sort_column = "transaction_date"
    if "search_sort_desc" not in st.session_state:
        st.session_state.search_sort_desc = True
    if "search_start_date" not in st.session_state:
        st.session_state.search_start_date = date.today().replace(day=1)
    if "search_end_date" not in st.session_state:
        st.session_state.search_end_date = date.today()

    today = date.today()
    qcol1, qcol2, qcol3, _ = st.columns([1, 1, 1, 2])
    with qcol1:
        if st.button("Today", use_container_width=True, key="quick_today"):
            st.session_state.search_start_date = today
            st.session_state.search_end_date = today
            st.session_state.search_page = 1
            st.session_state.search_results_total = 0
            st.rerun()
    with qcol2:
        if st.button("Last 7 days", use_container_width=True, key="quick_7"):
            st.session_state.search_start_date = today - timedelta(days=6)
            st.session_state.search_end_date = today
            st.session_state.search_page = 1
            st.session_state.search_results_total = 0
            st.rerun()
    with qcol3:
        if st.button("This month", use_container_width=True, key="quick_month"):
            st.session_state.search_start_date = today.replace(day=1)
            st.session_state.search_end_date = today
            st.session_state.search_page = 1
            st.session_state.search_results_total = 0
            st.rerun()

    col11, col12, _ = st.columns([1, 1, 1])
    with col11:
        start_date = st.date_input("From Date", key="search_start_date")
    with col12:
        end_date = st.date_input("To Date", key="search_end_date")

    col21, col22, _ = st.columns([1, 1, 1])
    with col21:
        category = st.selectbox(
            "Category (optional)",
            options=["All"] + CATEGORIES,
            index=0,
        )
    with col22:
        page_size = st.number_input("Per page", min_value=5, max_value=50, value=10, step=5)

    sort_options = [
        ("Date", "transaction_date"),
        ("Amount", "amount"),
    ]
    sort_labels = [opt[0] for opt in sort_options]
    current_col = st.session_state.search_sort_column
    current_index = next(
        (i for i, (_, col) in enumerate(sort_options) if col == current_col),
        0,
    )
    col31, col32 = st.columns([1, 1])
    with col31:
        sort_label = st.selectbox(
            "Sort by",
            options=sort_labels,
            index=current_index,
            key="search_sort_by",
        )
        sort_column = next(col for label, col in sort_options if label == sort_label)
    with col32:
        sort_desc_choice = st.radio(
            "Order",
            options=["Descending", "Ascending"],
            index=0 if st.session_state.search_sort_desc else 1,
            horizontal=True,
            key="search_sort_order",
        )
        sort_desc = sort_desc_choice == "Descending"

    st.session_state.search_sort_column = sort_column
    st.session_state.search_sort_desc = sort_desc

    col_search, col_export = st.columns(2)
    with col_search:
        search_clicked = st.button("Search")
        if search_clicked:
            st.session_state.search_page = 1
    with col_export:
        search_has_run = (
            search_clicked
            or st.session_state.get("search_results_total") is not None
        )
        if search_has_run:
            csv_data = export_transactions_csv(start_date, end_date, category, conn=conn)
            if csv_data:
                st.download_button(
                    "Export to CSV",
                    data=csv_data,
                    file_name=f"transactions_{start_date.isoformat()}_{end_date.isoformat()}.csv",
                    mime="text/csv",
                    use_container_width=True,
                    key="search_export_csv",
                )
            else:
                st.caption("No data to export for current filters.")

    return start_date, end_date, category, page_size, sort_column, sort_desc, search_clicked
