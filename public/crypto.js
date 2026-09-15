const encoder = new TextEncoder();

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function encrypt(text, password) {
  const plain = encoder.encode(text);
  if (!plain.length || plain.length > 65536) throw new Error('Enter a message between 1 byte and 64 KiB.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  // Fixed format: 16-byte salt, 12-byte IV, ciphertext including 16-byte tag.
  const envelope = new Uint8Array(28 + ciphertext.length);
  envelope.set(salt);
  envelope.set(iv, 16);
  envelope.set(ciphertext, 28);
  return envelope;
}

export async function decrypt(envelope, password) {
  if (envelope.length < 45 || envelope.length > 65580) throw new Error('Invalid encrypted message.');
  const key = await deriveKey(password, envelope.slice(0, 16));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: envelope.slice(16, 28) }, key, envelope.slice(28)
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch {
    throw new Error('Incorrect password or damaged message.');
  }
}

