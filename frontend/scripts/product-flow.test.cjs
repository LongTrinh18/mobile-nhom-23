const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
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
test('buy-now uses place_order (cart untouched) while cart checkout uses place_cart_order, both with a UUID key', async () => {
  const calls = [];
  const api = loader({ './client': { db: () => ({ rpc: async (name, input) => { calls.push({ name, input });
    return { data: [{ order_id: id(8), order_code: 'DH-8', total_amount: 80000, is_duplicate: false }], error: null }; } }) } })('src/api/orderApi.ts');
  const input = { fulfillmentType: 'delivery', deliveryAddress: '1 Lê Lợi', idempotencyKey: id(77), voucherCode: 'UNIQLO10',
    items: [{ variantId: id(2), quantity: 2 }], customerName: 'Test', customerPhone: '0912345678' };
  await api.placeOrder(input);
  await api.placeCartOrder({ ...input, fulfillmentType: 'pickup', branchId: id(4), deliveryAddress: undefined });
  assert.deepEqual(calls.map(call => call.name), ['place_order', 'place_cart_order']);
  assert.deepEqual(calls[0].input.p_items, [{ variant_id: id(2), quantity: 2 }]);
  assert.equal(calls[0].input.p_fulfillment_type, 'delivery');
  assert.equal(calls[0].input.p_delivery_address, '1 Lê Lợi');
  assert.equal(calls[0].input.p_voucher_code, 'UNIQLO10');
  assert.equal(calls[0].input.p_idempotency_key, id(77));
  assert.equal(calls[1].input.p_branch_id, id(4));
  assert.equal(calls[1].input.p_delivery_address, null);
});
test('order keys are RFC 4122 UUIDs, never the old "idemp-..." strings', () => {
  const { uuidv4, isUuid } = loader()('src/lib/uuid.ts');
  const keys = new Set(Array.from({ length: 50 }, () => uuidv4()));
  assert.equal(keys.size, 50);
  for (const key of keys) assert.ok(isUuid(key), key);
  assert.equal(isUuid('idemp-1731400000000-abc123'), false);
});
// The SQL for buy-now (place_order on the full schema, cart preserved) is covered by scripts/checkout-flow.test.cjs.
