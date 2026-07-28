"""
Shared constants for the tracker (transaction categories, etc.).
"""

# How the transaction was paid (exact values stored in DB)
PAYMENT_METHODS = [
    "Cash",
    "UPI",
    "Bank transfer",
    "Card",
    "Wallet",
    "NEFT",
    "Other",
]

# Used in spend aggregates (trend, monthly spend); not treated as consumption.
INVESTMENTS_CATEGORY = "Investments"

# Locked system category names (always offered). Custom names appear when used
# on at least one transaction and can be renamed while in use.
CATEGORY_NAME_MAX_LENGTH = 40

SYSTEM_CATEGORIES = [
    "Dining",
    "EMI",
    "Entertainment",
    "Gifts",
    "Grocery",
    "Health",
    "Housing",
    "Income",
    "Investments",
    "Misc",
    "Other Income",
    "Personal",
    "Refunds",
    "Rent",
    "Shopping",
    "Subscriptions",
    "Transportation",
    "Travel",
    "Utilities",
]

# Back-compat alias for older imports / chat schema text.
CATEGORIES = SYSTEM_CATEGORIES

