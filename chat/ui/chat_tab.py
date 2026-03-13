"""Chat tab UI — LangGraph SQL agent chatbot for the Personal Finance Tracker."""

import streamlit as st

from common.logger import get_logger

logger = get_logger(__name__)

_SUGGESTED_QUESTIONS = [
    "What is my total spend this month?",
    "Show spending by category for this month",
    "What are my last 10 transactions?",
    "Where did I spend the most?",
]


def render_chat() -> None:
    _ensure_state()

    # Custom CSS scoped to the chat tab; keep colors close to default Streamlit light theme.
    st.markdown(
        """
        <style>
            .chat-main-header {
                padding: 0.5rem 1.1rem;
                border-radius: 0.6rem;
                background: linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%);
                border: 1px solid #e5e7eb;
                margin-bottom: 0.8rem;
            }
            .chat-main-header h2 {
                margin: 0;
                font-size: 1.4rem;
            }
            .chat-block-container {
                max-width: 900px;
                margin-left: auto;
                margin-right: auto;
            }
            .chat-message {
                padding: 0.9rem 1rem;
                border-radius: 0.75rem;
                margin-bottom: 0.85rem;
                border: 1px solid #e5e7eb;
                box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
                font-size: 0.95rem;
            }
            .chat-message.user {
                background: #eff6ff;
                margin-left: 15%;
                margin-right: 5%;
                border-left: 3px solid #3b82f6;
            }
            .chat-message.assistant {
                background: #f9fafb;
                margin-left: 5%;
                margin-right: 15%;
                border-left: 3px solid #6b7280;
            }
            .chat-message .chat-role {
                font-weight: 600;
                margin-bottom: 0.25rem;
                display: block;
                color: #374151;
            }
            .chat-suggest-label {
                font-weight: 600;
                margin-bottom: 0.4rem;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )

    with st.container():
        st.markdown(
            """
            <div class="chat-main-header">
                <h2>Finance Assistant</h2>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with st.container():
        st.markdown('<div class="chat-block-container">', unsafe_allow_html=True)

        # Chat history
        if st.session_state.chat_messages:
            for msg in st.session_state.chat_messages:
                role = msg.get("role", "assistant")
                content = msg.get("content", "")
                css_class = "assistant" if role != "user" else "user"
                role_label = "You" if role == "user" else "Assistant"
                st.markdown(
                    f"""
                    <div class="chat-message {css_class}">
                        <span class="chat-role">{role_label}</span>
                        <div>{content}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
        else:
            st.info(
                "Start a conversation by asking a question about your finances or use one of the quick suggestions below."
            )

        # Suggested questions when there is no history
        if not st.session_state.chat_messages:
            st.markdown('<div class="chat-suggest-label">Try one of these:</div>', unsafe_allow_html=True)
            cols = st.columns(2)
            for i, q in enumerate(_SUGGESTED_QUESTIONS):
                with cols[i % 2]:
                    if st.button(q, key=f"chat_suggest_{i}", use_container_width=True, disabled=st.session_state.chat_is_processing):
                        _handle_user_input(q)
                        st.markdown("</div>", unsafe_allow_html=True)
                        return

        # Input area
        query_key = f"chat_query_{st.session_state.chat_query_counter}"
        query = st.text_area(
            "Ask about your finances…",
            value="",
            key=query_key,
            height=80,
            placeholder="Type your question here…",
            label_visibility="collapsed",
            disabled=st.session_state.chat_is_processing,
        )

        col1, col2 = st.columns([1, 1])
        with col1:
            submit_clicked = st.button(
                "Submit",
                type="primary",
                use_container_width=True,
                disabled=not query.strip() or st.session_state.chat_is_processing,
                key="chat_submit",
            )
        with col2:
            reset_clicked = st.button(
                "Reset chat",
                type="secondary",
                use_container_width=True,
                disabled=st.session_state.chat_is_processing,
                key="chat_reset",
            )

        if submit_clicked:
            _handle_user_input(query.strip())
        elif reset_clicked:
            _reset_chat()

        st.markdown("</div>", unsafe_allow_html=True)


def _handle_user_input(user_input: str) -> None:
    """Append user message, invoke agent, append reply, rerun."""
    _ensure_state()
    if not user_input:
        return

    st.session_state.chat_is_processing = True
    st.session_state.chat_messages.append({"role": "user", "content": user_input})

    with st.spinner("Thinking…"):
        reply = _invoke_agent()

    st.session_state.chat_messages.append({"role": "assistant", "content": reply})
    st.session_state.chat_is_processing = False
    st.session_state.chat_query_counter += 1
    st.rerun()


def _reset_chat() -> None:
    """Clear chat state for this tab."""
    _ensure_state()
    st.session_state.chat_messages = []
    st.session_state.chat_is_processing = False
    st.session_state.chat_query_counter += 1
    st.rerun()


def _ensure_state() -> None:
    """Initialize chat-related session state keys if missing."""
    if "chat_messages" not in st.session_state:
        st.session_state.chat_messages = []
    if "chat_is_processing" not in st.session_state:
        st.session_state.chat_is_processing = False
    if "chat_query_counter" not in st.session_state:
        st.session_state.chat_query_counter = 0


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
