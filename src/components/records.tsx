'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search, SlidersHorizontal, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Entity } from '@/lib/types';
import { archiveConfig, statusLabels, typeLabels } from '@/lib/config';
import { entityById } from '@/lib/data';

export function Status({ entity }: { entity: Entity }) {
  return <span className={`record-status status-${entity.status}`}>{statusLabels[entity.status] || entity.status}</span>;
}
export function EntityLink({ id, children }: { id: string; children?: React.ReactNode }) {
  const entity = entityById[id];
  if (!entity) return <span>{children || id}</span>;
  return <span className="entity-link"><Link href={`/entity/${id}/`}>{children || entity.name}</Link><span className="link-preview" role="tooltip"><span className="micro">{entity.id} / {typeLabels[entity.type]}</span><strong>{entity.name}</strong><span>{entity.summary}</span></span></span>;
}
export function RecordText({ body }: { body: string }) {
  return <div className="record-prose"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => {
      if (href?.startsWith('/entity/')) return <EntityLink id={href.split('/')[2]}>{children}</EntityLink>;
      return <a href={href?.startsWith('/') ? asset(href) : href} target={href?.startsWith('https:') ? '_blank' : undefined} rel="noreferrer">{children}</a>;
    },
    img: ({ src, alt }) => <a href={asset(String(src))} target="_blank" rel="noreferrer"><img loading="lazy" src={asset(String(src))} alt={alt || '档案附图'} /></a>,
    table: ({ children }) => <div className="prose-table"><table>{children}</table></div>,
  }}>{body}</ReactMarkdown></div>;
}
export const asset = (path: string) => path.startsWith('/') ? archiveConfig.basePath + path : path;

export function FilteredTable({ records, initialType = '' }: { records: Entity[]; initialType?: string }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState(initialType);
  const [year, setYear] = useState('');
  const [location, setLocation] = useState('');
  const [tag, setTag] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<keyof Entity>('name');
  const [direction, setDirection] = useState(1);
  const options = (key: 'status' | 'type' | 'location') => [...new Set(records.map(entity => entity[key]).filter(Boolean))].sort() as string[];
  const years = [...new Set(records.map(e => e.year).filter(y => y !== null))].sort();
  const tags = [...new Set(records.flatMap(e => e.tags))].sort();
  const filtered = useMemo(() => records.filter(entity =>
    (!query || [entity.name, entity.id, entity.summary, ...entity.aliases].join(' ').toLowerCase().includes(query.toLowerCase())) &&
    (!status || entity.status === status) && (!type || entity.type === type) &&
    (!year || String(entity.year) === year) && (!location || entity.location === location) && (!tag || entity.tags.includes(tag)),
  ).sort((a, b) => direction * String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), 'zh-CN', { numeric: true })), [records, query, status, type, year, location, tag, sort, direction]);
  function changeSort(key: keyof Entity) { if (sort === key) setDirection(-direction); else { setSort(key); setDirection(1); } }
  function reset() { setQuery(''); setStatus(''); setType(initialType); setYear(''); setLocation(''); setTag(''); }
  return <section aria-label="档案列表">
    <div className="table-tools"><label className="inline-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="在此索引内查找" aria-label="在此索引内查找" /></label><span className="micro tool-count">{filtered.length} RECORDS</span><button className={'tool-button '+(expanded ? 'selected' : '')} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><SlidersHorizontal size={15}/>筛选</button></div>
    {expanded && <div className="filter-bar">
      <label>类型<select value={type} onChange={e => setType(e.target.value)}><option value="">全部类型</option>{options('type').map(v => <option key={v} value={v}>{typeLabels[v]}</option>)}</select></label>
      <label>状态<select value={status} onChange={e => setStatus(e.target.value)}><option value="">全部状态</option>{options('status').map(v => <option key={v} value={v}>{statusLabels[v]}</option>)}</select></label>
      <label>年代<select value={year} onChange={e => setYear(e.target.value)}><option value="">全部年代</option>{years.map(y => <option key={y} value={String(y)}>{y}</option>)}</select></label>
      <label>地点<select value={location} onChange={e => setLocation(e.target.value)}><option value="">全部地点</option>{options('location').map(v => <option key={v}>{v}</option>)}</select></label>
      <label>主题<select value={tag} onChange={e => setTag(e.target.value)}><option value="">全部主题</option>{tags.map(v => <option key={v}>{v}</option>)}</select></label>
      <button className="icon-button" onClick={reset} title="清除筛选" aria-label="清除筛选"><X size={16}/></button>
    </div>}
    <div className="table-scroll"><table className="entity-table"><thead><tr>{([['id','档案编号'],['name','名称'],['type','类型'],['year','年代'],['status','状态'],['location','地点']] as [keyof Entity,string][]).map(([key,label]) => <th key={key} aria-sort={sort === key ? direction === 1 ? 'ascending' : 'descending' : 'none'}><button onClick={() => changeSort(key)}>{label}{sort === key && (direction === 1 ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</button></th>)}</tr></thead><tbody>{filtered.map(entity => <tr key={entity.id} onClick={e => { if (!(e.target as HTMLElement).closest('a')) e.currentTarget.querySelector('a')?.click(); }}><td className="mono record-id">{entity.id}</td><td className="record-name"><Link href={`/entity/${entity.id}/`}>{entity.name}</Link><span>{entity.aliases[0] || entity.summary}</span></td><td>{typeLabels[entity.type]}</td><td className="mono">{entity.year ?? '—'}</td><td><Status entity={entity}/></td><td>{entity.location || '—'}</td></tr>)}</tbody></table></div>
    {!filtered.length && <div className="empty"><span className="micro">NO MATCHING RECORDS</span><h3>没有相符记录</h3><p>当前索引中未找到符合筛选条件的档案。</p><button className="text-button" onClick={reset}>清除筛选</button></div>}
    <div className="table-end micro">{filtered.length ? `END OF INDEX / ${filtered.length} RECORDS` : 'INDEX EMPTY'}</div>
  </section>;
}
