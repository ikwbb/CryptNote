import { ReadableStream } from 'node:stream/web';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { encrypt, decrypt } from './public/crypto.js';
import worker from './public/_worker.js';
import { Message } from './worker/messages.js';

// Serialize transactions like Durable Object storage; test concurrency through the real handlers.
class Storage {
  data = new Map(); alarm = null; queue = Promise.resolve();
  transaction(fn) { const result = this.queue.then(() => fn(this)); this.queue = result.catch(() => {}); return result; }
  async get(key) { return this.data.get(key); }
  async put(key, value) { this.data.set(key, value); }
  async delete(key) { return this.data.delete(key); }
  async setAlarm(value) { this.alarm = value; }
  async deleteAlarm() { this.alarm = null; }
}
const objects = new Map();
const env = { MESSAGES: { idFromName: name => name, get(name) {
  if (!objects.has(name)) { const storage = new Storage(); objects.set(name, { storage, object: new Message({ storage }) }); }
  return { fetch: (url, init) => objects.get(name).object.fetch(new Request(url, init)) };
}}, ASSETS: { fetch: async () => new Response('page') } };
const origin = 'https://cryptnote.pages.dev';
const req = (path, init) => worker.fetch(new Request(origin + path, init), env);
const post = body => req('/api/messages', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/octet-stream' }, body });
const password = 'an independently shared long password';
const plaintext = 'Private 🔐 中文\n<script>alert(1)</script>';
const bytes = await encrypt(plaintext, password);
assert.equal(await decrypt(bytes, password), plaintext);
assert.notDeepEqual(bytes, await encrypt(plaintext, password));
await assert.rejects(decrypt(bytes, 'wrong'));
for (const index of [0, 16, 28, bytes.length - 1]) { const bad = bytes.slice(); bad[index] ^= 1; await assert.rejects(decrypt(bad, password)); }
await assert.rejects(encrypt('', password));
await assert.rejects(encrypt('🔐'.repeat(16385), password));
assert.equal((await encrypt('a'.repeat(65536), password)).length, 65580);
assert.ok(!Buffer.from(bytes).includes(Buffer.from(password)));
assert.ok(!Buffer.from(bytes).includes(Buffer.from(plaintext)));
const uploaded = await post(bytes); assert.equal(uploaded.status, 201);
const { code, expiresAt } = await uploaded.json(); assert.match(code, /^[A-Za-z0-9]{3}$/);
assert.ok(Math.abs(expiresAt - Date.now() - 86400000) < 2000);
for (const ip of ['', '1.2.3.4', '2001:db8::1']) {
 const response = await req('/api/messages/' + code, { headers: { 'CF-Connecting-IP': ip } });
 assert.equal(response.status, 200); assert.equal(await decrypt(new Uint8Array(await response.arrayBuffer()), password), plaintext);
 assert.equal(response.headers.get('Cache-Control'), 'no-store');
}
const simultaneous = await Promise.all(Array.from({ length: 20 }, () => post(bytes)));
const codes = await Promise.all(simultaneous.map(async response => { assert.equal(response.status, 201); return (await response.json()).code; }));
assert.equal(new Set(codes).size, 20);
const direct = env.MESSAGES.get('Ab9');
const raced = await Promise.all([direct.fetch('https://message/', {method:'POST', body:bytes}), direct.fetch('https://message/', {method:'POST', body:bytes})]);
assert.deepEqual(raced.map(r=>r.status).sort(), [201,409]);
const stored = objects.get(code); stored.storage.data.get('note').expiresAt = Date.now() - 1;
assert.equal((await req('/api/messages/' + code)).status, 404);
await stored.object.alarm(); assert.equal(stored.storage.data.size, 0); assert.equal(stored.storage.alarm, null);
const stale = objects.get('Ab9'); await stale.object.alarm(); assert.ok(stale.storage.data.has('note')); // An old alarm cannot erase a replacement.
assert.equal((await post(new Uint8Array(44))).status, 400);
assert.equal((await post(new Uint8Array(65581))).status, 413);
const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(40000)); c.enqueue(new Uint8Array(40000)); c.close(); } });
assert.equal((await req('/api/messages', { method:'POST', duplex:'half', body:stream, headers:{ Origin:origin,'Content-Type':'application/octet-stream' } })).status, 413);
assert.equal((await req('/api/messages',{method:'POST',body:bytes,headers:{Origin:'https://other.example','Content-Type':'application/octet-stream'}})).status,403);
assert.equal((await req('/api/messages',{method:'POST',body:bytes,headers:{Origin:origin,'Content-Type':'text/plain'}})).status,415);
assert.equal((await req('/api/messages/' + codes[0], {method:'DELETE'})).status,405);
assert.equal((await req('/_worker.js')).status,404);
assert.equal((await req('/api/messages/toolong')).status,404);
assert.equal((await req('/' + codes[0])).status,200);
assert.equal((await worker.fetch(new Request('http://example.com/'),env)).status,400);


const alarmOnly = objects.get(codes[1]); alarmOnly.storage.data.get('note').expiresAt = Date.now() - 1;
await alarmOnly.object.alarm(); assert.equal(alarmOnly.storage.data.size, 0); assert.equal(alarmOnly.storage.alarm, null);
const pageSource = await readFile(new URL('./public/_worker.js', import.meta.url), 'utf8');
const collisionContext = vm.createContext({crypto:{getRandomValues(array){array.fill(0);return array;}},Request,Response,URL,Uint8Array,Date});
vm.runInContext(pageSource.replace('export function randomCode', 'function randomCode').replace('export default {', 'globalThis.worker = {'),collisionContext);
await env.MESSAGES.get('AAA').fetch('https://message/',{method:'POST',body:bytes});
const exhausted = await collisionContext.worker.fetch(new Request(origin+'/api/messages',{method:'POST',headers:{Origin:origin,'Content-Type':'application/octet-stream'},body:bytes}),env);
assert.equal(exhausted.status,503);
assert.equal(await decrypt(new Uint8Array(objects.get('AAA').storage.data.get('note').bytes),password),plaintext);

const source = (await readFile(new URL('./public/app.js', import.meta.url),'utf8')).replace(/^import .*;$/gm, '');
function browser(pathname, saved = new Map(), storageFails = false) {
 const nodes = new Map(), requests = [];
 const node = id => {
  if (!nodes.has(id)) nodes.set(id, {value:'',textContent:'',type:'password',hidden:true,checked:false,disabled:false,dataset:{},events:{},setAttribute(k,v){this[k]=v;},addEventListener(k,fn){this.events[k]=fn;},getContext(){return {clearRect(){},fillRect(){}};},focus(){},select(){}});
  return nodes.get(id);
 };
 const storage = {getItem:k=>saved.get(k),setItem(k,v){if(storageFails)throw Error();saved.set(k,v)},removeItem(k){if(storageFails)throw Error();saved.delete(k)}};
 const context = vm.createContext({document:{getElementById:node,querySelectorAll:()=>[...nodes.values()],addEventListener(){}},window:{addEventListener(){}},location:{pathname,origin},localStorage:storage,crypto:webcrypto,isSecureContext:true,TextEncoder,TextDecoder,Uint8Array,URL,Date,setInterval(){},encrypt,decrypt,QrScanner:{},fetch:async(path,init)=>{ requests.push({path,init}); return req(path, init?.method === 'POST' ? {...init,headers:{...init.headers,Origin:origin}} : init); }});
 vm.runInContext(source,context);
 return {node,saved,requests,context};
}
const sender = browser('/');
assert.equal(sender.node('remember').checked,false);
sender.node('password').value=password;sender.node('message').value=plaintext;
await sender.node('submit').events.click();assert.equal(sender.node('sent').hidden,false);assert.equal(sender.saved.size,0);
assert.equal(sender.requests.length,1);assert.equal(await decrypt(sender.requests[0].init.body,password),plaintext);
assert.match(sender.node('share-url').value,/https:\/\/cryptnote.pages.dev\/[A-Za-z0-9]{3}$/);
sender.node('remember').checked=true;sender.node('remember').events.change();assert.equal(sender.saved.get('cryptnote.password'),password);
sender.node('remember').checked=false;sender.node('remember').events.change();assert.equal(sender.saved.size,0);
const receiver = browser('/receive');receiver.node('note-code').value=sender.node('share-url').value;receiver.node('password').value='wrong';
await receiver.node('submit').events.click();assert.equal(receiver.node('opened').hidden,true);
receiver.node('password').value=password;await receiver.node('submit').events.click();
assert.equal(receiver.requests.length,1);assert.equal(receiver.node('plaintext').textContent,plaintext);
receiver.node('remember').checked=true;receiver.node('remember').events.change();receiver.node('clear-password').events.click();
assert.equal(receiver.saved.size,0);assert.equal(receiver.node('password').value,'');assert.equal(receiver.node('plaintext').textContent,'');
vm.runInContext("importQR('cryptnote:v1:' + 'ab'.repeat(32))",sender.context);assert.equal(sender.node('password').value,'ab'.repeat(32));
assert.throws(()=>vm.runInContext("importQR('https://evil.example/password')",sender.context));
const denied = browser('/',new Map(),true);denied.node('password').value=password;denied.node('message').value=plaintext;await denied.node('submit').events.click();assert.equal(denied.node('sent').hidden,false);
console.log('PASS: crypto, tampering, payload limits, concurrent allocation, expiry, routes, encrypted transmission, offline retries, QR import, and optional password persistence.');
