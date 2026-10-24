'use client';

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ArrowUpRight, ChevronRight, Expand, Menu, Minus, Plus, Search, X } from 'lucide-react';
import { entities, collections, entityById, searchRecords, byType, archiveDate, activeSource } from '@/lib/data';
import { archiveConfig as config, navigation, explore, statusLabels, typeLabels, relationLabels } from '@/lib/config';
import type { Entity } from '@/lib/types';
import { asset, EntityLink, FilteredTable, RecordText, Status } from './records';

const Graph = dynamic(() => import('./relation-graph'), { loading: () => <div className="graph-loading micro">LOADING RELATIONS</div>, ssr: false });
const indexTypes: Record<string, string[]> = { people:['person'], locations:['location'], organizations:['organization'], events:['event','project'], objects:['object'], systems:['system','technology','infrastructure'], documents:['document'] };

function PageHeading({ en, title, subtitle, count }: { en: string; title: string; subtitle?: string; count?: number }) {
  return <header className="page-heading"><div className="section-label">{en}{count !== undefined && <span>{String(count).padStart(2,'0')} RECORDS</span>}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</header>;
}

function Metadata({ entity }: { entity?: Entity }) {
  const currentCount = entities.filter(e => !['legacy','early'].includes(e.status)).length;
  return <aside className="context-rail"><details className="metadata" open><summary>档案信息 <ChevronRight size={15}/></summary><span className="section-label">{entity ? 'Record metadata' : 'Archive context'}</span>{entity ? <dl>
    <dt>档案编号 / ID</dt><dd className="mono">{entity.id}</dd><dt>类型 / TYPE</dt><dd>{typeLabels[entity.type]}</dd>
    <dt>状态 / STATUS</dt><dd><Status entity={entity}/></dd><dt>地点 / LOCATION</dt><dd>{entity.location || '未记载'}</dd>
    <dt>年代 / PERIOD</dt><dd>{entity.date || entity.period || '未明'}</dd><dt>来源 / SOURCE</dt><dd>{entity.archiveSource}</dd>
    <dt>记录状况 / CONDITION</dt><dd>{entity.reliability}</dd><dt>收录更新 / UPDATED</dt><dd className="mono">{entity.updatedAt.replaceAll('-','.')}</dd>
  </dl> : <><dl><dt>馆藏范围 / SCOPE</dt><dd>{config.subtitle}</dd><dt>记录总量 / RECORDS</dt><dd className="mono big-data">{entities.length}<span> / {currentCount} 当前记录</span></dd><dt>内容来源 / SOURCE</dt><dd>{activeSource}</dd><dt>索引整理 / ASSEMBLED</dt><dd className="mono">{archiveDate.slice(0,10).replaceAll('-','.')}</dd></dl><div className="rail-note"><span className="micro">COLLECTION NOTE</span><p>未明年代不作推算。早期记录与旧稿候选保留原有版本。</p><Link href="/collections/legacy/">旧稿独立馆藏 <ArrowUpRight size={12}/></Link></div><div className="rail-note"><span className="micro">RELATED COLLECTION</span><h3>事件波及其后果</h3><p>并符、回传机制与世界线偏离。</p><Link href="/collections/worldlines/">进入专题 <ArrowUpRight size={12}/></Link></div></>}
  {entity && <><div className="plain-tags">{entity.tags.map(tag => <Link key={tag} href={'/search/?q='+encodeURIComponent('tag:'+tag)}>#{tag}</Link>)}</div><div className="rail-note"><span className="micro">SOURCE RECORDS</span>{entity.sources.length ? entity.sources.map(id => <div className="rail-source" key={id}><EntityLink id={id}/></div>) : <p>本记录未附独立来源条目。</p>}</div></>}
  </details></aside>;
}

function CommandSearch({ dialog }: { dialog: React.RefObject<HTMLDialogElement | null> }) {
  const [query,setQuery] = useState('');
  const router = useRouter();
  const hits = (query ? searchRecords(query) : entities.filter(e => e.type !== 'media')).slice(0,8);
  const close = () => dialog.current?.close();
  function submit(e: FormEvent) { e.preventDefault(); close(); router.push('/search/?q='+encodeURIComponent(query)); }
  return <dialog className="command-dialog" ref={dialog} aria-labelledby="command-title" onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="command-head"><h2 id="command-title">检索档案</h2><button className="icon-button" onClick={close} title="关闭检索" aria-label="关闭检索"><X size={19}/></button></div><form className="large-search" onSubmit={submit}><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="名称、编号或关键词" aria-label="全站检索" autoFocus/><button className="icon-button" aria-label="提交检索" title="提交检索"><ArrowRight size={18}/></button></form><div className="command-results">{hits.map(e=><Link key={e.id} href={`/entity/${e.id}/`} onClick={close}><span><strong>{e.name}</strong><small>{e.summary}</small></span><span className="micro">{e.id}</span></Link>)}{!hits.length&&<p className="empty">未找到相符记录。</p>}</div><Link className="command-all" href={'/search/?q='+encodeURIComponent(query)} onClick={close}>查看全部检索结果 <ArrowRight size={15}/></Link></dialog>;
}

function ArchiveIndex() {
  const [query,setQuery] = useState('');
  const router = useRouter();
  const recent = [...entities].filter(e=>e.type!=='media'&&e.type!=='document'&&e.status!=='legacy').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,5);
  return <>
    <PageHeading en="Archive index" title="资料索引" subtitle="国度、文明与异常现象的跨领域记录。"/>
    <form className="large-search index-search" onSubmit={e=>{e.preventDefault();router.push('/search/?q='+encodeURIComponent(query));}}><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the archive" aria-label="检索全部档案"/><button className="icon-button" title="检索" aria-label="检索"><ArrowRight size={20}/></button></form>
    <div className="index-layout"><section><h2 className="section-label ruled">Index</h2><div className="category-index">{navigation.map(([url,en,cn,type],i)=>{const count=entities.filter(e=>url==='/systems'?['system','technology','infrastructure'].includes(e.type):url==='/events'?['event','project'].includes(e.type):e.type===type).length;return <Link key={url} href={url+'/'}><span className="micro index-number">{String(i+1).padStart(2,'0')}</span><span><strong>{en}</strong><small>{cn}</small></span><span className="mono index-count">{String(count).padStart(2,'0')}</span><ArrowUpRight size={14}/></Link>;})}</div></section>
    <section className="featured"><h2 className="section-label ruled">Featured collection</h2><Link className="featured-image" href="/collections/civilizations/"><img src={asset('/media/国度地图.png')} alt="地环各国政治区域图"/><span className="image-caption">MD-0001 / CARTOGRAPHIC RECORD</span></Link><Link className="feature-title" href="/collections/civilizations/"><h3>文明与国度</h3><ArrowUpRight size={17}/></Link><p>灵核潮与大陆级战争之后，联合政权逐渐呈现松动的倾向。</p><div className="mini-collection"><span className="micro">REGIONAL COLLECTION</span><Link href="/collections/wangan/">望安：海雾与城市 <ArrowUpRight size={15}/></Link><p>从空白区域到下降城区的交叉记录。</p></div></section></div>
    <section className="recent-section"><div className="section-heading"><h2 className="section-label">Recent records</h2><Link href="/search/">全部记录 <ArrowRight size={13}/></Link></div>{recent.map(e=><Link className="recent-row" key={e.id} href={`/entity/${e.id}/`}><span className="mono">{e.id}</span><span><strong>{e.name}</strong><small>{e.summary}</small></span><span className="micro">{e.updatedAt.replaceAll('-','.')}</span><ArrowUpRight size={14}/></Link>)}</section>
  </>;
}

function EntityDetail({ entity }: { entity: Entity }) {
  const relations = [...entity.relations.map(r=>({...r,incoming:false})),...entities.flatMap(e=>e.relations.filter(r=>r.target===entity.id&&r.type!=='documented_by').map(r=>({target:e.id,type:r.type,incoming:true})))];
  return <><header className="entity-heading"><span className="micro">{entity.id.replaceAll('-',' / ')} <span className="slash">/</span> {typeLabels[entity.type]}</span><h1>{entity.name}</h1>{entity.aliases.length>0&&<p className="entity-alias">{entity.aliases.join(' / ')}</p>}<p className="entity-summary">{entity.summary}</p></header>
    {entity.status==='legacy'&&<div className="document-note"><span className="micro">INDEPENDENT COLLECTION</span><p>旧稿候选。转录中的难辨与缺损标记保留，尚未并入当前设定。</p></div>}
    {entity.status==='early'&&<div className="document-note"><span className="micro">EARLY RECORD</span><p>本条保留早期稿表述，未决版本关系见相关来源。</p></div>}
    <section className="entity-body"><h2 className="section-label ruled">Overview / 记录正文</h2><RecordText body={entity.description}/></section>
    {entity.media.filter(path=>!entity.description.includes(path)).map(path=><figure key={path} className="entity-image"><img src={asset(path)} alt={entity.name+'的附图'} loading="lazy"/><figcaption>附图 / {path.split('/').pop()}</figcaption></figure>)}
    <section className="related-section"><div className="section-heading"><h2 className="section-label">Associated records</h2><Link href={'/relations/?id='+entity.id}>关系浏览 <ArrowUpRight size={13}/></Link></div>{relations.length?relations.map((r,i)=>entityById[r.target]&&<div className="relation-row" key={r.target+r.type+i}><span className="micro">{r.incoming?'反向 · ':''}{relationLabels[r.type]||r.type}</span><EntityLink id={r.target}/><span className="micro">{r.target}</span></div>):<p className="subtle">当前记录未附实体关联。</p>}</section>
  </>;
}

function SearchView() {
  const params=useSearchParams();
  const [query,setQuery]=useState(params.get('q')||'');
  const [status,setStatus]=useState('');
  const found=searchRecords(query).filter(e=>!status||e.status===status);
  const groups=[['ENTITIES',found.filter(e=>!['event','project','document','media'].includes(e.type))],['EVENTS',found.filter(e=>['event','project'].includes(e.type))],['DOCUMENTS',found.filter(e=>e.type==='document')],['MEDIA',found.filter(e=>e.type==='media')]] as [string,Entity[]][];
  return <><PageHeading en="Archive search" title="档案检索" count={found.length}/><div className="large-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="名称、编号或关键词" aria-label="检索词"/>{query&&<button className="icon-button" onClick={()=>setQuery('')} aria-label="清除检索词" title="清除检索词"><X size={17}/></button>}</div><div className="search-controls"><label>记录状态<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><span className="micro">{query?`QUERY / ${query}`:'ALL RECORDS'}</span></div>{groups.map(([label,list])=>list.length>0&&<section className="search-group" key={label}><h2 className="section-label ruled">{label}<span>{list.length}</span></h2>{list.map(e=><Link key={e.id} href={`/entity/${e.id}/`} className="search-result"><div><span className="micro">{e.id} / {typeLabels[e.type]}</span><h3>{e.name}</h3><p>{e.summary}</p></div><Status entity={e}/></Link>)}</section>)}{!found.length&&<div className="empty"><span className="micro">RECORD NOT FOUND</span><h2>未发现相符记录</h2><p>当前索引不包含此名称或筛选条件。</p></div>}</>;
}

function TimelineView() {
  const [type,setType]=useState('');const [location,setLocation]=useState('');
  const events=entities.filter(e=>['event','project'].includes(e.type)&&(!type||e.type===type)&&(!location||e.location===location));
  const dated=events.filter(e=>e.year!==null).sort((a,b)=>(a.year||0)-(b.year||0));const undated=events.filter(e=>e.year===null);
  return <><PageHeading en="Chronological records" title="时间线" subtitle="事件年代与文档收录日期分别记录。"/><div className="timeline-filters filter-bar"><label>事件类型<select value={type} onChange={e=>setType(e.target.value)}><option value="">全部</option><option value="event">事件</option><option value="project">项目</option></select></label><label>地点<select value={location} onChange={e=>setLocation(e.target.value)}><option value="">全部地点</option>{[...new Set(events.map(e=>e.location).filter(Boolean))].map(l=><option key={l} value={l!}>{l}</option>)}</select></label></div><div className="timeline">{dated.map(e=><div className="timeline-entry" key={e.id}><div className="timeline-year">{e.year}<span>{e.id==='EV-0001'?'前后 / 约略分期':''}</span></div><div><span className="micro">{typeLabels[e.type]} / {e.id}</span><h2><EntityLink id={e.id}/></h2><p>{e.summary}</p><Status entity={e}/></div></div>)}</div><section className="undated"><h2 className="section-label ruled">Date unknown / 年代未明</h2>{undated.map(e=><div className="undated-row" key={e.id}><span className="micro">{e.id}</span><div><EntityLink id={e.id}/><p>{e.summary}</p></div></div>)}{!events.length&&<p className="empty">此筛选范围暂无事件记录。</p>}</section></>;
}

function MediaView() {
  const [kind,setKind]=useState('all');
  const media=byType(['media']).filter(e=>e.media.length>0).filter(e=>kind==='all'||kind==='legacy'&&e.status==='legacy'||kind==='current'&&e.status!=='legacy');
  return <><PageHeading en="Visual archive" title="视觉资料" count={media.length}/><div className="segmented" role="group" aria-label="媒体范围">{[['all','全部影像'],['current','附图'],['legacy','旧稿扫描']].map(([v,l])=><button key={v} aria-pressed={kind===v} onClick={()=>setKind(v)}>{l}</button>)}</div><div className="media-grid">{media.map((e,i)=><Link href={`/entity/${e.id}/`} key={e.id} className={'media-item media-'+(e.tags.includes('map')?'wide':'scan')}><img loading={i<3?'eager':'lazy'} src={asset(e.media[0].replace('/media/','/media/thumbs/').replace(/\.[^.]+$/,'.webp'))} alt={e.name}/><span className="media-caption"><span className="micro">{e.id} / {e.tags[0]}</span><strong>{e.name}</strong><span>{statusLabels[e.status]}</span></span></Link>)}</div></>;
}

function CollectionsView({ slug }: { slug?: string }) {
  const collection=collections.find(c=>c.slug===slug);
  if(slug&&!collection)return <Unavailable/>;
  if(collection)return <><PageHeading en="Curated collection" title={collection.name} subtitle={collection.description} count={collection.ids.length}/>{collection.image&&<figure className="collection-image"><img src={asset(collection.image)} alt={collection.name}/></figure>}<FilteredTable records={collection.ids.map(id=>entityById[id]).filter(Boolean)}/></>;
  return <><PageHeading en="Collections" title="馆藏专题" subtitle="围绕地区、现象与历史组织的跨类型记录。"/><div className="collections-list">{collections.map((c,i)=><Link href={`/collections/${c.slug}/`} className="collection-row" key={c.slug}><span className="micro">COLLECTION {String(i+1).padStart(2,'0')}</span><div><span className="section-label">{c.subtitle}</span><h2>{c.name}</h2><p>{c.description}</p></div><span className="micro">{c.ids.length} RECORDS</span><ArrowUpRight size={19}/></Link>)}</div></>;
}

function RelationsView() {
  const params=useSearchParams();
  const [center,setCenter]=useState(entityById[params.get('id')||'']?params.get('id')!:entityById['LC-0001']?'LC-0001':entities[0]?.id||'');
  const [depth,setDepth]=useState(1);const [sources,setSources]=useState(false);
  return <><PageHeading en="Relations explorer" title="关系浏览" subtitle="当前实体及其相邻记录。"/><div className="graph-tools"><label>中心实体<select value={center} onChange={e=>setCenter(e.target.value)}>{entities.filter(e=>e.type!=='media').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><div className="segmented" role="group" aria-label="关系深度">{[1,2].map(d=><button key={d} aria-pressed={depth===d} onClick={()=>setDepth(d)}>{d} 阶关系</button>)}</div><label className="checkbox-label"><input type="checkbox" checked={sources} onChange={e=>setSources(e.target.checked)}/>来源记录</label></div><Graph center={center} depth={depth} includeSources={sources} onSelect={setCenter}/><div className="graph-detail"><span className="micro">{center}</span><h2><EntityLink id={center}/></h2><p>{entityById[center]?.summary}</p></div></>;
}

function MapView() {
  const [mode,setMode]=useState('location');const [period,setPeriod]=useState('all');const [zoom,setZoom]=useState(1);const [selected,setSelected]=useState('LC-0011');
  function position(e: Entity): Entity['coordinates'] {
    if(e.coordinates)return e.coordinates;
    const parent=entities.find(p=>p.name===e.location&&p.coordinates);
    if(parent)return parent.coordinates;
    const region=entityById[e.relations.find(r=>r.type==='located_in')?.target||''];
    return region?.coordinates;
  }
  const items=entities.filter(e=>(mode==='location'?e.type==='location':mode==='event'?['event','project'].includes(e.type):e.type==='infrastructure')&&(period==='all'||e.year===null||e.year>=1800));
  return <><PageHeading en="Cartographic records" title="区域地图" subtitle="依据已收录的国度图，定位区域关联记录。"/><div className="map-tools"><div className="segmented" aria-label="地图记录类型">{[['location','地点'],['event','事件'],['infrastructure','基础设施']].map(([v,l])=><button key={v} aria-pressed={mode===v} onClick={()=>setMode(v)}>{l}</button>)}</div><label>时间范围<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">所有年代</option><option value="modern">和睦时代及年代未明</option></select></label><div className="zoom-tools"><button className="icon-button" title="缩小地图" aria-label="缩小地图" onClick={()=>setZoom(Math.max(1,zoom-.25))} disabled={zoom===1}><Minus size={16}/></button><span className="micro">{Math.round(zoom*100)}%</span><button className="icon-button" title="放大地图" aria-label="放大地图" onClick={()=>setZoom(Math.min(2,zoom+.25))} disabled={zoom===2}><Plus size={16}/></button></div></div><div className="map-stage"><div className="map-canvas" style={{width:`${zoom*100}%`}}><img src={asset('/media/国度地图.png')} alt="地环政治区域原图"/>{items.filter(e=>position(e)).map((e,i)=>{const p=position(e)!;return <button className={'map-point '+(selected===e.id?'selected':'')} style={{left:p.x+'%',top:p.y+'%',zIndex:selected===e.id?3:1}} key={e.id} title={`${e.name} · ${statusLabels[e.status]}`} aria-label={`查看${e.name}`} onClick={()=>setSelected(e.id)}><span>{mode==='location'?'○':mode==='event'?'△':'□'}</span><span className="map-point-label">{e.name}</span><span className="sr-only">{i+1}</span></button>;})}</div></div><div className="map-caption"><span>MD-0001 / 国度地图</span><a href={asset('/media/国度地图.png')} target="_blank" rel="noreferrer"><Expand size={13}/>查看原图</a></div><p className="subtle map-note">标记对应原图地名位置或相关国家区域，并非测绘坐标。未明状态与未定位记录保留在索引中。</p>{entityById[selected]&&<div className="map-selection"><span className="micro">SELECTED / {selected}</span><h2><EntityLink id={selected}/></h2><p>{entityById[selected].summary}</p></div>}<details className="unplaced"><summary>未定位记录 <span className="mono">{items.filter(e=>!position(e)).length}</span></summary>{items.filter(e=>!position(e)).map(e=><div key={e.id}><EntityLink id={e.id}/><span className="micro">UNKNOWN POSITION</span></div>)}</details></>;
}

function Unavailable(){return <div className="empty"><span className="micro">RECORD NOT FOUND</span><h1>记录未找到</h1><p>当前索引中不存在相符条目。</p><Link href="/">返回资料索引</Link></div>;}

export function ArchiveApp({ path }: { path: string }) {
  const [menu,setMenu]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const segment=path.split('/').filter(Boolean);
  const entity=segment[0]==='entity'?entityById[segment[1]]:undefined;
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(e.key==='Escape')setMenu(false);if((e.key==='/'&&!target.closest('input,textarea,select,[contenteditable]'))||((e.ctrlKey||e.metaKey)&&e.key==='k')){e.preventDefault();dialog.current?.showModal();}};
    document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);
  },[]);
  const label=entity?.name||navigation.find(n=>n[0]===path)?.[2]||explore.find(n=>n[0]===path)?.[2]||({'search':'检索','about':'关于资料库','system':'系统记录'}[segment[0] as 'search'])||'资料索引';
  let body: React.ReactNode;
  if(path==='/')body=<ArchiveIndex/>;
  else if(entity)body=<EntityDetail entity={entity}/>;
  else if(segment[0]==='entity')body=<Unavailable/>;
  else if(indexTypes[segment[0]]){const nav=navigation.find(n=>n[0]===path)!;const items=byType(indexTypes[segment[0]]);body=<><PageHeading en={nav[1]+' index'} title={nav[2]} count={items.length}/><FilteredTable records={items}/></>;}
  else if(segment[0]==='search')body=<Suspense fallback={<p>读取索引…</p>}><SearchView/></Suspense>;
  else if(segment[0]==='timeline')body=<TimelineView/>;
  else if(segment[0]==='media')body=<MediaView/>;
  else if(segment[0]==='collections')body=<CollectionsView slug={segment[1]}/>;
  else if(segment[0]==='relations')body=<Suspense fallback={<p>读取关联…</p>}><RelationsView/></Suspense>;
  else if(segment[0]==='map')body=<MapView/>;
  else if(segment[0]==='about')body=<><PageHeading en="About the archive" title="关于资料库"/><RecordText body={'本馆藏收录地环的国度、组织、文明、异常现象及相关原始记录。\n\n原始记录中的学说、推论和未定项保留其原有性质。旧稿候选作为独立馆藏，不自动纳入当前设定。\n\n档案编号为资料库的检索标识，不表示世界内的机构编号。\n\n记录年代与收录日期分别显示；未知信息保持未明。'}/></>;
  else if(segment[0]==='system')body=<><PageHeading en="System record" title="索引状态"/><dl className="system-data"><dt>内容来源</dt><dd>{activeSource}</dd><dt>记录总量</dt><dd>{entities.length}</dd><dt>关联总量</dt><dd>{entities.reduce((sum,e)=>sum+e.relations.length,0)}</dd><dt>索引整理</dt><dd>{archiveDate}</dd><dt>内容状态</dt><dd>已记录 / 学说 / 未明 / 早期记录 / 旧稿候选</dd></dl></>;
  else body=<Unavailable/>;
  return <><a className="skip-link" href="#main-content">跳至内容</a><div className="archive-shell"><aside className={'archive-sidebar '+(menu?'open':'')}><Link className="brand" href="/" onClick={()=>setMenu(false)}>{config.name}<span>{config.title}</span></Link><button className="sidebar-search" onClick={()=>dialog.current?.showModal()}><Search size={16}/><span>检索档案</span><span className="mono">/</span></button><nav aria-label="主导航"><div className="nav-label">Index</div><Link className={'nav-item '+(path==='/'?'active':'')} href="/" onClick={()=>setMenu(false)}><span>Archive index</span><small>总览</small></Link>{navigation.map(([url,en,cn])=><Link className={'nav-item '+(path===url?'active':'')} href={url+'/'} key={url} onClick={()=>setMenu(false)}><span>{en}</span><small>{cn}</small></Link>)}<div className="nav-label explore-label">Explore</div>{explore.map(([url,en,cn])=><Link className={'nav-item '+(path.startsWith(url)?'active':'')} href={url+'/'} key={url} onClick={()=>setMenu(false)}><span>{en}</span><small>{cn}</small></Link>)}</nav><div className="sidebar-bottom"><Link href="/about/">About <span>关于</span></Link><Link href="/system/">System <span>系统记录</span></Link><p className="micro">ORBIS / TERRARUM</p></div></aside>
    {menu&&<button className="menu-scrim" onClick={()=>setMenu(false)} aria-label="关闭目录"/>}<div className="archive-main"><header className="archive-topbar"><button className="icon-button mobile-menu" onClick={()=>setMenu(!menu)} aria-label="切换导航" title="切换导航"><Menu size={20}/></button><nav className="breadcrumb" aria-label="面包屑"><Link href="/">Archive</Link><ChevronRight size={12}/>{entity?<><Link href={(navigation.find(n=>n[3]===entity.type)?.[0]||'/systems')+'/'}>{typeLabels[entity.type]}</Link><ChevronRight size={12}/><span>{entity.id}</span></>:<span>{label}</span>}</nav><span className="node-label mono">{config.subtitle}</span><button className="icon-button" onClick={()=>dialog.current?.showModal()} aria-label="打开检索" title="打开检索"><Search size={16}/></button></header><div className={'content-grid '+(['map','relations','media'].includes(segment[0])?'wide-view':'')}><main id="main-content" className="page-content">{body}<footer className="archive-footer"><span>{config.name} / {config.subtitle}</span><span>记录的边界，也是未知的入口。</span></footer></main><Metadata entity={entity}/></div></div></div><CommandSearch dialog={dialog}/></>;
}
