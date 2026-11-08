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
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
      ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, file);
    return mod.exports;
  }
  return relative => load(path.join(root, relative));
}
const routes = loader()('src/navigation/routes.ts');
const purchase = loader()('src/services/product-purchase.ts');
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const product = { id: id(1), name: 'Áo thun', description: '', category: 'Áo', priceVnd: 40000,
  variants: [{ id: id(2), productId: id(1), sku: 'TEE-M', size: 'M', color: 'Trắng' }] };
const catalog = { products: [product], branches: [{ id: id(3), name: 'Cửa hàng A' }, { id: id(4), name: 'Cửa hàng B' }],
  stock: [{ skuId: id(2), branchId: id(3), quantity: 0 }, { skuId: id(2), branchId: id(4), quantity: 4 }, { skuId: id(2), branchId: id(99), quantity: 99 }] };

test('logical back follows parent screens, including deep links and order success', () => {
  assert.equal(routes.backTarget('/', {}), null);
  assert.equal(routes.backTarget('/products', {}).pathname, '/');
  assert.equal(routes.backTarget('/cart', {}).pathname, '/');
  assert.equal(routes.backTarget('/checkout', {}).pathname, '/cart');
  assert.equal(routes.backTarget('/checkout/success', {}).pathname, '/orders');
  assert.equal(routes.backTarget('/products/' + id(1), {}).pathname, '/products');
  assert.equal(routes.backTarget('/products/' + id(1), { origin: 'home' }).pathname, '/');
});
test('detail back preserves search/group/feed filters and direct checkout returns to the selected SKU', () => {
  const context = { origin: 'products', audience: 'women', feed: 'offers', q: 'Áo', section: 'tops', collection: 'essentials', productId: id(1), variantId: id(2), quantity: '2', mode: 'buy-now' };
  assert.deepEqual(routes.backTarget('/products/' + id(1), context), { pathname: '/products', params: { audience: 'women', feed: 'offers', collection: 'essentials', section: 'tops', q: 'Áo' } });
  const back = routes.backTarget('/checkout', context);
  assert.equal(back.pathname, '/products/[id]'); assert.equal(back.params.id, id(1));
  assert.equal(back.params.variantId, id(2)); assert.equal(back.params.quantity, '2');
  assert.equal(routes.backTarget('/chatbot', context).params.id, id(1));
});
test('login/register retain an allowlisted return destination and reject external redirects', () => {
  const target = { pathname: '/checkout', params: { mode: 'buy-now', productId: id(1), variantId: id(2), quantity: '2', origin: 'products' } };
  const login = routes.loginTarget(target);
  assert.deepEqual(routes.safeReturnTarget(login.params.returnTo), target);
  assert.equal(routes.backTarget('/auth/login', login.params).pathname, '/products/[id]');
  assert.equal(routes.backTarget('/auth/register', login.params).pathname, '/auth/login');
  for (const url of ['https://bad.example', '//bad.example', '/auth/login', '/products/%2e%2e', '/checkout?q=%ZZ']) {
    assert.equal(routes.safeReturnTarget(url).pathname, '/account');
  }
  const clean = routes.safeReturnTarget('/cart?access_token=secret&returnTo=https%3A%2F%2Fbad.example');
  assert.deepEqual(clean, { pathname: '/cart', params: {} });
});
test('availability uses the best active store, rather than the first branch or the sum', () => {
  assert.equal(purchase.variantPurchaseLimit(catalog, id(2)), 4);
  assert.equal(purchase.variantPurchaseLimit({ ...catalog, stock: catalog.stock.map(row => ({ ...row, quantity: row.branchId === id(99) ? 99 : 0 })) }, id(2)), 0);
  assert.equal(purchase.variantPurchaseLimit({ ...catalog, products: [] }, id(2)), 0);
});
test('invalid buy-now parameters never fall back to checking out the shopping cart', () => {
  assert.equal(purchase.parseCheckoutIntent({}).kind, 'cart');
  for (const quantity of ['0', '-1', '11', 'NaN', '1.5', '']) {
    assert.equal(purchase.parseCheckoutIntent({ mode: 'buy-now', productId: id(1), variantId: id(2), quantity }).kind, 'invalid');
  }
  assert.equal(purchase.parseCheckoutIntent({ mode: 'unexpected' }).kind, 'invalid');
  assert.equal(purchase.parseCheckoutIntent({ mode: 'buy-now', productId: id(1), variantId: id(2), quantity: '2' }).kind, 'buy-now');
});
test('buy-now preview validates product/variant ownership and uses the selected branch stock', () => {
  const draft = { productId: id(1), variantId: id(2), quantity: 2 };
  assert.equal(purchase.buyNowItem(catalog, draft, id(3)).maxAvailable, 0);
  assert.equal(purchase.buyNowItem(catalog, draft, id(4)).maxAvailable, 4);
  assert.equal(purchase.buyNowItem(catalog, draft, '').branchId, '');
  assert.throws(() => purchase.buyNowItem(catalog, draft, id(99)), /Chi nhánh/);
  assert.throws(() => purchase.buyNowItem(catalog, { ...draft, productId: id(99) }, id(4)), /không còn bán/);
});
test('native sharing opens the share sheet with a deep link containing only the product ID', async () => {
  let payload;
  const share = loader({ 'expo-linking': { createURL: value => 'uniqlomobile://' + value.slice(1) }, 'react-native': {
    Platform: { OS: 'android' }, Share: { dismissedAction: 'dismissed', share: async value => { payload = value; return { action: 'shared' }; } },
  } })('src/services/product-share.ts');
  assert.equal(await share.shareProduct(product), 'shared');
  assert.ok(payload.message.includes('uniqlomobile://products/' + id(1)));
  assert.ok(payload.message.includes('40.000'));
  assert.ok(!payload.message.includes('access_token') && !payload.message.includes('returnTo'));
});
test('buy-now API uses the independent RPC rather than the cart-consuming RPC', async () => {
  let called;
  const api = loader({ './client': { db: () => ({ rpc: async (name, input) => { called = { name, input }; return { data: [{ order_id: id(8), order_code: 'DH-8', total_amount: 80000 }], error: null }; } }) } })('src/api/orderApi.ts');
  await api.placeBuyNowOrder({ branchId: id(4), items: [{ variantId: id(2), quantity: 2 }], customerName: 'Test', customerPhone: '0912345678' });
  assert.equal(called.name, 'place_buy_now_order'); assert.deepEqual(called.input.p_items, [{ variant_id: id(2), quantity: 2 }]);
});

const db = new PGlite();
const migration = fs.readFileSync(path.join(root, '../database/migrations/07_buy_now.sql'), 'utf8');
before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid; $$;
    grant usage on schema auth to anon, authenticated;
    create table public.products (id uuid primary key, is_active boolean, base_price int, sale_price int);
    create table public.product_variants (id uuid primary key, product_id uuid, sku text, is_active boolean);
    create table public.branches (id uuid primary key, is_active boolean);
    create table public.inventory (id uuid primary key, branch_id uuid, variant_id uuid, quantity int, reserved_quantity int);
    create sequence public.order_code_seq;
    create table public.orders (id uuid primary key default gen_random_uuid(), order_code text unique, user_id uuid, branch_id uuid,
      total_amount int, customer_name text, customer_phone text, note text);
    create table public.order_items (order_id uuid, variant_id uuid, product_id uuid, quantity int, unit_price int);
    create table public.cart_items (user_id uuid, variant_id uuid, quantity int);
    insert into public.products values ('${id(1)}',true,50000,40000);
    insert into public.product_variants values ('${id(2)}','${id(1)}','TEE-M',true);
    insert into public.branches values ('${id(4)}',true), ('${id(5)}',false);
    insert into public.inventory values ('${id(6)}','${id(4)}','${id(2)}',10,0);
    insert into public.cart_items values ('${id(9)}','${id(2)}',5), ('${id(9)}','${id(7)}',3);
  `);
  await db.exec(migration);
  await db.exec(migration);
});
after(async () => { await db.close(); });
async function buy(quantity, branch = id(4)) {
  return db.query('select * from public.place_buy_now_order($1,$2::jsonb,$3,$4,null)',
    [branch, JSON.stringify([{ variant_id: id(2), quantity }]), 'Test Customer', '0912345678']);
}
test('buy-now SQL preserves every cart row and reserves only the requested SKU quantity at server price', async () => {
  await db.query("select set_config('test.user',$1,false)", [id(9)]);
  const beforeCart = (await db.query('select * from cart_items order by variant_id')).rows;
  const result = await buy(2);
  assert.equal(result.rows[0].total_amount, 80000);
  assert.equal((await db.query('select reserved_quantity from inventory')).rows[0].reserved_quantity, 2);
  assert.deepEqual((await db.query('select * from cart_items order by variant_id')).rows, beforeCart);
  assert.equal((await db.query('select quantity from order_items')).rows[0].quantity, 2);
});
test('failed buy-now checks roll back all writes for stock, quantity, auth and inactive branches', async () => {
  await assert.rejects(buy(10), /OUT_OF_STOCK/);
  await assert.rejects(buy(11), /INVALID_QUANTITY/);
  await assert.rejects(buy(1, id(5)), /INVALID_BRANCH/);
  await db.query("select set_config('test.user','',false)");
  await assert.rejects(buy(1), /NOT_AUTHENTICATED/);
  assert.equal((await db.query('select count(*)::int as n from orders')).rows[0].n, 1);
  assert.equal((await db.query('select reserved_quantity from inventory')).rows[0].reserved_quantity, 2);
  assert.equal((await db.query('select sum(quantity)::int as n from cart_items')).rows[0].n, 8);
});
test('anonymous users cannot execute the buy-now transaction', async () => {
  await db.exec('set role anon');
  try { await assert.rejects(buy(1), /permission denied/); }
  finally { await db.exec('reset role'); }
});
