import { parse } from 'node-html-parser';

export const plain = property => (property?.title || property?.rich_text)?.map(item => item.plain_text ?? item.text?.content ?? '').join('') ?? property?.select?.name ?? property?.status?.name ?? '';
export const property = (properties, ...keys) => keys.map(key => properties[key]).find(Boolean);
const typeNames = { 人物:'person', 地点:'location', 组织:'organization', 事件:'event', 物件:'object', 技术:'technology', 基础设施:'infrastructure', 项目:'project', 系统:'system', 文档:'document', 媒体:'media' };
const statusNames = { 已记录:'documented', 未明:'unknown', 学说:'theory', 早期记录:'early', 旧稿候选:'legacy', 记录不全:'partial' };
export const pageKey = id => id.replaceAll('-', '').toLowerCase();

export function recordId(page) {
  const id = plain(property(page.properties, 'Archive ID')).trim() || 'NT-' + pageKey(page.id);
  if (!/^[A-Za-z][A-Za-z0-9-]{1,79}$/.test(id)) throw new Error('Invalid Archive ID; use letters, digits and hyphens.');
  return id;
}

export function normalizeMarkdown(markdown, siteUrl, pageIds, publishedIds) {
  if (typeof markdown !== 'string') throw new Error('Missing page Markdown.');
  let text = markdown.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, table => {
    const root = parse(table);
    const rows = root.querySelectorAll('tr').map(row => row.querySelectorAll('th, td').map(cell => cell.text.trim().replaceAll('|', '\\|').replace(/\r?\n/g, '<br>')));
    if (!rows.length || rows.some(row => row.length !== rows[0].length)) throw new Error('Unsupported table structure.');
    return '\n' + [rows[0], rows[0].map(() => '---'), ...rows.slice(1)].map(row => '| ' + row.join(' | ') + ' |').join('\n') + '\n';
  });
  text = text.replace(/<mention-page\b[^>]*\/?>(?:[\s\S]*?<\/mention-page>)?/gi, markup => {
    const element = parse(markup).querySelector('mention-page');
    const href = element?.getAttribute('url');
    if (!href) throw new Error('Page mention has no URL.');
    return `[${element.text.trim() || '关联记录'}](${href})`;
  }).replace(/<(?:empty-block|p)\s*\/>/gi, '\n');
  text = text.replace(/https:\/\/[^\s)<>"]+/g, url => {
    if (url.startsWith(siteUrl + '/')) return decodeURI(url.slice(siteUrl.length));
    const parsed = new URL(url);
    if (!/(^|\.)notion\.(so|site|com)$/.test(parsed.hostname)) return url;
    const match = parsed.pathname.match(/([a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12})(?:\/)?$/i);
    return match && pageIds.has(pageKey(match[1])) ? '/entity/' + pageIds.get(pageKey(match[1])) + '/' : url;
  });
  text = text.replace(/\[([^\]]+)\]\(\/entity\/([^/]+)\/\)/g, (link, label, id) => publishedIds.has(id) ? link : label);
  // Fail closed instead of silently dropping blocks the reader cannot render.
  const withoutCode = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, '');
  if (/<\/?[a-z][^>]*>/i.test(withoutCode.replace(/<br\s*\/?>/gi, ''))) throw new Error('Unsupported HTML block; convert it to ordinary headings, lists or Markdown images.');
  return text.replace(/<br\s*\/?>/gi, ' ');
}

export function toRecord(page, description, media, pageIds, publishedIds, localById) {
  const props = page.properties;
  const id = recordId(page);
  const baseline = localById[id] || {};
  const rawType = plain(property(props, 'Type', '类型')) || 'document';
  const rawStatus = plain(property(props, 'Status', '状态')) || 'documented';
  const type = typeNames[rawType] || rawType;
  const status = statusNames[rawStatus] || rawStatus;
  if (!Object.values(typeNames).includes(type) || !Object.values(statusNames).includes(status)) throw new Error(`Invalid Type or Status on ${id}.`);
  const related = property(props, 'Relations', '关联');
  if (related?.has_more) throw new Error(`Relations on ${id} exceed the inline API limit.`);
  const relations = related
    ? (related.relation || []).map(item => pageIds.get(pageKey(item.id))).filter(Boolean).map(target => ({ target, type: baseline.relations?.find(r => r.target === target)?.type || 'related_to' }))
    : (baseline.relations || []).filter(r => publishedIds.has(r.target));
  const name = plain(property(props, 'Name', '名称')) || '未命名记录';
  const number = property(props, 'Year', '年份')?.number;
  const dateProperty = property(props, 'Date', '年代');
  return {
    id, slug: baseline.slug || pageKey(page.id), name, nameLocal: name, type, status,
    summary: plain(property(props, 'Summary', '摘要')) || description.replace(/[#>*_`\n]/g, ' ').trim().slice(0, 140) || name,
    description, date: dateProperty?.date?.start || plain(dateProperty) || null, year: Number.isInteger(number) ? number : null,
    location: plain(property(props, 'Location', '地点')) || null,
    aliases: plain(property(props, 'Aliases', '别名')).split(/\n|<br\s*\/?>|[,，]/i).map(s => s.trim()).filter(Boolean),
    tags: (property(props, 'Tags', '标签')?.multi_select || []).map(item => item.name), relations,
    sources: (baseline.sources || []).filter(target => publishedIds.has(target)),
    createdAt: baseline.createdAt || page.created_time.slice(0, 10), updatedAt: page.last_edited_time.slice(0, 10), period: null,
    reliability: plain(property(props, 'Reliability', '记录状况')) || '原始记录',
    archiveSource: plain(property(props, 'Source', '来源')) || 'Notion', media,
    ...(baseline.coordinates ? { coordinates: baseline.coordinates } : {}),
    ...(baseline.sourcePath ? { sourcePath: baseline.sourcePath } : {}),
  };
}
