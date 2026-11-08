const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.join(__dirname, '..');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module); cache.set(file, mod); mod.filename = file; mod.paths = module.paths;
    mod.require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      return require(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, file);
    return mod.exports;
  }
  return relative => load(path.join(root, relative));
}
const { homeSections, selectHomeProducts, discountPercent, collectionsForAudience } = loader()('src/data/home-sections.ts');
const products = [
  { id: 'old', name: 'Old', category: 'Áo', audience: 'unisex', createdAt: '2026-01-01T00:00:00Z', priceVnd: 100, basePriceVnd: 100 },
  { id: 'new', name: 'New', category: 'Áo', audience: 'men', createdAt: '2026-11-07T00:00:00Z', priceVnd: 80, basePriceVnd: 100 },
  { id: 'sale', name: 'Sale', category: 'Áo', audience: 'women', createdAt: '2026-09-01T00:00:00Z', priceVnd: 50, basePriceVnd: 100 },
  { id: 'child', name: 'Child', category: 'Áo', audience: 'kids', createdAt: '2026-11-08T00:00:00Z', priceVnd: 70, basePriceVnd: 100 },
];
const collections = [
  { id: 'c1', slug: 'one', name: 'One', description: '', productIds: ['sale', 'old', 'missing'] },
  { id: 'c2', slug: 'two', name: 'Two', description: '', productIds: ['old', 'child'] },
];
test('home section order is stable and arrivals use real timestamps without mutating the catalog', () => {
  assert.deepEqual(homeSections.map(s => s.key), ['new', 'bestsellers', 'offers', 'collections']);
  assert.deepEqual(selectHomeProducts(products, 'new', { audience: 'men' }).map(p => p.id), ['new', 'old']);
  assert.deepEqual(products.map(p => p.id), ['old', 'new', 'sale', 'child']);
});
test('offers require an actual markdown and remain filtered by audience', () => {
  assert.deepEqual(selectHomeProducts(products, 'offers', { audience: 'women' }).map(p => p.id), ['sale']);
  assert.equal(discountPercent(products[1]), 20);
  assert.equal(discountPercent({ ...products[1], basePriceVnd: undefined }), 0);
  assert.equal(discountPercent({ ...products[1], priceVnd: -1 }), 0);
});
test('bestsellers never fall back to arrivals or unsold products', () => {
  assert.deepEqual(selectHomeProducts(products, 'bestsellers'), []);
  assert.deepEqual(selectHomeProducts(products, 'bestsellers', { audience: 'men', bestSellers: [
    { productId: 'new', unitsSold: 2 }, { productId: 'old', unitsSold: 9 }, { productId: 'child', unitsSold: 100 },
  ] }).map(p => p.id), ['old', 'new']);
});
test('collections use explicit membership, deduplicate products, and exclude adult products from children', () => {
  assert.deepEqual(selectHomeProducts(products, 'collections', { collections, audience: 'women' }).map(p => p.id), ['sale', 'old']);
  assert.deepEqual(selectHomeProducts(products, 'collections', { collections, collectionSlug: 'two', audience: 'kids' }).map(p => p.id), ['child']);
  assert.deepEqual(selectHomeProducts(products, 'collections', { collections, collectionSlug: 'missing' }), []);
  assert.deepEqual(collectionsForAudience(collections, products, 'baby'), []);
});
test('home service reads only the public aggregate and active curated collection membership', async () => {
  const calls = [];
  const supabase = {
    rpc: async name => { calls.push(name); return { data: [{ product_id: 'new', units_sold: '5' }], error: null }; },
    from: name => { calls.push(name); const query = {
      select: fields => { calls.push(fields); return query; }, eq: (...args) => { calls.push(args); return query; },
      order: () => query,
      then: resolve => Promise.resolve({ data: [{ id: 'c1', slug: 'one', name: 'One', description: null,
        products: [{ product_id: 'new', sort_order: 2 }, { product_id: 'old', sort_order: 1 }] }], error: null }).then(resolve),
    }; return query; },
  };
  const service = loader({ '../lib/supabase': { supabase } })('src/services/home-service.ts');
  assert.deepEqual(await service.getBestSellers(), [{ productId: 'new', unitsSold: 5 }]);
  assert.deepEqual((await service.getHomeCollections())[0].productIds, ['old', 'new']);
  assert.ok(calls.includes('get_home_best_sellers'));
  assert.ok(calls.includes('collections'));
  assert.ok(!calls.includes('orders') && !calls.includes('order_items'));
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'is_active' && call[1] === true));
});
test('a failed bestsellers RPC is surfaced while collections can still load', async () => {
  const broken = loader({ '../lib/supabase': { supabase: { rpc: async () => ({ data: null, error: new Error('Missing RPC') }) } } })('src/services/home-service.ts');
  await assert.rejects(broken.getBestSellers(), /Missing RPC/);
  const demo = loader({ '../lib/supabase': { supabase: null } })('src/services/home-service.ts');
  assert.deepEqual(await demo.getBestSellers(), []);
  assert.ok((await demo.getHomeCollections()).length > 0);
});

// Execute the actual migration in a local, in-memory PostgreSQL instance.
const db = new PGlite();
const migration = fs.readFileSync(path.join(root, '../database/migrations/06_home_sections.sql'), 'utf8');
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.is_admin() returns boolean language sql stable as $$
      select coalesce(current_setting('test.admin', true), 'off') = 'on';
    $$;
    create table public.products (id uuid primary key, code text unique, is_active boolean, created_at timestamptz default now());
    create table public.orders (id uuid primary key, status text, completed_at timestamptz, created_at timestamptz default now());
    create table public.order_items (order_id uuid, product_id uuid, quantity int);
    alter table public.orders enable row level security;
    alter table public.order_items enable row level security;
    grant select on public.products, public.orders, public.order_items to anon, authenticated;
    insert into public.products (id, code, is_active) values
      ('${id(1)}', 'AT001', true), ('${id(2)}', 'SM001', true), ('${id(3)}', 'AK001', true), ('${id(4)}', 'QK001', true), ('${id(5)}', 'HIDDEN', false);
    insert into public.orders (id, status, completed_at, created_at) values
      ('${id(10)}', 'completed', now(), now() - interval '40 days'),
      ('${id(11)}', 'cancelled', now(), now()),
      ('${id(12)}', 'pending', null, now()),
      ('${id(13)}', 'completed', now() - interval '31 days', now() - interval '32 days');
    insert into public.order_items values
      ('${id(10)}', '${id(1)}', 2), ('${id(10)}', '${id(1)}', 3), ('${id(10)}', '${id(2)}', 3),
      ('${id(11)}', '${id(3)}', 99), ('${id(12)}', '${id(4)}', 99), ('${id(13)}', '${id(2)}', 100), ('${id(10)}', '${id(5)}', 999);
  `);
  await db.exec(migration);
});
after(async () => { await db.close(); });

test('SQL migration is rerunnable and seed membership does not duplicate', async () => {
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::int as n from public.collections')).rows[0].n, 2);
  assert.equal((await db.query('select count(*)::int as n from public.collection_products')).rows[0].n, 4);
});
test('anonymous sales ranking aggregates SKU quantities from completed recent orders only', async () => {
  await db.exec('set role anon');
  try {
    const result = await db.query('select * from public.get_home_best_sellers()');
    assert.deepEqual(result.rows.map(r => [r.product_id, Number(r.units_sold)]), [[id(1), 5], [id(2), 3]]);
    assert.deepEqual(Object.keys(result.rows[0]).sort(), ['product_id', 'units_sold']);
    assert.deepEqual((await db.query('select * from public.orders')).rows, []);
    assert.deepEqual((await db.query('select * from public.order_items')).rows, []);
  } finally { await db.exec('reset role'); }
});
test('public collection reads hide inactive collections and products; anonymous writes are denied', async () => {
  await db.exec(`insert into public.collections (id,slug,name,is_active) values ('${id(30)}','hidden','Hidden',false);
    insert into public.collection_products values ('${id(30)}','${id(1)}',1);
    insert into public.collection_products select id,'${id(5)}',9 from public.collections where slug='everyday-essentials';`);
  await db.exec('set role anon');
  try {
    assert.equal((await db.query('select * from public.collections')).rows.length, 2);
    const membership = (await db.query('select * from public.collection_products')).rows;
    assert.equal(membership.length, 4);
    assert.ok(membership.every(r => r.product_id !== id(5) && r.collection_id !== id(30)));
    await assert.rejects(db.query("insert into public.collections (slug,name) values ('bad','Bad')"), /permission denied/);
  } finally { await db.exec('reset role'); }
});
test('authenticated non-admins cannot edit collection membership', async () => {
  await db.exec('set role authenticated');
  try {
    await assert.rejects(db.query("insert into public.collections (slug,name) values ('bad-auth','Bad')"), /row-level security/);
  } finally { await db.exec('reset role'); }
});
