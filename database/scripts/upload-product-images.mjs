// Upload ảnh sản phẩm trong database/storage/product-images lên bucket Supabase `product-images`.
// Đường dẫn file = đúng cột path trong public.product_media, nên app hiện ảnh ngay sau khi upload.
//
// Cần Secret key (sb_secret_...) hoặc service_role key: Supabase → Project Settings → API Keys.
// KHÔNG lưu key vào file. Chạy từ thư mục gốc repo:
//   node database/scripts/upload-product-images.mjs            (script hỏi key, gõ vào không hiện ra màn hình)
//   $env:SUPABASE_SECRET_KEY="sb_secret_..."; node database/scripts/upload-product-images.mjs   (PowerShell)
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(root, 'frontend/package.json'));
const { createClient } = require('@supabase/supabase-js');
const BUCKET = 'product-images';
const source = join(root, 'database/storage', BUCKET);

function envFile(name) {
  try {
    const line = readFileSync(join(root, 'frontend/.env'), 'utf8').split(/\r?\n/).find(row => row.startsWith(name + '='));
    return line?.slice(name.length + 1).trim().replace(/^"|"$/g, '');
  } catch { return undefined; }
}
function askHidden(question) {
  return new Promise(resolveAnswer => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let prompted = false;
    rl._writeToOutput = text => {
      if (!prompted) { prompted = true; rl.output.write(text); } else if (/\r|\n/.test(text)) rl.output.write('\n'); else rl.output.write('*');
    };
    rl.question(question, answer => { rl.close(); resolveAnswer(answer.trim()); });
  });
}
function files(folder) {
  return readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const url = process.env.SUPABASE_URL ?? envFile('EXPO_PUBLIC_SUPABASE_URL');
if (!url) throw new Error('Thiếu SUPABASE_URL (hoặc EXPO_PUBLIC_SUPABASE_URL trong frontend/.env).');
const key = process.env.SUPABASE_SECRET_KEY || await askHidden('Dán Secret key (sb_secret_...) rồi Enter: ');
if (!key || key.startsWith('sb_publishable_')) throw new Error('Cần Secret key / service_role key; publishable key không có quyền upload.');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: bucket, error: bucketError } = await supabase.storage.getBucket(BUCKET);
if (bucketError) throw new Error('Không đọc được bucket ' + BUCKET + ': ' + bucketError.message);
if (!bucket.public) console.warn('Cảnh báo: bucket ' + BUCKET + ' đang private, app sẽ không tải được ảnh. Bật Public trong Storage.');

let failed = 0;
for (const file of files(source).sort()) {
  const path = relative(source, file).split('\\').join('/');
  const { error } = await supabase.storage.from(BUCKET).upload(path, readFileSync(file), {
    contentType: 'image/webp', cacheControl: '3600', upsert: true,
  });
  if (error) { failed++; console.error('LỖI  ', path, error.message); continue; }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const check = await fetch(publicUrl, { method: 'HEAD' });
  console.log(check.ok ? 'OK   ' : 'CHƯA XEM ĐƯỢC', path, check.ok ? '' : '(HTTP ' + check.status + ')');
  if (!check.ok) failed++;
}
console.log(failed ? `Xong, ${failed} file lỗi.` : 'Xong: tất cả ảnh đã lên bucket và xem được công khai.');
process.exit(failed ? 1 : 0);
