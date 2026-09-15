# CryptNote

**Private notes. Short links. Client-side encryption.**

CryptNote lets you send an encrypted message through a short link such as:

```text
https://cryptnote.pages.dev/3Ds
```

The message is encrypted in your browser before it is uploaded. The password is never included in the link, and the recipient uses the same password to decrypt the note locally.

Notes expire after **24 hours**.

**Live:** https://cryptnote.pages.dev

## Why CryptNote?

CryptNote is intentionally small.

* **Client-side encryption** using the browser Web Crypto API
* **3-character note links**
* **24-hour automatic expiry**
* **No accounts**
* **No build step**
* **No cryptography dependencies**
* **No runtime CDN requests**
* **Vanilla HTML, CSS and JavaScript**
* **Cloudflare Pages + Durable Objects**

The server stores only the encrypted payload that is required to deliver a note. The password and plaintext are not sent with the message.

For the security model, limitations and retention details, see [SECURITY.md](SECURITY.md).

## How it works

```text
Sender
  │
  │  password + message
  ▼
Browser
  │
  │  encrypt locally
  ▼
salt + IV + ciphertext
  │
  ▼
Cloudflare Durable Object
  │
  │  short code: 3Ds
  ▼
https://cryptnote.pages.dev/3Ds
  │
  │  share link
  ▼
Recipient
  │
  │  same password
  ▼
decrypt locally in browser
```

The short link identifies the encrypted note. It does **not** contain the password.

## Use

### 1. Share a password

On either **Send a note** or **Receive a note**, choose **Password** or **QR code**.

You can:

* enter a shared password and select **Use password**, or
* generate a QR code which the other person can scan or upload.

After a QR password is generated, select **Use this password**. The setup area collapses to **Password ready**.

Select **Change / share** if you want to edit the password or display its QR code again. Re-sharing the QR keeps the same password.

### 2. Send a note

Open **Send a note**, enter your message, and select:

**Encrypt & create link**

CryptNote encrypts the message locally and returns a short link such as:

```text
https://cryptnote.pages.dev/3Ds
```

Send that link to the recipient.

The link never contains the password.

### 3. Receive a note

Open the shared link, or open **Receive a note** and enter its link or short code.

Set the same password and select:

**Decrypt note**

The encrypted note is downloaded and decrypted locally.

If the password is incorrect, CryptNote reopens password entry. Another password attempt reuses the encrypted bytes which were already downloaded, so the note does not need to be fetched again.

## Password storage

Passwords stay in page memory by default.

You can optionally choose to remember a password on the current browser and origin. In that case, CryptNote stores **only the password** in `localStorage`.

No messages or drafts are saved to browser storage.

* Turning **Remember password** off removes the stored copy immediately.
* **Clear password** removes both the stored and in-page password.
* **Clear password** also erases the generated QR code and decrypted text.
* A password which you explicitly choose to save remains stored until you clear it.

Saved passwords are therefore a user-selected exception to the normal 24-hour message lifecycle.

## Architecture

```text
cryptnote/
├── public/
│   ├── crypto.js
│   ├── vendor/
│   └── _worker.js
├── worker/
│   └── messages.js
├── test.mjs
└── SECURITY.md
```

### `public/`

The no-build frontend and Cloudflare Pages request handler.

The frontend uses vanilla HTML, CSS and JavaScript.

### `public/crypto.js`

Contains the browser-side Web Crypto encryption logic.

CryptNote uses the native Web Crypto API and has no cryptography package dependency.

### `public/vendor/`

Contains two pinned QR libraries and their licenses.

They are served locally, which means that CryptNote does not require runtime CDN requests.

### `worker/messages.js`

Implements encrypted-note storage with Cloudflare Durable Objects.

Each active short code maps to its own Durable Object. Codes are reserved atomically, which prevents concurrent sends from overwriting an active note.

Expiry is handled through Durable Object alarms.

The storage class runs in a separate Worker which the Pages application accesses through a Cloudflare binding.

### `test.mjs`

Contains dependency-free tests for:

* encryption and decryption
* ciphertext tampering
* API behavior
* short-code allocation
* concurrent sends
* browser storage behavior
* QR flows
* browser UI flows

## Deployment

### Requirements

* Node.js 22+
* npm
* a Cloudflare account which supports SQLite-backed Durable Objects

### 1. Authenticate

```sh
npx wrangler@4 login
```

### 2. Deploy the storage Worker

```sh
npx wrangler@4 deploy --config worker/wrangler.jsonc
```

### 3. Create the Pages project

```sh
npx wrangler@4 pages project create cryptnote --production-branch main
```

### 4. Deploy the frontend

```sh
npx wrangler@4 pages deploy public --project-name cryptnote --branch main
```

These commands deploy the storage layer first and then create and deploy the Pages application.

After deployment, verify that the Pages `MESSAGES` binding points to:

```text
Worker: cryptnote-messages
Class:  Message
```

For Functions quota exhaustion, choose **Fail closed**.

Keep analytics and script injection disabled.

If the Pages project name `cryptnote` is unavailable, change the project name in the root configuration and deployment commands. Generated links automatically use the actual application origin.

No credentials or account-specific IDs are committed to the repository.

Use Wrangler deployment rather than dashboard drag-and-drop. GitHub can host the source without a build step, but the storage Worker still needs to be deployed before the Pages application.

Use a separate storage Worker if you need isolated preview storage.

## Security

CryptNote is designed so that note contents are encrypted before they leave the sender's browser.

However, client-side encryption does not remove every security risk. Weak passwords, compromised client code, browser storage, hosting infrastructure and provider-level retention can all affect the security model.

Read [SECURITY.md](SECURITY.md) before relying on CryptNote for sensitive information.

## Cloudflare documentation

* [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/#durable-objects)
* [Durable Object SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
* [Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
