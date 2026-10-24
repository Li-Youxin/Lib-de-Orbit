import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { normalizeMarkdown, pageKey, recordId, toRecord } from './notion-model.mjs';

const source = JSON.parse(await fs.readFile('src/data/archive.json', 'utf8'));
const localById = Object.fromEntries(source.entities.map(e => [e.id, e]));
const text = value => ({ rich_text: [{ plain_text: value || '' }] });
const types = {person:'人物',location:'地点',organization:'组织',event:'事件',object:'物件',technology:'技术',infrastructure:'基础设施',project:'项目',system:'系统',document:'文档',media:'媒体'};
const statuses = {documented:'已记录',unknown:'未明',theory:'学说',early:'早期记录',legacy:'旧稿候选',partial:'记录不全'};
const pages = source.entities.map((e, index) => ({
  id: index.toString(16).padStart(32, '0'), created_time:'2026-10-24T00:00:00Z', last_edited_time:'2026-10-24T00:00:00Z',
  properties: { 'Archive ID':text(e.id), 名称:{title:[{plain_text:e.name}]}, 类型:{select:{name:types[e.type]}}, 状态:{select:{name:statuses[e.status]}},
    摘要:text(e.summary), 别名:text(e.aliases.join('\n')), 地点:text(e.location), 年份:{number:e.year}, 年代:text(e.date || e.period),
    标签:{multi_select:e.tags.map(name => ({name}))}, 记录状况:text(e.reliability), 来源:text(e.archiveSource) },
}));
const pageIds = new Map(pages.map(page => [pageKey(page.id), recordId(page)]));
const publishedIds = new Set(pageIds.values());

test('all 104 migrated records keep stable IDs, typed relations, provenance and map positions', () => {
  for (const [i, page] of pages.entries()) {
    const original = source.entities[i];
    const record = toRecord(page, original.description, original.media, pageIds, publishedIds, localById);
    for (const key of ['id','name','type','status','summary','year','location','aliases','tags','relations','sources','createdAt','coordinates','media']) assert.deepEqual(record[key], original[key], original.id + ': ' + key);
    assert.equal(record.date, original.date || original.period);
  }
});

test('unpublished targets disappear from relations, sources and body links', () => {
  const visible = new Set(['LC-0001']);
  const page = pages.find(p => recordId(p) === 'LC-0001');
  const record = toRecord(page, '', [], pageIds, visible, localById);
  assert.deepEqual(record.relations, []);
  assert.deepEqual(record.sources, []);
  assert.equal(normalizeMarkdown('[来源](/entity/DC-0005/)', 'https://example.org', pageIds, visible), '来源');
});

test('tables and Notion mentions become readable Markdown, own media stays local', () => {
  const url = 'https://example.org/archive';
  const page = pages.find(p => recordId(p) === 'LC-0001');
  const input = `<table><tr><td>名称</td><td>关系</td></tr><tr><td>望安</td><td>海雾</td></tr></table>\n<mention-page url="https://app.notion.com/p/${page.id}">望安</mention-page>\n![图](${url}/media/%E5%9B%BD%E5%BA%A6%E5%9C%B0%E5%9B%BE.png)`;
  const result = normalizeMarkdown(input, url, pageIds, publishedIds);
  assert.ok(result.includes('| 望安 | 海雾 |'));
  assert.ok(result.includes('[望安](/entity/LC-0001/)'));
  assert.ok(result.includes('(/media/国度地图.png)'));
});

test('new records get stable page-based IDs and bad IDs or unsupported blocks abort', () => {
  assert.equal(recordId({id:'12345678-1234-1234-1234-123456789abc',properties:{}}), 'NT-12345678123412341234123456789abc');
  assert.throws(() => recordId({id:'x',properties:{'Archive ID':text('../escape')}}));
  assert.throws(() => normalizeMarkdown('<unknown url="x"/>', '', pageIds, publishedIds));
});
