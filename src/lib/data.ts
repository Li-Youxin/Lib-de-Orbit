import source from '@/data/archive.json';
import notion from '@/data/notion.json';
import type { ArchiveData, Entity } from './types';

const local = source as ArchiveData;
const synced = notion as { enabled: boolean; entities: Entity[]; syncedAt: string | null };
export const entities: Entity[] = synced.enabled ? synced.entities : local.entities;
export const entityById = Object.fromEntries(entities.map(entity => [entity.id, entity]));
export const collections = [
  ...local.collections.map(collection => ({ ...collection, ids: notion.enabled
    ? entities.filter(entity => collection.ids.includes(entity.id)).map(entity => entity.id)
    : collection.ids.filter(id => entityById[id]) })),
  ...(notion.enabled ? [...new Set(entities.flatMap(entity => entity.tags))].sort().map((tag, index) => ({
    slug: 'tag-' + index, name: tag, subtitle: 'Notion collection',
    description: '', ids: entities.filter(entity => entity.tags.includes(tag)).map(entity => entity.id), image: undefined,
  })) : []),
];
export const archiveDate = notion.syncedAt || local.assembledAt;
export const activeSource = notion.enabled ? 'Notion' : '本地馆藏';
export const byType = (types: string[]) => entities.filter(entity => types.includes(entity.type));
export function neighbors(id: string, depth = 1) {
  const ids = new Set([id]);
  for (let step = 0; step < depth; step++) {
    const current = new Set(ids);
    for (const entity of entities) {
      for (const relation of entity.relations) {
        if (current.has(entity.id) || current.has(relation.target)) {
          ids.add(entity.id); ids.add(relation.target);
        }
      }
    }
  }
  return entities.filter(entity => ids.has(entity.id));
}
export function searchRecords(query: string) {
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return entities.filter(entity => tokens.every(token => {
    const split = token.indexOf(':');
    if (split > 0) {
      const field = token.slice(0, split).toLowerCase();
      const value = token.slice(split + 1).replaceAll('"', '').toLowerCase();
      const fields: Record<string, string> = { type: entity.type, status: entity.status, year: String(entity.year ?? ''), location: entity.location || '', tag: entity.tags.join(' ') };
      if (field in fields) return fields[field].toLowerCase().includes(value);
    }
    return [entity.name, entity.id, entity.summary, ...entity.aliases, ...entity.tags, entity.description].join(' ').toLowerCase().includes(token.replaceAll('"', '').toLowerCase());
  }));
}
