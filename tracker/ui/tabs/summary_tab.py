"""Summary tab UI for the Personal Finance Tracker Streamlit app."""

from datetime import date

import streamlit as st

from tracker.database import execute_query
from tracker.ui.common import DATABASE_ERROR_MSG, is_db_connection_error


def render_summary() -> None:
    st.subheader("Summary")
    try:
        today = date.today()
        start = today.replace(day=1).isoformat()
        end = today.isoformat()
        sql = """
            SELECT amount, category FROM transactions
            WHERE transaction_date >= %s AND transaction_date <= %s
        """
        rows = execute_query(sql, (start, end))
        total = 0.0
        by_category: dict[str, float] = {}
        for row in rows:
            amt = float(row.get("amount", 0))
            cat = row.get("category") or "Uncategorized"
            total += amt
            by_category[cat] = by_category.get(cat, 0) + amt
        st.metric("Total spend", f"₹{total:,.2f}")
        if by_category:
            st.caption("By category")
            for cat, val in sorted(by_category.items()):
                st.write(f"• **{cat}**: ₹{val:,.2f}")
        else:
            st.caption("No transactions this month yet.")

        # Latest 5–7 transactions
        st.subheader("Latest transactions")
        latest_sql = """
            SELECT id, amount, category, transaction_date, description
            FROM transactions
            ORDER BY transaction_date DESC
            LIMIT 7
        """
        latest_rows = execute_query(latest_sql)
        if not latest_rows:
            st.caption("No transactions yet.")
        else:
            table_data = [
                {
                    "Date": r.get("transaction_date", ""),
                    "Amount (₹)": f"₹{float(r.get('amount', 0)):,.2f}",
                    "Category": r.get("category", ""),
                    "Description": r.get("description") or "—",
                }
                for r in latest_rows
            ]
            st.dataframe(table_data, width="stretch", hide_index=True)
    except ValueError:
        st.warning("Database not configured. Set DATABASE_URL in .env to see summary.")
    except Exception as e:
        err = str(e)
        if is_db_connection_error(err):
            st.warning(DATABASE_ERROR_MSG)
        else:
            st.warning(f"Could not load summary: {err[:200]}" + ("…" if len(err) > 200 else ""))
