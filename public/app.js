import { encrypt, decrypt } from './crypto.js';
import QrScanner from './vendor/qr-scanner.min.js';
const $ = id => document.getElementById(id);
const storageKey = 'cryptnote.password';
const receive = !['/', '/index.html'].includes(location.pathname);
let downloaded, downloadedCode, expiresAt = 0, scanner, busy = false, passwordReady = false, mode = 'password';
const secure = !!globalThis.isSecureContext && !!globalThis.crypto?.subtle;
function render() {
  $('password-setup').hidden = passwordReady;
  $('password-summary').hidden = !passwordReady;
  $('password-entry').hidden = mode !== 'password';
  $('qr-tools').hidden = mode !== 'qr';
  $('password-mode').setAttribute('aria-pressed', String(mode === 'password'));
  $('qr-mode').setAttribute('aria-pressed', String(mode === 'qr'));
  $('clear-password').hidden = !$('password').value;
  $('save-hint').hidden = passwordReady;
  $('qr-actions').hidden = !$('qr-panel').hidden;
  $('generate').textContent = $('password').value ? 'Show password QR' : 'Generate password + QR';
  $('send-hint').textContent = !passwordReady ? 'Set up a shared password, then write your message.' : $('sent').hidden ? 'Write a message for the person who has your password.' : 'Share the link with the person who has your password.';
  $('receive-hint').textContent = !passwordReady ? 'Use your shared password, or create one to share with the sender.' : $('opened').hidden ? 'Enter the note link or code from your sender.' : 'Your message was decrypted on this device.';
  $('message-fields').hidden = !passwordReady || !$('sent').hidden;
  $('code-fields').hidden = !passwordReady || !$('opened').hidden;
  $('submit').hidden = !passwordReady || !(receive ? $('opened').hidden : $('sent').hidden);
  $('submit').disabled = busy || !secure;
}
function setMode(next) { mode = next; stopScan(); hideQR(); render(); }
function acceptPassword() {
  if (!secure) { status('Open CryptNote over HTTPS to use encryption.', true); return; }
  if (!$('password').value || (!receive && $('password').value.length < 16)) { status(receive ? 'Enter your shared password.' : 'Use at least 16 characters, or generate a QR password.', true); return; }
  passwordReady = true; hideQR(); $('password').type = 'password'; $('show-password').textContent = 'Show'; $('show-password').setAttribute('aria-pressed', 'false');
  status(); savePassword(); render();
  $(receive ? 'note-code' : 'message').focus();
}
function editPassword() { passwordReady = false; clearPlaintext(); render(); if (mode === 'password') $('password').focus(); }
function status(text = '', error = false) { $('status').textContent = text; $('status').dataset.error = error; }
function hideQR() { $('qr-panel').hidden = true; $('use-qr').hidden = true; const canvas = $('qr'); canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
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
  $('remember').checked = false; passwordReady = false; mode = 'password'; hideQR(); clearPlaintext(); render();
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
  let password;
  if (/^cryptnote:v1:[a-f0-9]{64}$/.test(value)) password = value.slice(13);
  else if (value.startsWith('cryptnote:v2:') && value.length <= 12300) {
    try { password = decodeURIComponent(value.slice(13)); } catch { /* Invalid QR encoding. */ }
  }
  if (!password || password.length > 1024) throw Error('This is not a CryptNote password QR.');
  $('password').value = password; clearPlaintext(); acceptPassword();
}
function stopScan() { if (scanner) { scanner.destroy(); scanner = undefined; } if ($('scan-dialog').open) $('scan-dialog').close(); }
$('send-panel').hidden = receive; $('receive-panel').hidden = !receive;
$(receive ? 'receive-tab' : 'send-tab').setAttribute('aria-current', 'page');
$('generate').hidden = false; $('scan').hidden = false; $('upload-label').hidden = false;
$('submit').textContent = receive ? 'Decrypt note ↙' : 'Encrypt & create link ↗';
if (/^\/[A-Za-z0-9]{3}$/.test(location.pathname)) $('note-code').value = location.pathname.slice(1);
try {
  // Remove the previous version's implicit password persistence.
  localStorage.removeItem('cryptdrop.password'); localStorage.removeItem('cryptdrop.senderPassword');
  const saved = localStorage.getItem(storageKey);
  if (saved) { $('password').value = saved; $('remember').checked = true; passwordReady = receive || saved.length >= 16; }
} catch { /* Storage is optional. */ }
$('password-mode').addEventListener('click', () => setMode('password'));
$('qr-mode').addEventListener('click', () => setMode('qr'));
$('password-form').addEventListener('submit', event => { event.preventDefault(); acceptPassword(); });
$('use-qr').addEventListener('click', acceptPassword);
$('qr-back').addEventListener('click', () => { hideQR(); render(); });
$('edit-password').addEventListener('click', editPassword);
$('new-note').addEventListener('click', () => { $('sent').hidden = true; status(); render(); $('message').focus(); });
$('show-password').addEventListener('click', () => {
  const show = $('password').type === 'password'; $('password').type = show ? 'text' : 'password';
  $('show-password').textContent = show ? 'Hide' : 'Show'; $('show-password').setAttribute('aria-pressed', String(show));
});
$('remember').addEventListener('change', () => { if (savePassword()) status($('remember').checked ? 'Password will be remembered on this device.' : 'Password removed from browser storage. It stays in this page.'); });
$('password').addEventListener('input', () => { passwordReady = false; hideQR(); clearPlaintext(); savePassword(); render(); });
$('clear-password').addEventListener('click', clearPassword);
$('clear-note').addEventListener('click', () => { clearPlaintext(); render(); });
$('note-code').addEventListener('input', () => { downloaded = undefined; downloadedCode = undefined; clearPlaintext(); });
$('message').addEventListener('input', () => { $('byte-count').textContent = new TextEncoder().encode($('message').value).length.toLocaleString('en-US') + ' / 65,536 bytes'; });
$('generate').addEventListener('click', () => {
  try {
    const password = $('password').value || Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    $('password').value = password; clearPlaintext();
    const qr = window.qrcode(0, 'M'); qr.addData(/^[a-f0-9]{64}$/.test(password) ? 'cryptnote:v1:' + password : 'cryptnote:v2:' + encodeURIComponent(password)); qr.make();
    const count = qr.getModuleCount(), scale = 6, border = 4, canvas = $('qr');
    canvas.width = canvas.height = (count + border * 2) * scale;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
    for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y, x)) ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
    $('qr-panel').hidden = false; $('use-qr').hidden = false; render();
    if (savePassword()) status('Share this QR privately, then choose Use this password.');
  } catch { status('Could not create the QR. This password may be too long for a QR code; share it privately as text instead.', true); }
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
  if (busy || !passwordReady || !secure) return;
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
      let plain;
      try { plain = await decrypt(downloaded, password); }
      catch (error) { mode = 'password'; editPassword(); throw error; }
      if (expiresAt <= Date.now()) throw Error('This note has expired.');
      $('plaintext').textContent = plain; $('opened').hidden = false; $('received-expiry').textContent = expiryText(expiresAt);
      status();
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
      status();
    }
    savePassword();
  } catch (error) { status(error.message || 'Something went wrong. Please try again.', true); }
  finally { busy = false; controls.forEach(node => node.disabled = false); render(); }
});
setInterval(() => { if (expiresAt && expiresAt <= Date.now()) { downloaded = undefined; clearPlaintext(); render(); } }, 1000);
window.addEventListener('pagehide', () => { stopScan(); hideQR(); clearPlaintext(); downloaded = undefined; $('password').value = ''; $('message').value = ''; passwordReady = false; render(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopScan(); });
render();
if (!secure) { $('submit').disabled = true; $('generate').disabled = true; status('Open CryptNote over HTTPS to use encryption.', true); }
