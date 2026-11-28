"""Wait until the frontend answers on its port, then open it in the default browser."""

import socket
import time
import webbrowser

HOST = "localhost"
PORT = 5173
URL = f"http://{HOST}:{PORT}"
_WAIT_SECONDS = 120
_RETRY_SECONDS = 1


def main() -> None:
    deadline = time.monotonic() + _WAIT_SECONDS
    while time.monotonic() < deadline:
        try:
            socket.create_connection((HOST, PORT), timeout=_RETRY_SECONDS).close()
        except OSError:
            time.sleep(_RETRY_SECONDS)
            continue
        webbrowser.open(URL)
        return
    print(f"Parsel did not come up within {_WAIT_SECONDS}s; open {URL} yourself once it is ready.")


if __name__ == "__main__":
    main()
