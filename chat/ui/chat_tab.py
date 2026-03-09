"""Chat tab UI — LangGraph SQL agent chatbot for the Personal Finance Tracker."""

import streamlit as st

from common.logger import get_logger

logger = get_logger(__name__)

_SUGGESTED_QUESTIONS = [
    "What is my total spend this month?",
    "Show spending by category for this month",
    "What are my last 10 transactions?",
    "Which category did I spend the most on this year?",
]


def render_chat() -> None:
    st.subheader("Finance Assistant")
    st.caption(
        "Ask questions about your transactions in plain English. "
        "The assistant will query your database and summarize the results."
    )

    if "chat_messages" not in st.session_state:
        st.session_state.chat_messages = []

    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if not st.session_state.chat_messages:
        st.markdown("**Try one of these:**")
        cols = st.columns(2)
        for i, q in enumerate(_SUGGESTED_QUESTIONS):
            with cols[i % 2]:
                if st.button(q, key=f"suggest_{i}", use_container_width=True):
                    _handle_user_input(q)
                    return

    user_input = st.chat_input("Ask about your finances…")
    if user_input:
        _handle_user_input(user_input)


def _handle_user_input(user_input: str) -> None:
    """Append user message, invoke agent, append reply, rerun."""
    st.session_state.chat_messages.append({"role": "user", "content": user_input})

    with st.chat_message("user"):
        st.markdown(user_input)

    with st.chat_message("assistant"):
        with st.spinner("Thinking…"):
            reply = _invoke_agent()
        st.markdown(reply)

    st.session_state.chat_messages.append({"role": "assistant", "content": reply})
    st.rerun()


def _invoke_agent() -> str:
    """Call the LangGraph agent and return the reply text."""
    try:
        logger.info("Invoking agent with %d messages", len(st.session_state.chat_messages))
        from chat.agent.graph import run_agent

        reply = run_agent(st.session_state.chat_messages)
        logger.info("Agent returned reply (%d chars)", len(reply))
        return reply
    except ValueError as e:
        logger.error("Configuration error: %s", e, exc_info=True)
        return (
            f"**Configuration error:** {e}\n\n"
            "Please set the required environment variables in `.env`."
        )
    except Exception as e:
        logger.error("Agent invocation failed: %s", e, exc_info=True)
        return (
            f"Sorry, something went wrong: **{type(e).__name__}: {e}**\n\n"
            "Check the terminal logs for details."
        )
