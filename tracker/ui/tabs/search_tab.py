"""Search tab UI for the Personal Finance Tracker Streamlit app."""

from datetime import date

import streamlit as st

from common.api_client import ApiClientError
from common.logger import get_logger
from tracker.client import search_transactions as api_search_transactions
from tracker.ui.utils.search_filters import render_search_filters
from tracker.ui.utils.search_results import render_search_results

GENERIC_ERROR_MSG = "Sorry, couldn't process your request due to a technical error. Please try again later."

logger = get_logger(__name__)


def render_search() -> None:
    st.markdown(
        """
        <div class="chat-main-header">
            <h2>Search transactions</h2>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if "search_page" not in st.session_state:
        st.session_state.search_page = 1
    if "search_results_total" not in st.session_state:
        st.session_state.search_results_total = None
    if "editing_transaction" not in st.session_state:
        st.session_state.editing_transaction = None
    if "deleting_transaction" not in st.session_state:
        st.session_state.deleting_transaction = None
    if "search_query_signature" not in st.session_state:
        st.session_state.search_query_signature = None
    if "search_cached_result" not in st.session_state:
        st.session_state.search_cached_result = None
    if "search_has_run" not in st.session_state:
        st.session_state.search_has_run = False
    try:
        (
            start_date,
            end_date,
            category,
            payment_method,
            is_debit_filter,
            page_size,
            sort_column,
            _sort_desc_bool,
            search_clicked,
        ) = render_search_filters()

        if start_date > end_date:
            st.error("From date must be on or before To date.")
        else:
            if search_clicked:
                st.session_state.search_has_run = True
            total_from_last = st.session_state.search_results_total
            run_query = search_clicked or (total_from_last is not None)

            if run_query:
                page = st.session_state.search_page

                allowed_sort_columns = {"transaction_date", "amount"}
                sort_col = st.session_state.search_sort_column
                sort_desc = st.session_state.search_sort_desc

                if sort_col not in allowed_sort_columns:
                    logger.error("Unexpected sort column in UI: %s", sort_col)
                    st.error("Internal error: invalid sort column selected. Please try again.")
                    return

                query_signature = (
                    start_date.isoformat(),
                    end_date.isoformat(),
                    category,
                    payment_method,
                    is_debit_filter,
                    sort_col,
                    sort_desc,
                    page,
                    page_size,
                )
                should_fetch = (
                    search_clicked
                    or st.session_state.search_query_signature != query_signature
                    or st.session_state.search_cached_result is None
                )

                if should_fetch:
                    api_result = api_search_transactions(
                        start_date=start_date,
                        end_date=end_date,
                        category=category,
                        payment_method=payment_method,
                        is_debit=is_debit_filter,
                        sort_column=sort_col,
                        sort_desc=sort_desc,
                        page=page,
                        page_size=page_size,
                    )
                    st.session_state.search_cached_result = api_result
                    st.session_state.search_query_signature = query_signature
                else:
                    api_result = st.session_state.search_cached_result

                total_count = int(api_result.get("total", 0))
                rows = api_result.get("items", []) or []
                st.session_state.search_results_total = total_count

                if total_count == 0:
                    st.info("No transactions found for the selected filters.")
                    st.session_state.search_results_total = 0
                elif not rows:
                    st.info("No transactions on this page.")
                else:
                    render_search_results(rows, total_count, page_size)
            elif st.session_state.search_results_total == 0:
                st.info("No transactions found for the selected filters.")
    except ApiClientError as e:
        logger.error("Search API error: %s", e, exc_info=True)
        st.error(GENERIC_ERROR_MSG)
    except Exception as e:
        logger.error("Search unexpected error: %s", e, exc_info=True)
        st.error(GENERIC_ERROR_MSG)
