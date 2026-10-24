import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const token = process.env.NOTION_TOKEN;
const sourceId = process.env.NOTION_DATA_SOURCE_ID || process.env.NOTION_DATABASE_ID;
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

const plain = property => property?.title?.map(item => item.plain_text).join('') || property?.rich_text?.map(item => item.plain_text).join('') || property?.select?.name || property?.status?.name || '';
const property = (properties, ...keys) => keys.map(key => properties[key]).find(Boolean);
const types = new Set(['person','location','organization','event','object','technology','infrastructure','project','system','document','media']);
const statuses = new Set(['documented','unknown','theory','early','legacy','partial']);
const entries = [];
let cursor;
do {
  const result = await api(`data_sources/${sourceId}/query`, 'POST', { page_size: 100, filter: { property: 'Published', checkbox: { equals: true } }, ...(cursor ? { start_cursor: cursor } : {}) });
  entries.push(...result.results);
  cursor = result.has_more ? result.next_cursor : null;
} while (cursor);

const pageIds = new Map(entries.map(page => [page.id.replaceAll('-', ''), 'NT-' + page.id.replaceAll('-', '')]));
const output = [];
const mediaDirectory = path.resolve('public/media/notion');
await fs.mkdir(mediaDirectory, { recursive: true });
for (const page of entries) {
  const props = page.properties;
  const type = plain(property(props, 'Type', '类型')) || 'document';
  const status = plain(property(props, 'Status', '状态')) || 'documented';
  if (!types.has(type) || !statuses.has(status)) throw new Error(`Invalid Type or Status on page ${page.id}. Previous snapshot retained.`);
  const result = await api(`pages/${page.id}/markdown`);
  if (result.truncated || result.unknown_block_ids?.length) throw new Error(`Page ${page.id} is truncated or contains unsupported blocks. Previous snapshot retained.`);
  if (typeof result.markdown !== 'string') throw new Error(`Missing Markdown on ${page.id}. Previous snapshot retained.`);
  let description = result.markdown;
  if (/<(?:img|image)\b/i.test(description)) throw new Error(`HTML images on ${page.id} require conversion to Markdown images. Previous snapshot retained.`);
  // Copy images to durable static files; Notion image URLs are short-lived.
  const imageUrls = [...new Set([...description.matchAll(/!\[[^\]]*\]\((https:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match => match[1]))];
  const media = [];
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
  description = description.replace(/https:\/\/(?:www\.)?notion\.(?:so|site|com)\/[^\s)]*?([a-f0-9]{32})(?:\?[^\s)]*)?/gi, (url, id) => pageIds.has(id.toLowerCase()) ? '/entity/' + pageIds.get(id.toLowerCase()) + '/' : url);
  const relatedProperty = property(props, 'Relations', '关联');
  if (relatedProperty?.has_more) throw new Error(`Relations on ${page.id} exceed the inline API limit; previous snapshot retained.`);
  const relations = (relatedProperty?.relation || []).filter(item => pageIds.has(item.id.replaceAll('-', ''))).map(item => ({ target: pageIds.get(item.id.replaceAll('-', '')), type: 'related_to' }));
  const name = plain(property(props, 'Name', '名称')) || '未命名记录';
  const summary = plain(property(props, 'Summary', '摘要')) || description.replace(/[#>*_`\n]/g, ' ').trim().slice(0, 140);
  const date = property(props, 'Date', '年代')?.date?.start || null;
  const number = property(props, 'Year', '年份')?.number;
  const aliases = plain(property(props, 'Aliases', '别名')).split(/[\n,，]/).filter(Boolean);
  output.push({ id: pageIds.get(page.id.replaceAll('-', '')), slug: page.id, name, nameLocal: name, type, status, summary, description, date, year: Number.isInteger(number) ? number : null,
    location: plain(property(props, 'Location', '地点')) || null, aliases,
    tags: (property(props, 'Tags', '标签')?.multi_select || []).map(item => item.name), relations, sources: [],
    createdAt: page.created_time.slice(0, 10), updatedAt: page.last_edited_time.slice(0, 10), period: null,
    reliability: plain(property(props, 'Reliability', '记录状况')) || '原始记录', archiveSource: 'Notion', media,
  });
}
const snapshot = { enabled: true, entities: output, syncedAt: new Date().toISOString() };
const destination = path.resolve('src/data/notion.json');
const temporary = destination + '.tmp';
await fs.writeFile(temporary, JSON.stringify(snapshot, null, 2));
await fs.rename(temporary, destination);
console.log(`Synchronized ${output.length} published records. Unpublished pages were excluded.`);
