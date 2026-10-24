export const archiveConfig = {
  name: 'ARCHIVE',
  title: '地环公共资料库',
  subtitle: 'Orbis / terrarum',
  node: '地环 / 表层记录',
  description: '国度、文明与异常现象的跨领域资料索引。',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
export const typeLabels: Record<string, string> = {
  person: '人物', location: '地点', organization: '组织', event: '事件', object: '物件', technology: '技术', infrastructure: '基础设施', project: '项目', system: '系统', document: '文档', media: '媒体',
};
export const statusLabels: Record<string, string> = {
  documented: '已记录', unknown: '未明', theory: '学说', early: '早期记录', legacy: '旧稿候选', partial: '部分可读',
};
export const relationLabels: Record<string, string> = {
  located_in: '位于', affected_by: '受影响于', related_to: '关联', documented_by: '记载于', caused: '导致', member_of: '属于', created: '创造', participated_in: '参与', works_at: '任职于', recovered: '发现',
};
export const navigation = [
  ['/people', 'People', '人物', 'person'], ['/locations', 'Locations', '地点', 'location'],
  ['/organizations', 'Organizations', '组织', 'organization'], ['/events', 'Events', '事件', 'event'],
  ['/objects', 'Objects', '物件', 'object'], ['/systems', 'Systems', '系统与技术', 'system'],
  ['/documents', 'Documents', '文档', 'document'], ['/media', 'Media', '媒体', 'media'],
] as const;
export const explore = [['/timeline', 'Timeline', '时间线'], ['/map', 'Map', '地图'], ['/relations', 'Relations', '关系'], ['/collections', 'Collections', '馆藏']] as const;
