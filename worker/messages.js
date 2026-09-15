// One object per short code. Transactions prevent concurrent uploads overwriting notes.
export class Message {
  constructor(ctx) { this.storage = ctx.storage; }
  async fetch(request) {
    if (request.method === 'POST') {
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength < 45 || bytes.byteLength > 65580) return new Response('Invalid encrypted data', { status: 400 });
      const expiresAt = Date.now() + 86400000;
      const created = await this.storage.transaction(async txn => {
        const current = await txn.get('note');
        if (current && current.expiresAt > Date.now()) return false;
        await txn.put('note', { bytes, expiresAt });
        await txn.setAlarm(expiresAt);
        return true;
      });
      return Response.json({ expiresAt }, { status: created ? 201 : 409 });
    }
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    const note = await this.storage.transaction(async txn => {
      const value = await txn.get('note');
      if (!value || value.expiresAt <= Date.now()) {
        await txn.delete('note');
        return null;
      }
      return value;
    });
    if (!note) return new Response('Note not found or expired.', { status: 404 });
    return new Response(note.bytes, { headers: { 'Content-Type': 'application/octet-stream', 'X-Expires-At': String(note.expiresAt) } });
  }
  async alarm() {
    // A retry of an old alarm must not erase a newly allocated note.
    await this.storage.transaction(async txn => {
      const note = await txn.get('note');
      if (note && note.expiresAt > Date.now()) await txn.setAlarm(note.expiresAt);
      else { await txn.delete('note'); await txn.deleteAlarm(); }
    });
  }
}
// No public backend endpoint; only the Pages binding can access objects.
export default { fetch() { return new Response('Not found', { status: 404 }); } };
