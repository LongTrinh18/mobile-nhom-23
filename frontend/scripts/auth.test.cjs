const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.join(__dirname, '..');
const pendingKey = 'uniqlo.google-login.v1';
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' };
const other = '00000000-0000-4000-8000-000000000002';
const profile = { id: user.id, full_name: 'Google User', role: 'customer', branch_id: null };
const callback = 'uniqlomobile://auth/callback';
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module); cache.set(file, mod); mod.filename = file; mod.paths = module.paths;
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
      ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, file);
    return mod.exports;
  }
  return relative => load(path.join(root, relative));
}
function harness(options = {}) {
  const values = options.values ?? new Map();
  const storage = { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  const calls = { oauth: [], exchange: [], browser: [], signout: [] };
  const client = { auth: {
    signInWithOAuth: async args => { calls.oauth.push(args); return { data: { url: 'https://auth.example/authorize' }, error: options.oauthError ?? null }; },
    exchangeCodeForSession: async (...args) => { calls.exchange.push(args); return { data: { session: { user } }, error: options.exchangeError ?? null }; },
    getUser: async () => ({ data: { user }, error: null }),
    signOut: async args => { calls.signout.push(args); return { error: options.signoutError ?? null }; },
  }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: options.missingProfile ? null : profile, error: null }) }) }) }),
    rpc: async name => { assert.equal(name, 'ensure_my_profile'); return { data: profile, error: options.profileError ?? null }; },
  };
  const service = loader({ '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    'expo-constants': { __esModule: true, default: { appOwnership: options.expoGo ? 'expo' : null } },
    'expo-linking': { createURL: () => callback }, 'react-native': { Platform: { OS: 'android' } },
    'expo-web-browser': { openAuthSessionAsync: async (...args) => { calls.browser.push(args); return options.browserResult ?? { type: 'success', url: callback + '?code=test-code&sb_flow_id=flow_id_123' }; } },
    '../lib/supabase': { supabase: client },
  })('src/services/auth-service.ts');
  return { service, values, calls };
}
const originalFetch = global.fetch;
before(() => { global.fetch = async () => ({ ok: true, json: async () => ({ external: { google: true } }) }); });
after(() => { global.fetch = originalFetch; });

test('Google requests a real Supabase OAuth session and validates profile before returning to checkout', async () => {
  const h = harness({ missingProfile: true });
  const destination = { pathname: '/checkout', params: { mode: 'buy-now', productId: user.id, variantId: other, quantity: '2' } };
  assert.deepEqual(await h.service.signInWithGoogle(destination), destination);
  assert.equal(h.calls.oauth[0].provider, 'google');
  assert.equal(h.calls.oauth[0].options.redirectTo, callback);
  assert.equal(h.calls.oauth[0].options.skipBrowserRedirect, true);
  assert.equal(h.calls.oauth[0].options.queryParams.prompt, 'select_account');
  assert.deepEqual(h.calls.exchange, [['test-code', { flowId: 'flow_id_123' }]]);
  assert.equal(h.values.has(pendingKey), false);
});
test('closing or cancelling Google does not establish a session and allows another attempt', async () => {
  for (const type of ['cancel', 'dismiss']) {
    const h = harness({ browserResult: { type } });
    await assert.rejects(h.service.signInWithGoogle({ pathname: '/cart' }), h.service.LoginCancelled);
    await assert.rejects(h.service.signInWithGoogle({ pathname: '/cart' }), h.service.LoginCancelled);
    assert.equal(h.calls.exchange.length, 0); assert.equal(h.values.size, 0);
  }
});
test('provider-disabled and network errors never open the browser or report success', async () => {
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ external: { google: false } }) });
    const h = harness();
    await assert.rejects(h.service.signInWithGoogle({ pathname: '/account' }), /chưa được bật/);
    assert.equal(h.calls.browser.length, 0); assert.equal(h.calls.exchange.length, 0);
    global.fetch = async () => { throw new Error('Failed to fetch'); };
    await assert.rejects(h.service.signInWithGoogle({ pathname: '/account' }), /fetch/);
    assert.equal(h.calls.browser.length, 0);
  } finally { global.fetch = async () => ({ ok: true, json: async () => ({ external: { google: true } }) }); }
});
test('Expo Go is rejected with a clear development-build instruction', async () => {
  const h = harness({ expoGo: true });
  await assert.rejects(h.service.signInWithGoogle({ pathname: '/account' }), /Expo Go/);
  assert.equal(h.calls.oauth.length, 0);
});
test('callback validates the exact app address, code, errors and flow identifier', () => {
  const { service } = harness();
  for (const url of ['https://evil.example/auth/callback?code=x', 'uniqlomobile://evil/callback?code=x', callback + '?access_token=x', callback + '?code=x#access_token=x', callback + '?code=x&sb_flow_id=../bad'])
    assert.throws(() => service.parseGoogleCallback(url, callback));
  assert.throws(() => service.parseGoogleCallback(callback + '?error=access_denied', callback), service.LoginCancelled);
  assert.throws(() => service.parseGoogleCallback(callback + '?error=server_error&error_description=secret', callback), /Google không thể/);
});
test('cold callback restores persisted intent and concurrent callbacks exchange the code only once', async () => {
  const values = new Map([[pendingKey, JSON.stringify({ returnTo: '/cart', redirectTo: callback, startedAt: Date.now() })]]);
  const h = harness({ values });
  const url = callback + '?code=cold-code';
  const results = await Promise.all([h.service.completeGoogleLogin(url), h.service.completeGoogleLogin(url)]);
  assert.deepEqual(results, [{ pathname: '/cart', params: {} }, { pathname: '/cart', params: {} }]);
  assert.equal(h.calls.exchange.length, 1);
  assert.equal(values.has(pendingKey), false);
});
test('expired and unsolicited callbacks do not create sessions', async () => {
  for (const stored of [null, JSON.stringify({ returnTo: '/cart', redirectTo: callback, startedAt: Date.now() - 11 * 60 * 1000 })]) {
    const values = new Map(stored ? [[pendingKey, stored]] : []);
    const h = harness({ values });
    await assert.rejects(h.service.completeGoogleLogin(callback + '?code=expired'), /hết hạn/);
    assert.equal(h.calls.exchange.length, 0);
  }
});
test('profile failure is surfaced instead of navigating as a successful Google login', async () => {
  const h = harness({ missingProfile: true, profileError: new Error('RPC absent') });
  await assert.rejects(h.service.signInWithGoogle({ pathname: '/cart' }), /08_auth_profiles/);
});
test('sign out is scoped to this device, clears pending login and propagates errors', async () => {
  const h = harness(); h.values.set(pendingKey, 'old intent');
  await h.service.signOutCurrentDevice();
  assert.deepEqual(h.calls.signout, [{ scope: 'local' }]); assert.equal(h.values.size, 0);
  await assert.rejects(harness({ signoutError: new Error('network') }).service.signOutCurrentDevice(), /đăng xuất/);
});
test('real Supabase client restores a persisted password session and removes it on sign out', async () => {
  const { createClient } = require('@supabase/supabase-js');
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.test';
  const fetchAuth = async url => new Response(JSON.stringify(String(url).includes('/token') ? {
    access_token: token, refresh_token: 'local-test-refresh', expires_in: 3600, token_type: 'bearer', user,
  } : {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const makeClient = () => createClient('https://auth.example', 'test-public-key', { auth: {
    storage, storageKey: 'test-session', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce',
  }, global: { fetch: fetchAuth } });
  const first = makeClient();
  assert.equal((await first.auth.signInWithPassword({ email: user.email, password: 'local-test-password' })).error, null);
  assert.ok(values.has('test-session'));
  const restarted = makeClient();
  assert.equal((await restarted.auth.getSession()).data.session.user.id, user.id);
  assert.equal((await restarted.auth.signOut({ scope: 'local' })).error, null);
  assert.equal(values.has('test-session'), false);
  assert.equal((await makeClient().auth.getSession()).data.session, null);
});
test('native PKCE crypto shim provides a real SHA-256 digest and secure random values', async () => {
  const crypto = require('node:crypto');
  const nativeGlobal = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/pkce-crypto.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireMock = name => name === 'react-native' ? { Platform: { OS: 'android' } } : {
    getRandomValues: array => crypto.webcrypto.getRandomValues(array), CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: (algorithm, data) => crypto.webcrypto.subtle.digest(algorithm, data),
  };
  new Function('require', 'exports', 'globalThis', source)(requireMock, {}, nativeGlobal);
  const result = await nativeGlobal.crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));
  assert.equal(Buffer.from(result).toString('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const bytes = nativeGlobal.crypto.getRandomValues(new Uint8Array(32)); assert.equal(bytes.length, 32); assert.ok(bytes.some(n => n !== 0));
  await assert.rejects(nativeGlobal.crypto.subtle.digest('MD5', new Uint8Array()), /Unsupported/);
});

let db;
const migration = fs.readFileSync(path.join(root, '../database/migrations/08_auth_profiles.sql'), 'utf8');
before(async () => {
  db = new PGlite();
  await db.exec('create schema auth; create role anon; create role authenticated; create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default \'{}\'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting(\'test.uid\',true),\'\')::uuid $$; grant usage on schema auth to authenticated;');
  const schema = fs.readFileSync(path.join(root, '../database/migrations/01_schema.sql'), 'utf8');
  await db.exec(schema.slice(schema.indexOf('create table public.branches'), schema.indexOf('-- 4. categories')));
  await db.exec(schema.slice(schema.indexOf('create or replace function public.handle_new_user()')));
  await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)', [user.id, user.email, JSON.stringify({ full_name: '  Google User  ', role: 'admin' })]);
  await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)', [other, 'admin@example.com', JSON.stringify({ full_name: 'Administrator' })]);
  await db.query('update public.profiles set role=\'admin\' where id=$1', [other]);
  await db.exec(migration);
});
after(async () => { await db?.close(); });
test('profile migration is rerunnable and never overwrites existing admin privileges', async () => {
  await db.exec(migration);
  assert.equal((await db.query('select role from public.profiles where id=$1', [other])).rows[0].role, 'admin');
  assert.equal((await db.query('select role from public.profiles where id=$1', [user.id])).rows[0].role, 'customer');
});
test('new Google profiles use name fallbacks, never user metadata role or branch', async () => {
  for (const [suffix, metadata, expected] of [['3', { full_name: '  ', name: 'Google Name', role: 'admin', branch_id: other }, 'Google Name'], ['4', {}, 'Khách hàng']]) {
    const id = '00000000-0000-4000-8000-00000000000' + suffix;
    await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,null,$2)', [id, JSON.stringify(metadata)]);
    const row = (await db.query('select * from public.profiles where id=$1', [id])).rows[0];
    assert.equal(row.full_name, expected); assert.equal(row.role, 'customer'); assert.equal(row.branch_id, null);
  }
});
test('authenticated recovery repairs only the caller profile and rejects anonymous access', async () => {
  await db.query('delete from public.profiles where id=$1', [user.id]);
  await db.query("select set_config('test.uid',$1,false)", [user.id]);
  await db.exec('set role authenticated');
  try {
    const result = (await db.query('select (public.ensure_my_profile()).*')).rows[0];
    assert.equal(result.id, user.id); assert.equal(result.full_name, 'Google User'); assert.equal(result.role, 'customer');
    await assert.rejects(db.query('select public.ensure_my_profile($1)', [other]), /does not exist/);
  } finally { await db.exec('reset role'); }
  await db.exec('set role anon');
  try { await assert.rejects(db.query('select public.ensure_my_profile()'), /permission denied/); }
  finally { await db.exec('reset role'); }
});
