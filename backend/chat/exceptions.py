"""Chat-specific exceptions."""


class UnknownThreadError(ValueError):
    def __init__(self, thread_id: str) -> None:
        self.thread_id = thread_id
        super().__init__(f"Unknown thread_id: {thread_id}")
