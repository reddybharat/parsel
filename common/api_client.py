from __future__ import annotations

import os
from typing import Any, Mapping

import requests


API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
DEFAULT_TIMEOUT_SECONDS = 30


class ApiClientError(RuntimeError):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f"API error {status_code}: {message}")
        self.status_code = status_code
        self.message = message


def _build_url(path: str) -> str:
    if not path.startswith("/"):
        path = "/" + path
    return API_BASE_URL.rstrip("/") + path


def get(path: str, *, params: Mapping[str, Any] | None = None, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> Any:
    url = _build_url(path)
    resp = requests.get(url, params=params, timeout=timeout)
    _raise_for_status(resp)
    return resp.json()


def get_text(path: str, *, params: Mapping[str, Any] | None = None, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> str:
    url = _build_url(path)
    resp = requests.get(url, params=params, timeout=timeout)
    _raise_for_status(resp)
    return resp.text


def post(path: str, *, json: Mapping[str, Any] | None = None, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> Any:
    url = _build_url(path)
    resp = requests.post(url, json=json, timeout=timeout)
    _raise_for_status(resp)
    return resp.json()


def post_bytes(path: str, *, data: bytes, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> Any:
    url = _build_url(path)
    resp = requests.post(url, data=data, headers={"Content-Type": "application/octet-stream"}, timeout=timeout)
    _raise_for_status(resp)
    return resp.json()


def patch(path: str, *, json: Mapping[str, Any] | None = None, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> Any:
    url = _build_url(path)
    resp = requests.patch(url, json=json, timeout=timeout)
    _raise_for_status(resp)
    return resp.json()


def delete(path: str, *, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> None:
    url = _build_url(path)
    resp = requests.delete(url, timeout=timeout)
    _raise_for_status(resp)


def _raise_for_status(response: requests.Response) -> None:
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        # Try to surface API error message if present
        message: str
        try:
            body = response.json()
            if isinstance(body, dict) and "detail" in body:
                message = str(body["detail"])
            else:
                message = str(body)
        except Exception:
            message = response.text[:200]
        raise ApiClientError(response.status_code, message) from exc

