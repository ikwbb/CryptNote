# CryptNote

CryptNote lets you send a private message through a short link. Share a password with your recipient, write your message, and send them the link. They use the same password to read it. Your message is encrypted before it leaves your device and expires after 24 hours.

## Use

1. On either **Send a note** or **Receive a note**, choose **Password** or **QR code**. Enter a shared password and select **Use password**, or generate a QR to share privately. The other person can scan it or upload its image from QR mode.
2. After generating a QR, select **Use this password**. Setup collapses to **Password ready**. Use **Change / share** to edit it or show its QR again; re-sharing keeps the same password.
3. Sender: write the message and select **Encrypt & create link**. Share the short link, such as `https://cryptnote.pages.dev/3Ds`, with the recipient. The link never contains the password.
4. Recipient: after setting the password, enter the note link or code and select **Decrypt note**. Password entry stays hidden while reading. A wrong password reopens entry, and retries reuse the downloaded encrypted bytes.

Passwords stay in page memory by default. Opting in saves only the password in localStorage on this browser/origin. Unchecking removes the saved copy immediately. **Clear password** removes the saved and in-page password, erases the QR, and clears decrypted text. Explicitly saved passwords persist until cleared: this is the user-selected exception to message expiry. No messages or drafts are saved to browser storage.

## Structure

- `public/`: no-build frontend and Pages request handler.
- `public/crypto.js`: Web Crypto encryption, without cryptography dependencies.
- `public/vendor/`: two pinned, locally served QR libraries and their licenses. No runtime CDN requests.
- `worker/messages.js`: one Durable Object per short code, atomic allocation and expiry alarm.
- `test.mjs`: dependency-free encryption, API, storage and browser-flow tests.

Durable Objects reserve short codes atomically, so concurrent sends cannot overwrite an active note. The storage class runs in a separate Worker and is accessed through a Cloudflare Pages binding. The frontend uses vanilla HTML, CSS and JavaScript with no build step.

## Deploy

Requires Node.js 22+ / npm and a Cloudflare account supporting SQLite Durable Objects.

```sh
npx wrangler@4 login
npx wrangler@4 deploy --config worker/wrangler.jsonc
npx wrangler@4 pages project create cryptnote --production-branch main
npx wrangler@4 pages deploy public --project-name cryptnote --branch main
```

The commands deploy storage first, then create and deploy the Pages project. Verify the Pages `MESSAGES` binding points to class `Message` in `cryptnote-messages`. Choose **Fail closed** for Functions quota exhaustion; keep analytics and script injection disabled. If the Pages name is taken, change the root config name and commands; links use the actual origin. No credentials or account-specific IDs are committed.

Use Wrangler upload, not dashboard drag-and-drop. GitHub can store the project without a build step; the storage Worker must still be deployed first. Use a separate storage Worker for preview isolation.

## Local checks

```sh
node test.mjs
```

For Cloudflare runtime development, run these in two terminals from the repository root:

```sh
npx wrangler@4 dev --config worker/wrangler.jsonc
```

```sh
npx wrangler@4 pages dev public
```

Wrangler connects Pages to the local storage Worker. Open its localhost URL. Production requires HTTPS.

### Browser smoke checks

- Two browsers: generate a QR, scan/upload it, send Unicode and multiline text, and decrypt the resulting link.
- Try a wrong password, then the correct one without another download.
- Verify remember-on/reload, remember-off/reload, clear password, and blocked localStorage.
- Deny camera access and use image upload or manual password entry.
- Check mobile layout, copy fallback, expired/missing codes and deployed alarms.
- Inspect requests: uploads contain only salt, IV and ciphertext; no password, plaintext or third-party requests.

Tests use serialized in-memory storage and a small DOM stub; they do not emulate Cloudflare alarms, quotas, backups or physical cameras. Finish with deployment smoke checks.

See [SECURITY.md](SECURITY.md) for the threat model and retention limits.

References: [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/#durable-objects), [storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [alarms](https://developers.cloudflare.com/durable-objects/api/alarms/).
