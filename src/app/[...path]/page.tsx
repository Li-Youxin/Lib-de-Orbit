import { ArchiveApp } from '@/components/archive-app';
import { entities, collections } from '@/lib/data';

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    ...['search', 'people', 'locations', 'organizations', 'events', 'objects', 'systems', 'documents', 'media', 'timeline', 'map', 'relations', 'collections', 'about', 'system'].map(path => ({ path: [path] })),
    ...entities.map(entity => ({ path: ['entity', entity.id] })),
    ...collections.map(collection => ({ path: ['collections', collection.slug] })),
  ];
}
export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return <ArchiveApp path={'/' + path.join('/')} />;
}
