'use client';

import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import { entities, entityById, neighbors } from '@/lib/data';
import { relationLabels, typeLabels } from '@/lib/config';

export default function RelationGraph({ center, depth, includeSources, onSelect }: { center: string; depth: number; includeSources: boolean; onSelect: (id: string) => void }) {
  const layout = useMemo(() => {
    let nodes = neighbors(center, depth).filter(e => includeSources || e.type !== 'document' || e.id === center);
    nodes = nodes.slice(0, 28);
    const ids = new Set(nodes.map(e => e.id));
    const edges = entities.flatMap(e => e.relations.filter(r => ids.has(e.id) && ids.has(r.target) && (includeSources || r.type !== 'documented_by')).map(r => ({ from: e.id, to: r.target, label: relationLabels[r.type] || r.type })));
    const graph = new dagre.graphlib.Graph().setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 100, marginx: 30, marginy: 30 }).setDefaultEdgeLabel(() => ({}));
    nodes.forEach(e => graph.setNode(e.id, { width: 172, height: 60 }));
    edges.forEach(edge => graph.setEdge(edge.from, edge.to, { label: edge.label, width: 64, height: 20 }));
    dagre.layout(graph);
    return { graph, nodes, edges };
  }, [center, depth, includeSources]);
  if (!entityById[center]) return <p>没有可显示的关系记录。</p>;
  const dimensions = layout.graph.graph();
  return <div className="graph-scroll"><svg className="relation-svg" role="img" aria-label={`${entityById[center].name}的局部关系图`} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} style={{ minWidth: Math.min(dimensions.width || 600, 1100), minHeight: 360 }}>
    <defs><marker id="relation-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="var(--archive-strong-border)"/></marker></defs>
    {layout.graph.edges().map(edge => {
      const info = layout.graph.edge(edge);
      return <g key={edge.v+edge.w}><polyline points={info.points.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--archive-strong-border)" strokeWidth="1" markerEnd="url(#relation-arrow)"/><text x={info.x} y={info.y} textAnchor="middle" className="edge-label">{info.label}</text></g>;
    })}
    {layout.nodes.map(e => {
      const node = layout.graph.node(e.id);
      return <g key={e.id} className={'graph-node '+(e.id === center ? 'current' : '')} transform={`translate(${node.x-node.width/2},${node.y-node.height/2})`} role="button" tabIndex={0} aria-label={`以${e.name}为中心查看关系`} onClick={() => onSelect(e.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(e.id); } }}><rect width={node.width} height={node.height}/><text x="13" y="24">{e.name.length > 11 ? e.name.slice(0, 10)+'…' : e.name}</text><text x="13" y="44" className="node-type">{typeLabels[e.type]} / {e.id}</text></g>;
    })}
  </svg></div>;
}
