export const entityTypes = ['person', 'location', 'organization', 'event', 'object', 'technology', 'infrastructure', 'project', 'system', 'document', 'media'] as const;
export type EntityType = typeof entityTypes[number];
export type RecordStatus = 'documented' | 'unknown' | 'theory' | 'early' | 'legacy' | 'partial';
export interface Relation { target: string; type: string }
export interface Entity {
  id: string;
  slug: string;
  name: string;
  nameLocal: string;
  type: EntityType;
  status: RecordStatus;
  summary: string;
  description: string;
  date: string | null;
  year: number | null;
  location: string | null;
  aliases: string[];
  tags: string[];
  relations: Relation[];
  sources: string[];
  createdAt: string;
  updatedAt: string;
  period: string | null;
  reliability: string;
  archiveSource: string;
  media: string[];
  coordinates?: { x: number; y: number };
  sourcePath?: string;
}
export interface Collection { slug: string; name: string; subtitle: string; description: string; ids: string[]; image?: string }
export interface ArchiveData { entities: Entity[]; collections: Collection[]; links: Record<string, string>; assembledAt: string }
