import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { normalizeMarkdown, pageKey, recordId, toRecord } from './notion-model.mjs';

const config = JSON.parse(await fs.readFile(new URL('./notion-config.json', import.meta.url), 'utf8'));
const local = JSON.parse(await fs.readFile('src/data/archive.json', 'utf8'));
const localById = Object.fromEntries(local.entities.map(entity => [entity.id, entity]));

const token = process.env.NOTION_TOKEN;
const sourceId = process.env.NOTION_DATA_SOURCE_ID || config.dataSourceId;
if (!token || !sourceId) throw new Error('Configure NOTION_TOKEN and NOTION_DATA_SOURCE_ID before running the sync.');

const api = async (endpoint, method = 'GET', body) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch('https://api.notion.com/v1/' + endpoint, {
      method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2026-03-11', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000),
    });
    if (response.status === 429 && attempt < 3) { await new Promise(resolve => setTimeout(resolve, Math.min(Number(response.headers.get('retry-after') || 2), 30) * 1000)); continue; }
    if (!response.ok) throw new Error(`Notion returned HTTP ${response.status}. Previous snapshot retained.`);
    return response.json();
  }
  throw new Error('Notion rate limit did not recover. Previous snapshot retained.');
};

const entries = [];
let cursor;
do {
  const result = await api(`data_sources/${sourceId}/query`, 'POST', { page_size: 100, filter: { property: 'Published', checkbox: { equals: true } }, ...(cursor ? { start_cursor: cursor } : {}) });
  entries.push(...result.results);
  cursor = result.has_more ? result.next_cursor : null;
} while (cursor);

const pageIds = new Map(entries.map(page => [pageKey(page.id), recordId(page)]));
const publishedIds = new Set(pageIds.values());
if (publishedIds.size !== entries.length) throw new Error('Duplicate Archive IDs. Previous snapshot retained.');
const output = [];
const mediaDirectory = path.resolve('public/media/notion');
await fs.mkdir(mediaDirectory, { recursive: true });
for (const page of entries) {
  const result = await api(`pages/${page.id}/markdown`);
  if (result.truncated || result.unknown_block_ids?.length) throw new Error(`Page ${page.id} is truncated or contains unsupported blocks. Previous snapshot retained.`);
  if (typeof result.markdown !== 'string') throw new Error(`Missing Markdown on ${page.id}. Previous snapshot retained.`);
  let description = normalizeMarkdown(result.markdown, config.siteUrl, pageIds, publishedIds);
  // Copy images to durable static files; Notion image URLs are short-lived.
  const imageUrls = [...new Set([...description.matchAll(/!\[[^\]]*\]\((https:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match => match[1]))];
  const media = [...new Set([...description.matchAll(/!\[[^\]]*\]\((\/media\/[^)]+)\)/g)].map(match => match[1]))];
  for (const url of imageUrls) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Image download failed for page ${page.id}. Previous snapshot retained.`);
    const contentType = response.headers.get('content-type')?.split(';')[0];
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    if (!(contentType in extensions)) throw new Error('An unsupported image format requires manual review. Previous snapshot retained.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error('Image exceeds the 20 MB sync limit. Previous snapshot retained.');
    const filename = crypto.createHash('sha256').update(bytes).digest('hex') + '.' + extensions[contentType];
    await fs.writeFile(path.join(mediaDirectory, filename), bytes);
    const local = '/media/notion/' + filename;
    media.push(local); description = description.replaceAll(url, local);
  }
  output.push(toRecord(page, description, media, pageIds, publishedIds, localById));
}
const snapshot = { enabled: true, entities: output, syncedAt: new Date().toISOString() };
const destination = path.resolve('src/data/notion.json');
const temporary = destination + '.tmp';
await fs.writeFile(temporary, JSON.stringify(snapshot, null, 2));
await fs.rename(temporary, destination);
console.log(`Synchronized ${output.length} published records. Unpublished pages were excluded.`);
