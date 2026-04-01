"""
Shared constants for the tracker (transaction categories, etc.).
"""

# Allowed transaction categories (exact values stored in DB)
# How the transaction was paid (exact values stored in DB)
PAYMENT_METHODS = [
    "Cash",
    "UPI",
    "Bank transfer",
    "Card",
    "Wallet",
    "Other",
]

# Used in spend aggregates (trend, monthly spend); not treated as consumption.
INVESTMENTS_CATEGORY = "Investments"

CATEGORIES = [
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
