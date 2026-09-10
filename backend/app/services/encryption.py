"""
Fernet symmetric encryption for API key storage.

Key priority (highest first):
  1. ENCRYPTION_KEY environment variable  — used in production/cloud (base64-encoded Fernet key)
  2. .keyfile on disk                     — local dev fallback; never committed to VCS

To generate a fresh key for production:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
Then set it as the ENCRYPTION_KEY environment variable in your cloud host dashboard.
"""
from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet

KEY_FILE = Path(__file__).parent.parent.parent / ".keyfile"


def _load_or_create_key() -> bytes:
    # 1. Prefer env var (production / cloud deployments)
    env_key = os.environ.get("ENCRYPTION_KEY", "").strip()
    if env_key:
        return env_key.encode()

    # 2. Fall back to .keyfile (local development)
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
