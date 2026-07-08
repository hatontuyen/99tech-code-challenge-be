/**
 * End-to-end smoke test: boots the real HTTP stack against an in-memory
 * SQLite database and exercises every endpoint, including the error paths.
 *
 *   npm run smoke
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { createDb } from '../src/db';

async function main() {
  const db = createDb(':memory:');
  const server = createApp(db).listen(0);
  const { port } = server.address() as AddressInfo;
  const base = `http://localhost:${port}`;

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
  };

  // Health + docs
  assert.equal((await call('GET', '/healthz')).status, 200);
  const spec = await call('GET', '/openapi.json');
  assert.equal(spec.status, 200);
  assert.ok(spec.json.paths['/api/v1/tokens'], 'OpenAPI spec documents the tokens resource');

  // Create
  const created = await call('POST', '/api/v1/tokens', {
    symbol: 'SWTH',
    name: 'Switcheo Token',
    chain: 'Neo',
    decimals: 8,
  });
  assert.equal(created.status, 201);
  assert.ok(created.headers.get('location')?.includes(created.json.data.id));
  const id = created.json.data.id as string;

  await call('POST', '/api/v1/tokens', { symbol: 'ETH', name: 'Ether', chain: 'Ethereum' });
  await call('POST', '/api/v1/tokens', {
    symbol: 'ZIL',
    name: 'Zilliqa',
    chain: 'Zilliqa',
    isActive: false,
  });

  // Duplicate symbol -> 409 (case-insensitive)
  assert.equal(
    (await call('POST', '/api/v1/tokens', { symbol: 'swth', name: 'dup', chain: 'Neo' })).status,
    409,
  );

  // Validation -> 400 with field details
  const bad = await call('POST', '/api/v1/tokens', { symbol: 'B AD', name: '', chain: 'Mars' });
  assert.equal(bad.status, 400);
  assert.ok(Array.isArray(bad.json.error.details) && bad.json.error.details.length >= 3);

  // Unknown key rejected (strict schema)
  assert.equal(
    (
      await call('POST', '/api/v1/tokens', {
        symbol: 'OK',
        name: 'ok',
        chain: 'Neo',
        hacker: true,
      })
    ).status,
    400,
  );

  // Malformed JSON -> 400, not a crash
  const rawRes = await fetch(`${base}/api/v1/tokens`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{oops',
  });
  assert.equal(rawRes.status, 400);

  // List + filters
  const all = await call('GET', '/api/v1/tokens');
  assert.equal(all.json.pagination.total, 3);
  const neo = await call('GET', '/api/v1/tokens?chain=Neo');
  assert.equal(neo.json.pagination.total, 1);
  const inactive = await call('GET', '/api/v1/tokens?isActive=false');
  assert.equal(inactive.json.data[0].symbol, 'ZIL');
  const search = await call('GET', '/api/v1/tokens?search=switch');
  assert.equal(search.json.data[0].symbol, 'SWTH');
  // LIKE wildcard escaping: searching "50%" means the literal string (README claim).
  await call('POST', '/api/v1/tokens', { symbol: 'PCT', name: 'Token 50% Bonus', chain: 'Neo' });
  const literal = await call('GET', `/api/v1/tokens?search=${encodeURIComponent('50%')}`);
  assert.equal(literal.json.data.length, 1, 'search "50%" finds the literal match');
  // If % were still a wildcard, "5X%" would match "5X<anything>" — must be empty.
  const wildcard = await call('GET', `/api/v1/tokens?search=${encodeURIComponent('5X%')}`);
  assert.equal(wildcard.json.data.length, 0, 'escaped % must not act as a wildcard');
  await call('DELETE', `/api/v1/tokens/${literal.json.data[0].id}`);
  const sorted = await call('GET', '/api/v1/tokens?sort=symbol&order=asc&limit=2&page=1');
  assert.deepEqual(
    sorted.json.data.map((t: { symbol: string }) => t.symbol),
    ['ETH', 'SWTH'],
  );
  assert.equal(sorted.json.pagination.totalPages, 2);
  // Bad query param -> 400, not a silent default
  assert.equal((await call('GET', '/api/v1/tokens?sort=drop_table')).status, 400);

  // Get one / 404
  assert.equal((await call('GET', `/api/v1/tokens/${id}`)).json.data.symbol, 'SWTH');
  assert.equal((await call('GET', '/api/v1/tokens/nope')).status, 404);

  // Update
  const updated = await call('PATCH', `/api/v1/tokens/${id}`, { name: 'Switcheo', decimals: 18 });
  assert.equal(updated.json.data.name, 'Switcheo');
  assert.equal(updated.json.data.decimals, 18);
  assert.notEqual(updated.json.data.updatedAt, created.json.data.updatedAt);
  // Empty patch -> 400; renaming to an existing symbol -> 409
  assert.equal((await call('PATCH', `/api/v1/tokens/${id}`, {})).status, 400);
  assert.equal((await call('PATCH', `/api/v1/tokens/${id}`, { symbol: 'ETH' })).status, 409);

  // Delete
  assert.equal((await call('DELETE', `/api/v1/tokens/${id}`)).status, 204);
  assert.equal((await call('GET', `/api/v1/tokens/${id}`)).status, 404);
  assert.equal((await call('DELETE', `/api/v1/tokens/${id}`)).status, 404);

  server.close();
  db.close();
  console.log('\nSMOKE PASS — every endpoint incl. 400/404/409 error paths verified');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
