# Security

Tresor is designed as a **zero-knowledge** password vault. The server stores only encrypted data and cannot decrypt your secrets without your master password.

## Cryptographic design

### Key hierarchy

```
Master Password
    └── Argon2id (salt + params)
            ├── Auth Key      → login proof
            └── Encryption Key → wraps Vault Key
                    └── Vault Key → encrypts all secrets
```

### Algorithms

| Purpose | Algorithm |
|---------|-----------|
| Key derivation | Argon2id (64 KiB memory, 3 iterations, parallelism 4) |
| Symmetric encryption | AES-256-GCM |
| Authentication | Auth key proof (derived secret, constant-time compare) |

### What never leaves the client

- Master password (plaintext)
- Encryption key
- Vault key (except wrapped form stored on server)
- Decrypted secrets

### What the server stores

- Email (identifier)
- KDF salt and parameters
- Encrypted vault key (ciphertext + nonce)
- Auth key hash (derived from master password — not reversible to master password)
- Encrypted project names, category names, secret titles and payloads
- Optional secret **aliases** (plaintext paths like `prod/stripe`) for CLI lookup — values stay encrypted; only the path is visible to the server

## Threat mitigations

| Threat | Mitigation |
|--------|------------|
| Server/database breach | All sensitive data encrypted; useless without master password |
| Network interception | TLS in production; no plaintext secrets over wire |
| Weak master password | Minimum 12 characters enforced; Argon2id stretching |
| Brute-force login | Rate limiting (planned); expensive KDF per attempt |

## Reporting vulnerabilities

Please report security issues responsibly via GitHub Security Advisories or email the maintainers. Do not disclose publicly before a fix is available.

## Roadmap

- [ ] SRP-based authentication (replace auth key proof)
- [ ] Rate limiting on auth endpoints
- [ ] External security audit
- [ ] Recovery codes
- [ ] Master password change flow
