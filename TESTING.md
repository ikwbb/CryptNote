## Browser smoke checks

Before a release, check the complete flow in real browsers.

* Generate a QR in one browser and scan or upload it in another.
* Send Unicode and multiline text and decrypt the resulting link.
* Enter an incorrect password and then the correct password without downloading the note again.
* Test remember-on followed by reload.
* Test remember-off followed by reload.
* Test **Clear password**.
* Test behavior when `localStorage` is unavailable.
* Deny camera permission and use image upload or manual password entry instead.
* Check the mobile layout.
* Check copy fallback behavior.
* Check missing and expired short codes.
* Verify deployed expiry alarms.
* Inspect network requests and confirm that uploads contain only the salt, IV and ciphertext.
* Confirm that the password and plaintext are not uploaded.
* Confirm that the normal application flow makes no third-party runtime requests.

The automated tests use serialized in-memory storage and a small DOM stub. They do not emulate Cloudflare quotas, backups, physical cameras or the complete Durable Object alarm environment.

Production changes should therefore finish with deployment smoke checks.

## Local development

Run the test suite:

```sh
node test.mjs
```

For local Cloudflare runtime development, open two terminals from the repository root.

### Terminal 1 — storage Worker

```sh
npx wrangler@4 dev --config worker/wrangler.jsonc
```

### Terminal 2 — Pages application

```sh
npx wrangler@4 pages dev public
```

Wrangler connects the Pages application to the local storage Worker.

Open the localhost URL which Wrangler provides.

Production deployment requires HTTPS.