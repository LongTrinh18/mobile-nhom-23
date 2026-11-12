// End-to-end database test: runs EVERY migration (01 → 09) on PGlite with small Supabase stubs,
// then exercises the order flow the app uses. Run: npm run test:checkout
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migrations = path.join(__dirname, '../../database/migrations');
const files = fs.readdirSync(migrations).filter(name => /^\d\d_.*\.sql$/.test(name)).sort();
const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const CUSTOMER = U(1), OTHER = U(2), MANAGER_CN01 = U(3), MANAGER_CN02 = U(4), NO_PROFILE = U(5);
const db = new PGlite();

function supabaseCompatible(sql) {
  return sql
    .replace(/create extension if not exists vector with schema extensions;/i, '')
    .replace(/extensions\.vector\(1536\)/g, 'text')
    .replace(/create extension if not exists pg_cron;/i, '');
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;
/** Runs one statement as a signed-in user (or anon) under RLS, like PostgREST does. */
async function as(uid, sql, params) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? '']);
  try { return (await db.query(sql, params)).rows; }
  finally { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}
const variant = async sku => (await rows('select id from public.product_variants where sku = $1', [sku]))[0].id;
const branch = async code => (await rows('select id from public.branches where code = $1', [code]))[0].id;
const stock = async (code, sku) => (await rows(`select i.quantity, i.reserved_quantity from public.inventory i
  join public.branches b on b.id = i.branch_id join public.product_variants v on v.id = i.variant_id
  where b.code = $1 and v.sku = $2`, [code, sku]))[0];
const items = list => JSON.stringify(list.map(([variant_id, quantity]) => ({ variant_id, quantity })));
function order(fn, uid, { lines, type = 'pickup', key, branchId = null, address = null, voucher = null }) {
  return as(uid, `select * from public.${fn}(p_items => $1::jsonb, p_fulfillment_type => $2, p_customer_name => 'Khách Test',
    p_customer_phone => '0912345678', p_idempotency_key => $3::uuid, p_branch_id => $4::uuid,
    p_delivery_address => $5, p_voucher_code => $6)`, [items(lines), type, key, branchId, address, voucher]);
}

before(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema extensions; create schema auth; create schema storage; create schema cron;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant execute on function auth.uid() to anon, authenticated;
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    create table cron.job (jobname text primary key, schedule text, command text);
    create function cron.schedule(n text, s text, c text) returns bigint language sql as $$
      insert into cron.job values (n, s, c) on conflict (jobname) do update set command = excluded.command returning 1::bigint $$;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  for (const file of files) await db.exec(supabaseCompatible(fs.readFileSync(path.join(migrations, file), 'utf8')));
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${CUSTOMER}', 'khach@test.com', '{"full_name":"Khách"}'), ('${OTHER}', 'other@test.com', '{}'),
      ('${MANAGER_CN01}', 'm1@test.com', '{}'), ('${MANAGER_CN02}', 'm2@test.com', '{}'), ('${NO_PROFILE}', 'np@test.com', '{}');
    update public.profiles set role = 'manager', branch_id = (select id from public.branches where code = 'CN01') where id = '${MANAGER_CN01}';
    update public.profiles set role = 'manager', branch_id = (select id from public.branches where code = 'CN02') where id = '${MANAGER_CN02}';
    delete from public.profiles where id = '${NO_PROFILE}';
  `);
});
after(async () => { await db.close(); });

test('all migrations apply in file order and 09 can be re-run', async () => {
  assert.ok(files.includes('09_fix_checkout_flow.sql'));
  await db.exec(supabaseCompatible(fs.readFileSync(path.join(migrations, '09_fix_checkout_flow.sql'), 'utf8')));
  const names = (await rows(`select proname from pg_proc where proname in ('place_cart_order', 'place_buy_now_order')`)).map(r => r.proname);
  assert.deepEqual(names, ['place_cart_order']);
});

test('the idempotency key must be a UUID (the old "idemp-..." key always failed)', async () => {
  const tee = await variant('AT001-BLACK-M');
  await assert.rejects(order('place_order', CUSTOMER, { lines: [[tee, 1]], key: 'idemp-1731400000000-abc', branchId: await branch('CN01') }),
    /invalid input syntax for type uuid/);
});

test('cart order reserves stock, removes only the ordered rows and a retry returns the same order', async () => {
  const tee = await variant('AT001-BLACK-M'), shirt = await variant('SM001-BLUE-M'), cn01 = await branch('CN01');
  const before = await stock('CN01', 'AT001-BLACK-M');
  await as(CUSTOMER, 'select public.add_to_cart($1::uuid, 2)', [tee]);
  await as(CUSTOMER, 'select public.add_to_cart($1::uuid, 1)', [shirt]);
  const [created] = await order('place_cart_order', CUSTOMER, { lines: [[tee, 2]], key: U(100), branchId: cn01 });
  assert.equal(created.is_duplicate, false);
  assert.equal(created.subtotal_amount, 2 * 149000);
  assert.equal((await stock('CN01', 'AT001-BLACK-M')).reserved_quantity, before.reserved_quantity + 2);
  const cart = await as(CUSTOMER, 'select variant_id, quantity from public.cart_items');
  assert.deepEqual(cart.map(r => r.variant_id), [shirt]);

  await as(CUSTOMER, 'select public.add_to_cart($1::uuid, 1)', [tee]);
  const [again] = await order('place_cart_order', CUSTOMER, { lines: [[tee, 2]], key: U(100), branchId: cn01 });
  assert.equal(again.is_duplicate, true);
  assert.equal(again.order_id, created.order_id);
  assert.equal((await as(CUSTOMER, 'select count(*)::int as n from public.cart_items'))[0].n, 2, 'a replay must not delete re-added rows');
});

test('buy now uses place_order: keeps the cart, supports delivery fees and validates vouchers on the server', async () => {
  const tee = await variant('AT001-BLACK-M');
  const cartBefore = await as(CUSTOMER, 'select variant_id, quantity from public.cart_items order by variant_id');
  const [delivery] = await order('place_order', CUSTOMER, { lines: [[tee, 1]], type: 'delivery', key: U(200), address: '1 Lê Lợi, Quận 1' });
  assert.equal(delivery.shipping_fee, 30000);
  assert.equal(delivery.total_amount, 149000 + 30000);
  const [discounted] = await order('place_order', CUSTOMER, { lines: [[tee, 4]], type: 'delivery', key: U(201), address: '1 Lê Lợi', voucher: 'uniqlo10' });
  assert.equal(discounted.discount_amount, Math.round(4 * 149000 * 0.1));
  assert.equal(discounted.shipping_fee, 0, 'free shipping when goods after discount exceed 500.000 ₫');
  await assert.rejects(order('place_order', CUSTOMER, { lines: [[tee, 1]], key: U(202), branchId: await branch('CN01'), voucher: 'FREESHIP' }), /INVALID_VOUCHER/);
  assert.deepEqual(await as(CUSTOMER, 'select variant_id, quantity from public.cart_items order by variant_id'), cartBefore);
});

test('out-of-stock pickup is rejected with the SKU detail and reserves nothing', async () => {
  const before = await stock('CN01', 'SM001-BLUE-L');
  await assert.rejects(order('place_order', CUSTOMER, { lines: [[await variant('SM001-BLUE-L'), 1]], key: U(300), branchId: await branch('CN01') }),
    /OUT_OF_STOCK: SM001-BLUE-L \(cần 1, còn 0\)/);
  assert.deepEqual(await stock('CN01', 'SM001-BLUE-L'), before);
});

test('customers cancel their own pending order; outsiders see ORDER_NOT_FOUND', async () => {
  const [placed] = await order('place_order', CUSTOMER, { lines: [[await variant('QK001-BEIGE-30'), 1]], key: U(400), branchId: await branch('CN02') });
  const reserved = (await stock('CN02', 'QK001-BEIGE-30')).reserved_quantity;
  await assert.rejects(as(OTHER, "select public.update_order_status($1::uuid, 'cancelled')", [placed.order_id]), /ORDER_NOT_FOUND/);
  await assert.rejects(as(MANAGER_CN01, "select public.update_order_status($1::uuid, 'confirmed')", [placed.order_id]), /ORDER_NOT_FOUND/);
  const [cancelled] = await as(CUSTOMER, "select status from public.update_order_status($1::uuid, 'cancelled', 'Đổi ý')", [placed.order_id]);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal((await stock('CN02', 'QK001-BEIGE-30')).reserved_quantity, reserved - 1);
  await assert.rejects(as(CUSTOMER, "select public.update_order_status($1::uuid, 'cancelled')", [placed.order_id]), /INVALID_TRANSITION/);
});

test('delivered orders count as best sellers', async () => {
  const [placed] = await order('place_order', CUSTOMER, { lines: [[await variant('AK001-NAVY-L'), 3]], type: 'delivery', key: U(500), address: '9 Nguyễn Huệ' });
  assert.equal(placed.branch_id, await branch('CN01'), 'without coordinates the first store (by code) that has stock delivers');
  const manager = MANAGER_CN01;
  for (const status of ['confirmed', 'shipping', 'delivered']) await as(manager, 'select public.update_order_status($1::uuid, $2)', [placed.order_id, status]);
  const sellers = await as(null, 'select * from public.get_home_best_sellers()');
  const productId = (await rows("select id from public.products where code = 'AK001'"))[0].id;
  assert.equal(Number(sellers.find(row => row.product_id === productId)?.units_sold), 3);
});

test('restock is refused for an account without a profile', async () => {
  await assert.rejects(as(NO_PROFILE, 'select public.restock($1::uuid, $2::uuid, 5)', [await branch('CN01'), await variant('AT001-BLACK-M')]), /FORBIDDEN/);
});

test('anonymous visitors only see active collections and active products in them', async () => {
  await db.exec(`update public.collections set is_active = false where slug = 'smart-casual'`);
  const visible = await as(null, `select c.slug from public.collection_products cp join public.collections c on c.id = cp.collection_id`);
  assert.ok(visible.length > 0);
  assert.ok(visible.every(row => row.slug !== 'smart-casual'));
});

test('anonymous visitors cannot place orders', async () => {
  await assert.rejects(order('place_cart_order', null, { lines: [[await variant('AT001-BLACK-M'), 1]], key: U(600), branchId: await branch('CN01') }),
    /permission denied/);
});
