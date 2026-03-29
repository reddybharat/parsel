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
