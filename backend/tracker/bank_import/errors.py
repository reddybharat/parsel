"""Shared errors for bank statement import (Excel + PDF)."""


class BankStatementPasswordError(ValueError):
    """Raised when a password is missing or incorrect for an encrypted statement."""


class BankStatementParseError(ValueError):
    """Raised when a statement file cannot be interpreted."""
