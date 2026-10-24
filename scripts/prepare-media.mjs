import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const directory = path.resolve('public/media');
await fs.mkdir(path.join(directory, 'thumbs'), { recursive: true });
let count = 0;
for (const name of await fs.readdir(directory, { recursive: true })) {
  if (name.split(path.sep).includes('thumbs')) continue;
  if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) continue;
  const output = path.join(directory, 'thumbs', name.replace(/\.[^.]+$/, '.webp'));
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(path.join(directory, name)).rotate().resize({ width: 640, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toFile(output);
  count++;
}
console.log(`Prepared ${count} reading thumbnails; original images retained.`);
