"""Convert the existing authored corpus to the archive's typed record dataset."""

import json
import re
import shutil
from pathlib import Path
from urllib.parse import unquote

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parent
CORPUS = ROOT / 'wiki' / 'notion-designed'
PUBLIC = PROJECT / 'public' / 'media'
PUBLIC.mkdir(parents=True, exist_ok=True)
OUT = PROJECT / 'src' / 'data'
OUT.mkdir(parents=True, exist_ok=True)
records = []
links = {}


def add(id, name, type, summary, description='', **extras):
    item = dict(id=id, slug=id.lower(), name=name, nameLocal=name, type=type,
                status='documented', summary=summary, description=description or summary,
                date=None, year=None, location=None, aliases=[], tags=['地环'], relations=[], sources=[],
                createdAt='2026-07-02', updatedAt='2026-07-02', period=None,
                reliability='原始记录', archiveSource='表层资料汇编', media=[])
    item.update(extras)
    records.append(item)
    return item


def prose(path):
    raw = path.read_text(encoding='utf-8')
    body = re.sub(r'\A# [^\n]+\n+', '', raw)
    return body


page_config = {
    '世界结构': ('SY-0001', 'system'), '文明沿革': ('SY-0002', 'system'),
    '世界线与灵核病': ('SY-0003', 'system'), '天灾': ('SY-0004', 'system'),
    '灵核与技术': ('TC-0001', 'technology'), '和睦时代诸国': ('DC-0015', 'document'),
    '组织与势力': ('DC-0016', 'document'), '望安': ('LC-0001', 'location'),
    '待定事项': ('DC-0017', 'document'), '旧稿候选库': ('DC-0018', 'document'),
    '资料索引': ('DC-0019', 'document'),
}
countries = ['阿黛莱达','秋津','谙善','安谛','亚平宁','爱若妮卡','独立城邦联合体','洋流城','海穆','衡','希尔兰','和宁','伊莎贝拉','塔尔培恩','南娜','叶调','卢塞尼亚','苏瓦松','先锋']
for index, name in enumerate(countries, 2):
    page_config[name] = (f'LC-{index:04}', 'location')

archive_paths = sorted((CORPUS / '地环' / '资料档案').glob('*.md'))
for i, path in enumerate(archive_paths, 1):
    id = f'DC-{i:04}'
    body = prose(path)
    first = body.split('\n\n')[0]
    source_status = first.removeprefix('> ').split('。')[0]
    is_old = source_status == '旧稿候选'
    is_early = source_status == '早期／待定'
    title = path.stem
    record = add(id, title, 'document', '旧稿独立转录，供选择与核对。' if is_old else '保留原始表述及整理注的来源记录。', body,
                 status='legacy' if is_old else 'early' if is_early else 'documented',
                 tags=['旧稿候选'] if is_old else ['早期概念'] if is_early else ['来源记录'],
                 reliability='部分字词待复核' if '[难辨' in body else '原始记录',
                 createdAt='2026-09-12' if is_old else '2026-06-28' if is_early else '2026-07-02',
                 updatedAt='2026-09-12' if is_old else '2026-06-28' if is_early else '2026-07-02')
    if '海雾' in title:
        record['updatedAt'] = record['createdAt'] = '2026-09-12'
    links[str(path.relative_to(CORPUS)).replace('\\', '/')] = id

for path in (CORPUS / '地环').glob('*.md'):
    name = path.stem
    id, type = page_config[name]
    body = prose(path)
    summary = body.split('\n\n')[0]
    description = body.split('\n\n---\n\n', 1)[-1]
    description = re.split(r'\n---\n\n\*\*相关条目\*\*|\n---\n\n\[地环\]', description)[0].strip()
    status = 'early' if name == '灵核与技术' else 'legacy' if name == '旧稿候选库' else 'unknown' if name == '待定事项' else 'documented'
    source_titles = re.findall(r'\]\(资料档案/([^)]*)\.md\)', body)
    source_ids = [links['地环/资料档案/'+s+'.md'] for s in source_titles]
    record = add(id, name, type, summary, description, status=status, sources=source_ids,
                 aliases=[summary] if name in countries else [],
                 updatedAt='2026-09-12' if name in ['望安', '天灾'] else '2026-06-28' if status == 'early' else '2026-07-02')
    if name in countries:
        paragraphs = [p for p in description.split('\n\n') if p and not p.startswith(('#','-','>'))]
        record['summary'] = next((p for p in paragraphs if any(w in p for w in ['国家','政权','殖民地','城邦','割据'])), paragraphs[0])
    if name == '望安':
        record.update(location='衡', aliases=['Wang’an', 'Wangan'], tags=['望安', '城市', '海雾'])
    if name in ['望安', '天灾']:
        record['description'] = re.sub(r'，参考《新世纪福音战士》（EVA）中的城市机制', '', record['description'])
        record['description'] = record['description'].replace('，类似“后室”', '')
    links['地环/'+name+'.md'] = id

by_name = {r['name']: r['id'] for r in records if r['id'] not in [links['地环/资料档案/'+p.stem+'.md'] for p in archive_paths]}
def ref(name):
    return by_name[name]

add('LC-0021', '朝歌', 'location', '衡国东部地区的主要城市。',
    '朝歌特别市下列出彰义区，以及天宫苑、知椿里、蓟兰桥、安鹤桥南、流芳、砂河、绫净胡同、夕途城、琉璃台。',
    location='衡', aliases=['Chaoge'], relations=[{'target':ref('衡'),'type':'located_in'}], sources=[ref('组织与势力')])
by_name['朝歌'] = 'LC-0021'
add('LC-0022', '黍离', 'location', '衡国南部地区的主要地名。', '衡国南部以黍离为主，与东部、西部地区之间存在一定程度的分离现象。已列出行政层级为黍离道。', location='衡', aliases=['Shuli'], sources=[ref('衡')], relations=[{'target':ref('衡'),'type':'located_in'}])
add('LC-0023', '繁荣西', 'location', '望安的行政中心与经济中心。', '繁荣西位于南三环东路，辖区内包含商贸省行政中心与诸多巨头企业总部。建筑采用富有棱角的白色切割金属外壳，以适应下降城区的特性。',location='望安', sources=[ref('望安')],relations=[{'target':ref('望安'),'type':'located_in'}])
add('LC-0024', '道破', 'location', '望安采用下沉建筑机制的核心区域之一。', location='望安', sources=[ref('望安')],relations=[{'target':ref('望安'),'type':'located_in'}])
for name in ['黍离','繁荣西','道破']:
    by_name[name] = next(r['id'] for r in records if r['name']==name)

org_text = (ROOT / 'inbox/2026-07-02-harmonious-age-civilizations-organizations.md').read_text(encoding='utf-8').split('## 组织、势力与实体')[1].split('## 地图记录')[0]
region = ''
for line in org_text.splitlines():
    if line.startswith('### '):
        region = line[4:].replace('地区', '')
    if line.startswith('- '):
        bits = re.split(r'\s*/\s*', line[2:])
        name, aliases = bits[0], bits[1:]
        loc = region
        add(f'OR-{sum(r["type"]=="organization" for r in records)+1:04}', name, 'organization', f'{region}地区的组织、势力或实体。',
            location=region, aliases=aliases, sources=[ref('组织与势力')],
            relations=[{'target':ref(loc),'type':'located_in'}] if loc in by_name else [], reliability='已记录名称；详细职能未收录')

extras = [
 ('IN-0001','世界树','infrastructure','中央岛屿上的区段运行中枢。','驱动当前区段正常自转与运作的重要中枢。世界树为暂用名称。','documented','SY-0001'),
 ('IN-0002','环世界','infrastructure','围绕不完全戴森球的分段环形世界。','类似甜甜圈的形状，区段绕环的切线方向轴自转，从而产生昼夜。','documented','SY-0001'),
 ('IN-0003','下降城区','infrastructure','望安应对海雾灾变的城市设施。','繁荣西、道破等核心区域的重要建筑能够下沉至地底，外立面包含大块白色钢板与数字编号。','documented','LC-0001'),
 ('PJ-0001','事件波计划','project','并符前文明利用孪生宇宙开展的计划。','通过本初世界线中的时空穿越行为制造分支与悖论。具体目标、执行方法与设计者意图尚未展开。','documented','SY-0003'),
 ('SY-0005','悖论子深度','system','与祖辈回传繁衍相关的个体特性。','祖辈每发生一次回传繁衍，悖论子深度增强；与灵核易感程度呈正相关。','documented','SY-0003'),
 ('SY-0006','消解世界线','system','为事件平衡而使对应个体消解的世界线学说。','又称平衡世界线。连续形态或分支形态尚未确定。灵核来自消解个体灵魂碎片的说法为该学说的解释。','theory','SY-0003'),
 ('SY-0007','爱丽源文明','system','创造灵核与环世界、最终选择飞升的源文明。','Agnes 与时间、空间、灵核及宇宙存在的基础性质相关，是神灵般的存在。','documented','SY-0002'),
 ('SY-0008','并符前文明','system','探索环世界结构并留下遗产的前文明。','Bifröst 系统探索当前区段的地理和内部机械结构，并前往其他区段，最后覆灭。现文明为其生物实验和融合之后的子嗣。','documented','SY-0002'),
 ('SY-0009','启明','system','与地环相似但已彻底崩溃的孪生文明。','Eridu 的世界已经彻底崩溃，沦为无意义。','documented','SY-0002'),
 ('SY-0010','灵核','system','地环的基础性质之一。','源文明创造了灵核并以之驱动环世界；后续记录中的消解世界线学说，则将灵核解释为对应个体的灵魂碎片。两种说法的关系尚未确定。','documented','SY-0003'),
 ('OB-0001','灵核抑制剂','object','对个体自身灵核浓度进行抑制的药物。','早期稿中，气动株式会社开发相关药物。其抑制脑功能的原理存在明显副作用，部分临床事件反而导致灵核过载。','early','TC-0001'),
 ('OB-0002','辅脑芯片','object','灵若开发的活体金属芯片。','早期稿中，以降低左脑运算量的方式降低周围灵核浓度，主要在塔尔培恩内部大量植入。','early','TC-0001'),
 ('OB-0003','灵核防护服','object','用于短时进入高浓度区域的防护套装。','早期稿防护服段落尚未完成。','early','TC-0001'),
 ('TC-0002','黑泽测度','technology','测量灵核浓度的方法。','早期稿提出 1–10 的量表及射电管测量方法，方法本身仍待确定；后续记录沿用黑泽测度作为灵核浓度的称呼。','early','TC-0001'),
 ('EV-0001','灵核潮','event','大规模移动性灵核团现象。','十八世纪后叶至十九世纪前叶的灵核潮之后，进入被称为和睦时代的年代。', 'documented','DC-0015'),
 ('EV-0002','望安海雾','event','望安地区的天灾表现。','空白区域（void）覆盖范围内的大部分物体直接消失。进入者的体验表现为记忆场所中的无限重复空间。', 'documented','LC-0001'),
 ('EV-0003','安谛反应堆泄漏','event','安谛空间畸变型灵核反应堆泄漏事故。','早期稿记载：1900 年，安谛研发超大规模空间畸变型灵核发电反应堆，因泄漏事故放弃后续进程。脚注称“蔓铁锈带”。','early','TC-0001'),
 ('PR-0001','黑泽·多洛莉丝','person','早期文稿中黑泽测度的提出者。','脚注亦写作 Doriathy Haze，称其为希尔兰科学家。英文名与中文译名尚未统一。','early','TC-0001'),
 ('PR-0002','娜库斯托','person','早期文稿中关于“现代”分期观点的提出者。','其观点认为，现代始于大坠落后，由考古学与灵核学共同进步而开启的和睦时代。','early','TC-0001'),
 ('PR-0003','Cons.Trice','person','早期文稿所见署名。','署名见于《世界观——表层及其他》的早期文稿。是否对应世界内人物尚未明确。','early','TC-0001'),
]
for id,name,type,summary,description,status,source in extras:
    add(id,name,type,summary,description,status=status,sources=[source],tags=['早期概念'] if status=='early' else ['地环'],updatedAt='2026-06-28' if status=='early' else '2026-09-12' if id in ['IN-0003','EV-0002'] else '2026-07-02')

next(r for r in records if r['id']=='EV-0001').update(date='十八世纪后叶至十九世纪前叶',period='和睦时代开始之前')
next(r for r in records if r['id']=='EV-0003').update(year=1900,date='1900',location='安谛',period='和睦时代')
add('EV-0004','和睦时代开始','event','地环文明进入灵核潮之后的时代。','和睦时代被定义为 1800 至今的年代。',year=1800,date='1800',period='和睦时代',sources=['DC-0015'])
relationships = {
 'LC-0001':[('LC-0011','located_in'),('EV-0002','affected_by'),('IN-0003','related_to')],
 'PJ-0001':[('SY-0008','related_to'),('SY-0005','caused'),('SY-0003','related_to')],
 'EV-0002':[('LC-0001','located_in'),('SY-0004','related_to'),('IN-0003','related_to')],
 'IN-0003':[('LC-0001','located_in'),('EV-0002','affected_by'),('LC-0023','related_to'),('LC-0024','related_to')],
 'IN-0001':[('IN-0002','related_to')], 'SY-0007':[('IN-0002','created'),('SY-0010','created')],
 'SY-0005':[('PJ-0001','related_to'),('SY-0003','related_to')],
 'SY-0006':[('SY-0003','related_to'),('SY-0010','related_to')],
 'SY-0008':[('PJ-0001','related_to'),('IN-0002','related_to')],
}
for record in records:
    record['relations'] += [dict(target=target,type=type) for target,type in relationships.get(record['id'],[])]

image_specs = [
 ('国度地图.png', ROOT/'inbox/assets/2026-07-02-nations-map.png', '地环国度地图', 'map', 'documented'),
 ('世界线形态.jpg', ROOT/'inbox/assets/2026-07-02-worldline-forms.jpg', '世界线连续与分支形态', 'diagram', 'documented'),
 ('世界线笔记.jpg', ROOT/'inbox/assets/2026-09-12-worldline-note-context.jpg', '世界线机制笔记截图', 'screenshot', 'documented'),
]
for img in sorted((ROOT/'legacy/2021-old-settings-selection/sources').glob('*.jpg')):
    image_specs.append((img.name,img,'旧稿扫描 · '+img.stem[-6:],'scan','legacy'))
for i,(filename,source,title,kind,status) in enumerate(image_specs,1):
    shutil.copy2(source,PUBLIC/filename)
    path='/media/'+filename
    add(f'MD-{i:04}',title,'media','旧稿影像，供核对转录。' if status=='legacy' else '资料记录附图。',
        f'![{title}]({path})',status=status,tags=[kind,'旧稿候选' if status=='legacy' else '附图'],media=[path],
        updatedAt='2026-09-12' if status=='legacy' or i==3 else '2026-07-02',archiveSource=source.name)
next(r for r in records if r['id']=='DC-0015')['media']=['/media/国度地图.png']
next(r for r in records if r['id']=='SY-0003')['media']=['/media/世界线形态.jpg']

# Coordinates identify the labels on the supplied map, not geographic coordinates.
positions = {'南娜':(10,10),'安谛':(30,17),'爱若妮卡':(67,18),'阿黛莱达':(81,26),'叶调':(89,60),'海穆':(16,26),'先锋':(19,34),'卢塞尼亚':(28,25),'独立城邦联合体':(29,30),'苏瓦松':(29,38),'亚平宁':(16,44),'希尔兰':(17,54),'伊莎贝拉':(24,58),'谙善':(38,66),'衡':(51,76),'和宁':(70,76),'秋津':(23,88)}
for record in records:
    if record['name'] in positions:
        x,y=positions[record['name']]
        record['coordinates']=dict(x=x,y=y)

path_to_id={ (CORPUS/k).resolve():v for k,v in links.items() }
for record in records:
    if record['id'] not in links.values():
        continue
    original=next(CORPUS/k for k,v in links.items() if v==record['id'])
    def replace_link(m):
        prefix,label,target=m.groups()
        target=unquote(target)
        if target.startswith(('http:','https:','#','/media/')):
            return m.group(0)
        resolved=(original.parent/target).resolve()
        if resolved in path_to_id:
            return f'[{label}](/entity/{path_to_id[resolved]}/)'
        if target.endswith(('png','jpg')):
            return f'![{label}](/media/'+resolved.name+')'
        return label
    record['description']=re.sub(r'(!?)\[([^\]]+)\]\(([^)]+)\)',replace_link,record['description'])
    record['sourcePath']=str(original.relative_to(CORPUS)).replace('\\','/')
    for source in record['sources']:
        record['relations'].append(dict(target=source,type='documented_by'))

collections=[
 dict(slug='wangan',name='望安：海雾与城市',subtitle='地区专题',description='山海地理、空白区域与下降城区的交叉记录。',ids=['LC-0001','EV-0002','IN-0003','LC-0023','LC-0024']+[r['id'] for r in records if r['type']=='organization' and r['location']=='望安']),
 dict(slug='worldlines',name='事件波及其后果',subtitle='机制专题',description='从并符的计划，到悖论子深度与消解世界线学说。',ids=['PJ-0001','SY-0008','SY-0003','SY-0005','SY-0006','MD-0002']),
 dict(slug='civilizations',name='文明与国度',subtitle='历史与地域',description='从环世界的源文明，到和睦时代各国的政治现状。',ids=['SY-0002','SY-0007','SY-0008','SY-0009','DC-0015']+[r['id'] for r in records if r['name'] in countries],image='/media/国度地图.png'),
 dict(slug='legacy',name='旧稿候选库',subtitle='独立馆藏',description='五年前的手稿与转录。保留难辨、缺损和互相冲突的版本，供后续挑选。',ids=[r['id'] for r in records if r['status']=='legacy'],image='/media/IMG_20260912_190054.jpg'),
]
payload=dict(entities=records,collections=collections,links=links,assembledAt='2026-10-23')
(OUT/'archive.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(records=len(records),media=len(image_specs),countries=len(countries))))
