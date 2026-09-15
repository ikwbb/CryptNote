# Security model

## Encryption

Web Crypto derives a non-extractable AES-256-GCM key with PBKDF2-SHA-256, 600,000 iterations and a fresh random 16-byte salt per message. Every encryption also generates a fresh 12-byte IV. The binary envelope contains salt (16 bytes), IV (12 bytes), and ciphertext including a 16-byte GCM tag. Plaintext is 1–65,536 UTF-8 bytes. The server bounds streamed requests to 65,580 bytes.

Salt prevents reuse of precomputed password tables; it does not make weak passwords immune to offline guessing. QR passwords contain 32 random bytes encoded as 64 hex characters (256 bits). Sending requires at least 16 characters for manual passwords; length alone does not imply strength. Generated-password QR payloads use `cryptnote:v1:<64 lowercase hex characters>`. Existing passwords can be shared as `cryptnote:v2:<percent-encoded password>`. Both are local data, not URLs. Scanning never navigates to QR content.

This app never sends passwords or plaintext. HTTPS additionally protects transport. The public API can validate size, not prove arbitrary callers encrypted their input. Anyone who sees the QR can decrypt notes protected by that password. Exchange it privately.

## Short links

Case-sensitive ASCII letters and digits provide 62³ = 238,328 codes. Codes are locators, not authentication secrets; they can be enumerated. Confidentiality relies on encryption and the password. Random selection is unbiased; Durable Object transactions reserve codes atomically. Collisions retry up to 32 times, then fail without overwriting active notes. Codes can be reused after expiry, so old links may later point to different notes. There is no sender authentication; exchange links through a trusted channel.

## Retention

The API rejects notes 24 hours after creation, independently of alarm timing. An alarm deletes the encrypted envelope and expiry timestamp. Old alarm retries check expiry so they cannot delete a newly allocated note. Provider delays may postpone physical deletion; this is not byte-level erasure at an exact deadline. Cloudflare-managed recovery/backups and request metadata may outlast application deletion. The app does not log content, passwords or request bodies. Review provider retention terms for data requiring strict physical erasure.

Open receive pages clear decrypted text and downloaded bytes at expiry (subject to browser timer throttling), and on page exit. Expiry cannot revoke screenshots or copies retained by recipients. Drafts and unsaved passwords remain only in the current page. Explicitly remembered passwords persist until cleared. localStorage is not a secure vault: use a trusted profile. Storage deletion failures are reported; clear browser site data if needed.

## Trust and availability

The device, browser and deployed JavaScript must be trusted. Compromised hosting or injected scripts can capture secrets. CSP, no-store, no-referrer, text-only output and local QR libraries reduce exposure without removing that trust requirement.

No IP/CIDR restrictions, accounts or application rate limits are included. Public uploads and enumeration can consume quotas. Configure operator-level abuse controls if needed. The app has not been independently audited.

Before publication, enable GitHub private vulnerability reporting or provide a private security contact. Do not post real passwords or messages in public issues.
