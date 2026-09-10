"""
Fernet symmetric encryption for API key storage.
Key is generated once and stored in a local key file (never committed to VCS).
"""
from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet

KEY_FILE = Path(__file__).parent.parent.parent / ".keyfile"


def _load_or_create_key() -> bytes:
    if KEY_FILE.exists():
        return KEY_FILE.read_bytes()
    key = Fernet.generate_key()
    KEY_FILE.write_bytes(key)
    # Restrict permissions on Unix
    try:
        os.chmod(KEY_FILE, 0o600)
    except Exception:
        pass
    return key


def _fernet() -> Fernet:
    return Fernet(_load_or_create_key())


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string and return base64-encoded ciphertext."""
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a ciphertext string and return the original plaintext."""
    if not ciphertext:
        return ""
    return _fernet().decrypt(ciphertext.encode()).decode()
