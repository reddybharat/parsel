import importlib


def test_streamlit_tabs_import():
    add_tab = importlib.import_module("tracker.ui.tabs.add_txn_tab")
    search_tab = importlib.import_module("tracker.ui.tabs.search_tab")
    chat_tab = importlib.import_module("chat.ui.chat_tab")

    assert hasattr(add_tab, "render_add_transaction")
    assert hasattr(search_tab, "render_search")
    assert hasattr(chat_tab, "render_chat")

