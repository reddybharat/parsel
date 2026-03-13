"""Import from CSV UI for the Add Transaction tab (template download + file upload + import)."""

from typing import TYPE_CHECKING, Optional

import streamlit as st

from tracker.constants import CATEGORIES
from tracker.services import (
    import_transactions_from_csv,
    transactions_csv_template,
)

if TYPE_CHECKING:
    from streamlit.runtime.uploaded_file_manager import UploadedFile


def render_import_csv_section() -> None:
    """Render the 'Import from CSV' expander: download template, file uploader, and Import button."""
    with st.expander("Import from CSV", expanded=False):
        template_csv = transactions_csv_template()
        st.download_button(
            "Download template",
            data=template_csv,
            file_name="transactions_import_template.csv",
            mime="text/csv",
            use_container_width=True,
            key="add_txn_import_template",
        )
        st.caption(
            "Template has correct headers and example rows. Use YYYY-MM-DD for dates; "
            f"category must be one of: {', '.join(CATEGORIES)}."
        )
        uploaded_file: Optional["UploadedFile"] = st.file_uploader(
            "Import CSV",
            type=["csv"],
            accept_multiple_files=False,
            key="add_txn_import_csv",
        )
        if uploaded_file is not None:
            if st.button("Import", use_container_width=True, key="add_txn_import_btn"):
                content = uploaded_file.getvalue()
                inserted, import_errors = import_transactions_from_csv(content)
                if inserted:
                    st.success(
                        f"Imported {inserted} transaction(s) from CSV."
                    )
                if import_errors:
                    err_preview = "\n- ".join(import_errors[:20])
                    more = (
                        "\n… (showing first 20 errors)"
                        if len(import_errors) > 20
                        else ""
                    )
                    st.warning(
                        "Some rows could not be imported:\n- "
                        + err_preview
                        + more
                    )
