"""Add-transaction tab UI for the Personal Finance Tracker Streamlit app."""

from datetime import date

import streamlit as st

from common.api_client import ApiClientError
from common.logger import get_logger
from tracker.client import create_transaction as api_create_transaction
from tracker.constants import CATEGORIES, PAYMENT_METHODS
from tracker.validations import validate_amount, validate_category, validate_transaction_date
from tracker.ui.utils.import_csv_section import render_import_csv_section

REQUIRED_LABEL = "<span style='color: red'>*</span>"
GENERIC_ERROR_MSG = "Sorry, couldn't process your request due to a technical error. Please try again later."

logger = get_logger(__name__)


def render_add_transaction(show_header: bool = True) -> None:
    if show_header:
        st.markdown(
            """
            <div class="chat-main-header">
                <h2>Add Transaction</h2>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with st.form("transaction_form", clear_on_submit=True):
        col_credit_debit, col_amount = st.columns(2)
        with col_credit_debit:
            st.markdown("Credit/Debit " + REQUIRED_LABEL, unsafe_allow_html=True)
            credit_debit = st.selectbox(
                "Credit/Debit",
                options=["Debit", "Credit"],
                index=0,
                label_visibility="collapsed",
            )
        with col_amount:
            st.markdown(f"Amount (₹) {REQUIRED_LABEL}", unsafe_allow_html=True)
            amount = st.number_input(
                "Amount (₹)",
                min_value=0.00,
                step=100.00,
                format="%.2f",
                help="Enter amount in INR",
                label_visibility="collapsed",
            )

        col_category, col_date, col_payment = st.columns(3)
        with col_category:
            st.markdown(f"Category {REQUIRED_LABEL}", unsafe_allow_html=True)
            category = st.selectbox(
                "Category",
                options=CATEGORIES,
                index=None,
                placeholder="Select category",
                label_visibility="collapsed",
            )
        with col_date:
            st.markdown(f"Date {REQUIRED_LABEL}", unsafe_allow_html=True)
            transaction_date = st.date_input("Date", value=date.today(), label_visibility="collapsed")
        with col_payment:
            st.markdown(f"Payment method", unsafe_allow_html=True)
            payment_method = st.selectbox(
                "Payment method",
                options=PAYMENT_METHODS,
                index=None,
                placeholder="Select payment method",
                label_visibility="collapsed",
            )

        description = st.text_input("Description (optional)", placeholder="Short note")
        submitted = st.form_submit_button(
            "Save transaction",
            icon=":material/save:",
            type="primary",
        )

    if submitted:
        errors: list[str] = []
        is_debit = credit_debit == "Debit"
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
                api_create_transaction(
                    amount=float(amount),
                    category=category.strip(),
                    payment_method=payment_method.strip() if payment_method else None,
                    transaction_date=transaction_date,
                    description=description.strip() or None,
                    is_debit=is_debit,
                )
                signed_amount = -amount if is_debit else amount
                st.success(
                    f"Saved: ₹{signed_amount:,.2f} — {category} on {transaction_date}"
                )
            except ApiClientError as e:
                logger.error("Add transaction API error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)
            except Exception as e:
                logger.error("Add transaction unexpected error: %s", e, exc_info=True)
                st.error(GENERIC_ERROR_MSG)

    render_import_csv_section()
