"""Chat tab UI — LangGraph SQL agent chatbot for the Personal Finance Tracker."""

import streamlit as st

from common.api_client import ApiClientError
from common.logger import get_logger
from chat.client import chat_exit, chat_invoke, chat_resume
from tracker.ui.common import GENERIC_ERROR_MSG

logger = get_logger(__name__)

_SUGGESTED_QUESTIONS = [
    "Total spend this month?",
    "Category breakdown this month?",
    "Last 10 transactions?",
    "Where did I spend most?",
]


def render_chat() -> None:
    _ensure_state()

    # Keep chat-specific layout minimal; visual theme comes from global coffee theme.
    st.markdown(
        """
        <style>
            .chat-block-container {
                max-width: 900px;
                margin-left: auto;
                margin-right: auto;
            }
            .chat-suggest-label {
                font-weight: 600;
                margin-bottom: 0.5rem;
                color: var(--coffee-text);
            }
        </style>
        """,
        unsafe_allow_html=True,
    )

    with st.container():
        st.markdown('<div class="chat-block-container">', unsafe_allow_html=True)

        # Chat history (assistant messages rendered as markdown)
        if st.session_state.chat_messages:
            for msg in st.session_state.chat_messages:
                role = msg.get("role", "assistant")
                content = msg.get("content", "") or ""
                with st.chat_message(role):
                    st.markdown(content)
        else:
            st.info(
                "Start a conversation by asking a question about your finances or use one of the quick suggestions below."
            )

        # Suggested questions when there is no history (single column so rows align)
        if not st.session_state.chat_messages:
            st.markdown('<div class="chat-suggest-label">Try one of these:</div>', unsafe_allow_html=True)
            for i, q in enumerate(_SUGGESTED_QUESTIONS):
                if st.button(
                    q,
                    key=f"chat_suggest_{i}",
                    use_container_width=True,
                    disabled=st.session_state.chat_is_processing,
                    type="secondary",
                ):
                    _handle_user_input(q)
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
        reply = _invoke_agent(user_input)

    st.session_state.chat_messages.append({"role": "assistant", "content": reply})
    st.session_state.chat_is_processing = False
    st.session_state.chat_query_counter += 1
    st.rerun()


def _reset_chat() -> None:
    """Clear chat state for this tab and end the server-side thread."""
    _ensure_state()
    thread_id = st.session_state.get("chat_thread_id")
    if thread_id:
        try:
            chat_exit(thread_id)
        except ApiClientError as e:
            logger.warning("Chat exit failed (thread may already be gone): %s", e)
        except Exception as e:
            logger.warning("Chat exit failed: %s", e)
    st.session_state.chat_messages = []
    st.session_state.chat_thread_id = None
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
    if "chat_thread_id" not in st.session_state:
        st.session_state.chat_thread_id = None


def _invoke_agent(user_message: str) -> str:
    """Call the chat API and return the reply text."""
    try:
        thread_id = st.session_state.chat_thread_id
        if thread_id:
            logger.info("Resuming chat thread_id=%s", thread_id)
            result = chat_resume(thread_id, user_message)
        else:
            logger.info("Starting new chat thread")
            result = chat_invoke(user_message)
            new_thread_id = result.get("thread_id")
            if new_thread_id:
                st.session_state.chat_thread_id = str(new_thread_id)

        reply = str(result.get("reply", ""))
        logger.info("Chat API returned reply (%d chars)", len(reply))
        if not reply:
            return "No reply received from the chat API."
        return reply
    except ApiClientError as e:
        logger.error("Chat API configuration/HTTP error: %s", e, exc_info=True)
        return GENERIC_ERROR_MSG
    except Exception as e:
        logger.error("Chat API invocation failed: %s", e, exc_info=True)
        return GENERIC_ERROR_MSG
