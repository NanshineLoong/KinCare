from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid
from typing import Any


class TokenError(ValueError):
    pass


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("utf-8"))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 120_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "$".join(
        [
            "pbkdf2_sha256",
            str(iterations),
            _b64url_encode(salt),
            _b64url_encode(digest),
        ]
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _algorithm, iterations, salt, expected = password_hash.split("$", maxsplit=3)
    except ValueError:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        _b64url_decode(salt),
        int(iterations),
    )
    return hmac.compare_digest(_b64url_encode(digest), expected)


def create_token(
    *,
    subject: str,
    family_space_id: str,
    role: str,
    token_type: str,
    secret: str,
    ttl_seconds: int,
    remember_session: bool = False,
) -> str:
    now = int(time.time())
    payload = {
        "sub": subject,
        "family_space_id": family_space_id,
        "role": role,
        "type": token_type,
        "remember_session": remember_session,
        "iat": now,
        "exp": now + ttl_seconds,
        "jti": uuid.uuid4().hex,
    }
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = ".".join(
        [
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def decode_token(token: str, secret: str) -> dict[str, Any]:
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
    except ValueError as error:
        raise TokenError("Malformed token.") from error

    signing_input = f"{encoded_header}.{encoded_payload}"
    expected_signature = hmac.new(
        secret.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    provided_signature = _b64url_decode(encoded_signature)

    if not hmac.compare_digest(expected_signature, provided_signature):
        raise TokenError("Invalid token signature.")

    try:
        payload = json.loads(_b64url_decode(encoded_payload))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise TokenError("Invalid token payload.") from error

    if int(payload.get("exp", 0)) <= int(time.time()):
        raise TokenError("Token expired.")

    return payload
