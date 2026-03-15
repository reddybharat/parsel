"""Search tab UI for the Personal Finance Tracker Streamlit app."""

from datetime import date

import streamlit as st

from tracker.database import execute_query
from tracker.ui.common import DATABASE_ERROR_MSG, is_db_connection_error
from tracker.ui.utils.search_filters import render_search_filters
from tracker.ui.utils.search_results import render_search_results


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
    conn = st.session_state.get("db_conn")
    if conn is None:
        st.warning("Database not configured. Set DATABASE_URL in .env to search.")
        return
    try:
        start_date, end_date, category, page_size, sort_column, sort_desc_bool, search_clicked = render_search_filters(conn)

        if start_date > end_date:
            st.error("From date must be on or before To date.")
        else:
            total_from_last = st.session_state.search_results_total
            run_query = search_clicked or (total_from_last is not None)

            if run_query:
                page = st.session_state.search_page
                offset_start = (page - 1) * page_size

                sort_col = st.session_state.search_sort_column
                sort_desc = st.session_state.search_sort_desc
                order_dir = "DESC" if sort_desc else "ASC"
                order_clause = f"ORDER BY {sort_col} {order_dir}"

                cols = "id, amount, category, transaction_date, description, created_at, updated_at, version_no"
                if category and category != "All":
                    count_sql = """
                        SELECT COUNT(*) AS n FROM transactions
                        WHERE transaction_date >= %s AND transaction_date <= %s AND category = %s
                    """
                    count_params: tuple = (start_date.isoformat(), end_date.isoformat(), category)
                    data_sql = f"""
                        SELECT {cols} FROM transactions
                        WHERE transaction_date >= %s AND transaction_date <= %s AND category = %s
                        {order_clause}
                        LIMIT %s OFFSET %s
                    """
                    data_params = (start_date.isoformat(), end_date.isoformat(), category, page_size, offset_start)
                else:
                    count_sql = """
                        SELECT COUNT(*) AS n FROM transactions
                        WHERE transaction_date >= %s AND transaction_date <= %s
                    """
                    count_params = (start_date.isoformat(), end_date.isoformat())
                    data_sql = f"""
                        SELECT {cols} FROM transactions
                        WHERE transaction_date >= %s AND transaction_date <= %s
                        {order_clause}
                        LIMIT %s OFFSET %s
                    """
                    data_params = (start_date.isoformat(), end_date.isoformat(), page_size, offset_start)

                count_rows = execute_query(count_sql, count_params, conn=conn)
                total_count = int(count_rows[0]["n"]) if count_rows else 0
                st.session_state.search_results_total = total_count

                rows = execute_query(data_sql, data_params, conn=conn)

                if total_count == 0:
                    st.info("No transactions found for the selected filters.")
                    st.session_state.search_results_total = 0
                elif not rows:
                    st.info("No transactions on this page.")
                else:
                    render_search_results(rows, total_count, page_size, conn=conn)
            elif total_from_last is not None and total_from_last == 0:
                st.info("No transactions found for the selected filters.")
    except ValueError:
        st.warning("Database not configured. Set DATABASE_URL in .env to search.")
    except Exception as e:
        err = str(e)
        if is_db_connection_error(err):
            st.warning(DATABASE_ERROR_MSG)
        else:
            st.warning(f"Could not search: {err[:200]}" + ("…" if len(err) > 200 else ""))
