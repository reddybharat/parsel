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

# Bank / account source (exact values stored in DB)
BANKS = [
    "SBI",
    "Kotak",
    "Slice",
]
BANK_SBI = "SBI"
BANK_KOTAK = "Kotak"
BANK_SLICE = "Slice"

# Used in spend aggregates (trend, monthly spend); not treated as consumption.
INVESTMENTS_CATEGORY = "Investments"
SELF_TRANSFER_CATEGORY = "Self Transfer"
WALLET_TOP_UP_CATEGORY = "Wallet Top-up"
NON_SPEND_CATEGORIES = (
    INVESTMENTS_CATEGORY,
    SELF_TRANSFER_CATEGORY,
    WALLET_TOP_UP_CATEGORY,
)

# Locked system category names are always offered. Each user can also persist a
# small set of custom names in their preferences.
CATEGORY_NAME_MAX_LENGTH = 40
MAX_CUSTOM_CATEGORIES = 10

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
    "Money Lent",
    "Other Income",
    "Personal",
    "Refunds",
    "Rent",
    "Self Transfer",
    "Shopping",
    "Subscriptions",
    "Transportation",
    "Travel",
    "Utilities",
    "Wallet Top-up",
]

# Back-compat alias for older imports / chat schema text.
CATEGORIES = SYSTEM_CATEGORIES

