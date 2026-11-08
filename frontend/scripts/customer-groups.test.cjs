const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.join(__dirname, '../src/data/customer-groups.ts');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { customerGroups, getCategoryAudience, matchesAudience, matchesBrowseCategory, normalizeSearch } = mod.exports;
const product = { id: 'p1', name: 'Áo thun', category: 'Áo thun', categorySlug: 'ao-thun', audience: 'unisex' };

test('four groups have stable page order and sixteen distinct picture cells', () => {
  assert.deepEqual(customerGroups.map(g => g.key), ['men', 'women', 'kids', 'baby']);
  assert.equal(new Set(customerGroups.flatMap(g => g.categories.map(c => g.imageRow + ':' + c.imageColumn))).size, 16);
});
test('unisex adult garments are shared by men and women, never by kids or babies', () => {
  assert.equal(matchesAudience(product, 'men'), true);
  assert.equal(matchesAudience(product, 'women'), true);
  assert.equal(matchesAudience(product, 'kids'), false);
  assert.equal(matchesAudience(product, 'baby'), false);
  assert.equal(matchesAudience({ ...product, audience: undefined }, 'baby'), false);
});
test('explicit customer group overrides unisex gender and remains isolated from other groups', () => {
  assert.equal(getCategoryAudience({ customer_group: 'kids', gender: 'unisex' }), 'kids');
  assert.equal(getCategoryAudience({ customer_group: 'baby', gender: 'unisex' }), 'baby');
  assert.equal(matchesAudience({ ...product, audience: 'kids' }, 'baby'), false);
  assert.equal(matchesAudience({ ...product, audience: 'kids' }, 'men'), false);
});
test('existing categories work before migration, while audience-prefixed slugs remain recognizable', () => {
  assert.equal(getCategoryAudience({ gender: 'men', slug: 'so-mi' }), 'men');
  assert.equal(getCategoryAudience({ gender: 'unisex', slug: 'ao-thun' }), 'unisex');
  assert.equal(getCategoryAudience({ gender: 'unisex', slug: 'tre-em-ao-thun' }), 'kids');
  assert.equal(getCategoryAudience({ gender: 'unisex', slug: 'em-be-bodysuit' }), 'baby');
  assert.equal(getCategoryAudience({ slug: 'nu-vay-dam' }), 'women');
});
test('category links select the right garment type rather than returning the entire audience', () => {
  assert.equal(matchesBrowseCategory(product, 'tops'), true);
  assert.equal(matchesBrowseCategory(product, 'shirts'), false);
  assert.equal(matchesBrowseCategory({ ...product, categorySlug: 'nu-ao-so-mi' }, 'shirts'), true);
  assert.equal(matchesBrowseCategory({ ...product, categorySlug: 'tre-em-quan' }, 'bottoms'), true);
  assert.equal(matchesBrowseCategory({ ...product, categorySlug: 'em-be-bodysuit' }, 'bodysuits'), true);
  assert.equal(matchesBrowseCategory({ ...product, categorySlug: 'em-be-romper' }, 'sleepwear'), false);
  assert.equal(matchesBrowseCategory({ ...product, categorySlug: 'em-be-do-ngu' }, 'sleepwear'), true);
});
test('Vietnamese search ignores case, accents and surrounding whitespace', () => {
  assert.equal(normalizeSearch('  ÁO SƠ MI  '), 'ao so mi');
  assert.equal(normalizeSearch('Đầm'), 'dam');
});
