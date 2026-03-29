"""Controls and filters for the Search tab (date range, quick ranges, category, sort, page size)."""

from datetime import date, timedelta

import streamlit as st

from common.api_client import ApiClientError
from common.logger import get_logger
from tracker.client import export_transactions_csv
from tracker.constants import CATEGORIES, PAYMENT_METHODS

GENERIC_ERROR_MSG = "Sorry, couldn't process your request due to a technical error. Please try again later."

logger = get_logger(__name__)


def render_search_filters():
    """Render search filters and return selected values and whether Search was clicked."""
    if "search_sort_column" not in st.session_state:
        st.session_state.search_sort_column = "transaction_date"
    if "search_sort_desc" not in st.session_state:
        st.session_state.search_sort_desc = True
    if "search_start_date" not in st.session_state:
        st.session_state.search_start_date = date.today().replace(day=1)
    if "search_end_date" not in st.session_state:
        st.session_state.search_end_date = date.today()

    today = date.today()
    quick_search_clicked = False
    # Use three equal full-width columns — a fourth narrow column was squeezing
    # buttons (~20% width each) and caused label wrap + broken layout.
    qcol1, qcol2, qcol3 = st.columns(3, gap="small")
    with qcol1:
        if st.button(
            "Today",
            use_container_width=True,
            key="quick_today",
            icon=":material/calendar_today:",
            type="secondary",
        ):
            st.session_state.search_start_date = today
            st.session_state.search_end_date = today
            st.session_state.search_page = 1
            quick_search_clicked = True
    with qcol2:
        if st.button(
            "Last 7 days",
            use_container_width=True,
            key="quick_7",
            icon=":material/date_range:",
            type="secondary",
        ):
            st.session_state.search_start_date = today - timedelta(days=6)
            st.session_state.search_end_date = today
            st.session_state.search_page = 1
            quick_search_clicked = True
    with qcol3:
        if st.button(
            "This month",
            use_container_width=True,
            key="quick_month",
            icon=":material/calendar_month:",
            type="secondary",
        ):
            st.session_state.search_start_date = today.replace(day=1)
            st.session_state.search_end_date = today
            st.session_state.search_page = 1
            quick_search_clicked = True

    dcol1, dcol2 = st.columns(2, gap="small")
    with dcol1:
        start_date = st.date_input("From Date", key="search_start_date")
    with dcol2:
        end_date = st.date_input("To Date", key="search_end_date")

    col21, col22, col23 = st.columns([1, 1, 1])
    with col21:
        category = st.selectbox(
            "Category",
            options=["All"] + CATEGORIES,
            index=0,
        )
    with col22:
        payment_method = st.selectbox(
            "Payment method",
            options=["All"] + PAYMENT_METHODS,
            index=0,
        )
    with col23:
        credit_debit = st.selectbox(
            "Credit/Debit",
            options=["All", "Credit", "Debit"],
            index=0,
        )

    is_debit_filter = None
    if credit_debit == "Debit":
        is_debit_filter = True
    elif credit_debit == "Credit":
        is_debit_filter = False

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
    col31, col32, col33 = st.columns([1, 2, 1])
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
    with col33:
        page_size = st.number_input("Per page", min_value=10, max_value=50, value=15, step=5)

    st.session_state.search_sort_column = sort_column
    st.session_state.search_sort_desc = sort_desc

    col_search, col_export = st.columns(2)
    with col_search:
        search_clicked = (
            st.button(
                "Search",
                use_container_width=True,
                key="search_run",
                icon=":material/search:",
                type="primary",
            )
            or quick_search_clicked
        )
        if search_clicked:
            st.session_state.search_page = 1
    with col_export:
        # Show export on first search this run — search_has_run is set in search_tab
        # *after* this function returns, so it would hide Export until the next rerun.
        has_searched = bool(st.session_state.get("search_has_run", False)) or search_clicked
        if has_searched:
            export_signature = (
                start_date.isoformat(),
                end_date.isoformat(),
                category,
                payment_method,
            )
            cached_export_signature = st.session_state.get("search_export_signature")
            csv_data = st.session_state.get("search_export_csv_data")
            if cached_export_signature != export_signature or not csv_data:
                try:
                    csv_data = export_transactions_csv(
                        start_date, end_date, category, payment_method
                    )
                    st.session_state.search_export_signature = export_signature
                    st.session_state.search_export_csv_data = csv_data
                except ApiClientError as e:
                    logger.error("Export CSV API error: %s", e, exc_info=True)
                    st.error(GENERIC_ERROR_MSG)
                    csv_data = ""
                except Exception as e:
                    logger.error("Export CSV unexpected error: %s", e, exc_info=True)
                    st.error(GENERIC_ERROR_MSG)
                    csv_data = ""

            if csv_data:
                st.download_button(
                    "Export CSV",
                    data=csv_data,
                    file_name=f"transactions_{start_date.isoformat()}_{end_date.isoformat()}.csv",
                    mime="text/csv",
                    use_container_width=True,
                    key="search_export_csv",
                    icon=":material/download:",
                    type="secondary",
                )
            else:
                st.caption("No data to export for current filters.")

    return (
        start_date,
        end_date,
        category,
        payment_method,
        is_debit_filter,
        page_size,
        sort_column,
        sort_desc,
        search_clicked,
    )
