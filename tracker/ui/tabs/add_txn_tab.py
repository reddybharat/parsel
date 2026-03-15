"""Add-transaction tab UI for the Personal Finance Tracker Streamlit app."""

from datetime import date

import streamlit as st

from tracker.constants import CATEGORIES
from tracker.database import execute_insert
from tracker.validations import validate_amount, validate_category, validate_transaction_date
from tracker.ui.utils.import_csv_section import render_import_csv_section
from tracker.ui.common import DATABASE_ERROR_MSG, is_db_connection_error

REQUIRED_LABEL = "<span style='color: red'>*</span>"


def render_add_transaction() -> None:
    st.markdown(
        """
        <div class="chat-main-header">
            <h2>Add Transaction</h2>
        </div>
        """,
        unsafe_allow_html=True,
    )
    with st.form("transaction_form", clear_on_submit=True):
        st.markdown(f"Amount (₹) {REQUIRED_LABEL}", unsafe_allow_html=True)
        amount = st.number_input(
            "Amount (₹)",
            min_value=0.00,
            step=100.00,
            format="%.2f",
            help="Enter amount in INR",
            label_visibility="collapsed",
        )
        st.markdown(f"Category {REQUIRED_LABEL}", unsafe_allow_html=True)
        category = st.selectbox(
            "Category",
            options=CATEGORIES,
            index=None,
            placeholder="Select category",
            label_visibility="collapsed",
        )
        st.markdown(f"Date {REQUIRED_LABEL}", unsafe_allow_html=True)
        transaction_date = st.date_input("Date", value=date.today(), label_visibility="collapsed")
        description = st.text_input("Description (optional)", placeholder="Short note")
        submitted = st.form_submit_button("Save transaction")

    conn = st.session_state.get("db_conn")
    if conn is None:
        if submitted:
            st.error("Database not configured. Set DATABASE_URL in .env to add transactions.")
        return

    if submitted:
        errors: list[str] = []
        try:
            validate_amount(amount)
        except ValueError as e:
            errors.append(str(e))
        try:
            validate_category(category)
        except ValueError as e:
            errors.append(str(e))
        try:
            validate_transaction_date(transaction_date)
        except ValueError as e:
            errors.append(str(e))

        if errors:
            for msg in errors:
                st.error(msg)
        else:
            try:
                sql = """
                    INSERT INTO transactions (amount, category, transaction_date, description)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """
                params = (
                    float(amount),
                    category.strip(),
                    transaction_date.isoformat(),
                    description.strip() or None,
                )
                rows = execute_insert(sql, params, conn=conn)
                if rows:
                    conn.commit()
                    st.success(f"Saved: ₹{amount:,.2f} — {category} on {transaction_date}")
                else:
                    st.error("Insert failed. Check your database.")
            except ValueError as e:
                st.error(str(e))
            except Exception as e:
                err = str(e)
                if is_db_connection_error(err):
                    st.error(DATABASE_ERROR_MSG)
                else:
                    st.error(f"Error: {err}")

    render_import_csv_section(conn)
