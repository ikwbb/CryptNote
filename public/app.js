import { encrypt, decrypt } from './crypto.js';
import QrScanner from './vendor/qr-scanner.min.js';
const $ = id => document.getElementById(id);
const storageKey = 'cryptnote.password';
const receive = !['/', '/index.html'].includes(location.pathname);
let downloaded, downloadedCode, expiresAt = 0, scanner, busy = false;
function status(text = '', error = false) { $('status').textContent = text; $('status').dataset.error = error; }
function hideQR() { $('qr-panel').hidden = true; const canvas = $('qr'); canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
function clearPlaintext() { $('plaintext').textContent = ''; $('opened').hidden = true; }
function savePassword() {
  try {
    if ($('remember').checked && $('password').value) localStorage.setItem(storageKey, $('password').value);
    else localStorage.removeItem(storageKey);
    return true;
  } catch { status('Browser storage is unavailable. Your password is only in this page; any previously saved password may remain. Clear site data to remove it.', true); return false; }
}
function clearPassword() {
  $('password').value = ''; $('password').type = 'password'; $('show-password').textContent = 'Show'; $('show-password').setAttribute('aria-pressed', 'false');
  $('remember').checked = false; hideQR(); clearPlaintext();
  if (savePassword()) status('Password cleared from this page and browser storage.');
}
function codeFrom(value) {
  let code = value.trim();
  if (code.startsWith('https://') || code.startsWith('http://')) {
    const url = new URL(code);
    if (url.origin !== location.origin || url.search || url.hash) throw Error('Use a note link from this site.');
    code = url.pathname.slice(1);
  }
  if (!/^[A-Za-z0-9]{3}$/.test(code)) throw Error('Enter the three-character note code, keeping upper and lower case.');
  return code;
}
function importQR(value) {
  if (!/^cryptnote:v1:[a-f0-9]{64}$/.test(value)) throw Error('This is not a CryptNote password QR.');
  $('password').value = value.slice(13); hideQR();
  if (savePassword()) status('Password scanned. You’re ready to send.');
}
function stopScan() { if (scanner) { scanner.destroy(); scanner = undefined; } if ($('scan-dialog').open) $('scan-dialog').close(); }
$('send-panel').hidden = receive; $('receive-panel').hidden = !receive;
$(receive ? 'receive-tab' : 'send-tab').setAttribute('aria-current', 'page');
$('generate').hidden = !receive; $('scan').hidden = receive; $('upload-label').hidden = receive;
$('submit').textContent = receive ? 'Decrypt note ↙' : 'Encrypt & create link ↗';
if (/^\/[A-Za-z0-9]{3}$/.test(location.pathname)) $('note-code').value = location.pathname.slice(1);
try {
  // Remove the previous version's implicit password persistence.
  localStorage.removeItem('cryptdrop.password'); localStorage.removeItem('cryptdrop.senderPassword');
  const saved = localStorage.getItem(storageKey);
  if (saved) { $('password').value = saved; $('remember').checked = true; }
} catch { /* Storage is optional. */ }
$('show-password').addEventListener('click', () => {
  const show = $('password').type === 'password'; $('password').type = show ? 'text' : 'password';
  $('show-password').textContent = show ? 'Hide' : 'Show'; $('show-password').setAttribute('aria-pressed', String(show));
});
$('remember').addEventListener('change', () => { if (savePassword()) status($('remember').checked ? 'Password will be remembered on this device.' : 'Password removed from browser storage. It stays in this page.'); });
$('password').addEventListener('input', () => { hideQR(); clearPlaintext(); savePassword(); });
$('clear-password').addEventListener('click', clearPassword);
$('clear-note').addEventListener('click', clearPlaintext);
$('hide-qr').addEventListener('click', hideQR);
$('note-code').addEventListener('input', () => { downloaded = undefined; downloadedCode = undefined; clearPlaintext(); });
$('message').addEventListener('input', () => { $('byte-count').textContent = new TextEncoder().encode($('message').value).length.toLocaleString('en-US') + ' / 65,536 bytes'; });
$('generate').addEventListener('click', () => {
  try {
    const password = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    $('password').value = password; clearPlaintext();
    const qr = window.qrcode(0, 'M'); qr.addData('cryptnote:v1:' + password); qr.make();
    const count = qr.getModuleCount(), scale = 6, border = 4, canvas = $('qr');
    canvas.width = canvas.height = (count + border * 2) * scale;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
    for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y, x)) ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
    $('qr-panel').hidden = false;
    if (savePassword()) status('New 256-bit password generated. Share it privately and keep it until you decrypt the note.');
  } catch { status('Could not generate a password QR. Reload and try again.', true); }
});
$('scan').addEventListener('click', async () => {
  $('scan-dialog').showModal();
  scanner = new QrScanner($('video'), result => { try { importQR(result.data); stopScan(); } catch (error) { status(error.message, true); } }, { preferredCamera: 'environment', returnDetailedScanResult: true });
  try { await scanner.start(); } catch { stopScan(); status('Camera unavailable. Allow camera access, upload a QR image, or paste the password.', true); }
});
$('stop-scan').addEventListener('click', stopScan);
$('scan-dialog').addEventListener('cancel', stopScan);
$('qr-file').addEventListener('change', async () => {
  const file = $('qr-file').files[0]; if (!file) return;
  try { const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true }); importQR(result.data); }
  catch { status('Could not read a CryptNote password QR from that image.', true); }
  finally { $('qr-file').value = ''; }
});
$('copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('share-url').value); status('Link copied.'); }
  catch { $('share-url').focus(); $('share-url').select(); status('Select and copy the link manually.'); }
});
function expiryText(time) { return 'Expires ' + new Date(time).toLocaleString() + ' (24 hours after sending).'; }
$('submit').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  const controls = [...document.querySelectorAll('button, input, textarea')]; controls.forEach(node => node.disabled = true);
  try {
    const password = $('password').value;
    if (!password) throw Error('Enter the shared password first.');
    if (receive) {
      clearPlaintext(); const code = codeFrom($('note-code').value);
      status('Opening your encrypted note…');
      if (!downloaded || downloadedCode !== code) {
        const response = await fetch('/api/messages/' + code, { cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw Error(await response.text());
        downloaded = new Uint8Array(await response.arrayBuffer()); downloadedCode = code;
        expiresAt = Number(response.headers.get('X-Expires-At'));
      }
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) { downloaded = undefined; throw Error('This note has expired.'); }
      const plain = await decrypt(downloaded, password);
      if (expiresAt <= Date.now()) throw Error('This note has expired.');
      $('plaintext').textContent = plain; $('opened').hidden = false; $('received-expiry').textContent = expiryText(expiresAt);
      status('Decrypted on your device.');
    } else {
      $('sent').hidden = true;
      if (password.length < 16) throw Error('Use at least 16 characters, or scan a generated password QR.');
      status('Encrypting on your device…');
      const body = await encrypt($('message').value, password);
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body, cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw Error(await response.text());
      const result = await response.json();
      $('share-url').value = location.origin + '/' + result.code; $('sent-expiry').textContent = expiryText(result.expiresAt); $('sent').hidden = false;
      $('message').value = ''; $('byte-count').textContent = '0 / 65,536 bytes';
      status('Encrypted note sent. Your link is ready.');
    }
    savePassword();
  } catch (error) { status(error.message || 'Something went wrong. Please try again.', true); }
  finally { busy = false; controls.forEach(node => node.disabled = false); }
});
setInterval(() => { if (expiresAt && expiresAt <= Date.now()) { downloaded = undefined; clearPlaintext(); } }, 1000);
window.addEventListener('pagehide', () => { stopScan(); hideQR(); clearPlaintext(); downloaded = undefined; $('password').value = ''; $('message').value = ''; });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopScan(); });
if (!globalThis.isSecureContext || !globalThis.crypto?.subtle) { $('submit').disabled = true; $('generate').disabled = true; status('Open CryptNote over HTTPS to use encryption.', true); }
