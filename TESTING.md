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