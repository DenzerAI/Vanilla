import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { publicAddress, safeRequest } from '../safe-request.mjs';
import { inside } from '../storage.mjs';

test('SSRF rejects private IPv4, IPv6, metadata, mapped and non-http URLs', async () => {
  for (const address of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2002:7f00:1::']) assert.equal(publicAddress(address), false, address);
  for (const url of ['http://127.1','http://2130706433','http://[::1]','file:///etc/passwd','http://169.254.169.254','http://example.invalid:8080']) await assert.rejects(safeRequest(url));
  await assert.rejects(safeRequest('http://example.invalid', { resolve: async () => [{address:'127.0.0.1',family:4}] }));
});
test('network pinning resolves once and response size is bounded', async t => {
  const server = http.createServer((req,res) => res.end('synthetic-response'));
  await new Promise(r => server.listen(0, '127.0.0.1', r)); t.after(() => server.close());
  const url = `http://synthetic.invalid:${server.address().port}/`;
  let calls = 0;
  const options = {internalUrls:[url],resolve:async()=>{ calls++; return [{address:'127.0.0.1',family:4}]; }};
  assert.equal((await safeRequest(url, options)).status, 200); assert.equal(calls,1);
  await assert.rejects(safeRequest(url, {...options, method:'GET', maxBytes:4}));
});
test('absolute workspace paths and hidden paths are rejected', async () => {
  await assert.rejects(inside(process.cwd(), process.cwd()));
  await assert.rejects(inside(process.cwd(), '.env'));
});

test('public IPv6 allocations remain reachable while special-purpose ranges stay denied', async () => {
  for (const address of ['2001:67c:4e8:f004::9','2001:4860:4860::8888','2606:4700:4700::1111'])
    assert.equal(publicAddress(address), true, address);
  for (const address of ['2001::1','2001:0000::1','2001:2::1','2001:10::1','2001:1ff::1','2001:db8::1','2001:0db8::1','2002::1','3fff::1','3fff:fff::1'])
    assert.equal(publicAddress(address), false, address);
  await assert.rejects(safeRequest('https://synthetic.invalid', {resolve:async()=>[
    {address:'2001:67c:4e8:f004::9',family:6}, {address:'::1',family:6},
  ]}), /Interne oder private URL/);
});
