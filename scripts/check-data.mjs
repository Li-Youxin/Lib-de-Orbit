import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const local = JSON.parse(await fs.readFile('src/data/archive.json', 'utf8'));
const snapshot = JSON.parse(await fs.readFile('src/data/notion.json', 'utf8'));
const entities = snapshot.enabled ? snapshot.entities : local.entities;
const ids = new Set(entities.map(e => e.id));
assert.equal(ids.size, entities.length, 'Record IDs must be unique');
for (const entity of entities) {
  assert.ok(entity.name && entity.type && entity.summary, `Incomplete record ${entity.id}`);
  for (const target of [...entity.sources, ...entity.relations.map(r => r.target)]) assert.ok(ids.has(target), `Missing target ${target} from ${entity.id}`);
  for (const image of entity.media) await fs.access(path.join('public', image));
  for (const [, href] of entity.description.matchAll(/\]\(\/entity\/([^/]+)\//g)) assert.ok(ids.has(href), `Broken text link in ${entity.id}`);
}
if (!snapshot.enabled) {
  assert.equal(entities.filter(e => e.type === 'media').length, 18);
  assert.equal(entities.find(e => e.id === 'EV-0001').year, null, 'The pneuma tide has no exact year');
  assert.equal(entities.find(e => e.name === '环流集团').relations.length, 0, 'Current aliases are not yet confirmed');
  assert.equal(entities.find(e => e.name.startsWith('望安灵核应变部门')).aliases.length, 2);
  for (const e of entities.filter(e => e.sourcePath?.includes('资料档案/') && e.status === 'legacy')) assert.ok(e.createdAt === '2026-09-12', 'Legacy source date');
}
console.log(`Validated ${entities.length} records, source links, relationships and media.`);
