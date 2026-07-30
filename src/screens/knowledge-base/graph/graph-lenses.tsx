import type { GraphLens } from './graph-types'

const LENS_VALUES: GraphLens[] = [
  'overview',
  'evidence',
  'authority',
  'conflict',
  'impact',
  'lineage',
  'governance',
  'replay',
]

export const GRAPH_COPY = {
  en: {
    title: 'Governed graph review',
    subtitle: 'Locate, verify, compare, act, and replay governed knowledge.',
    search: 'Search visible graph',
    noMatches: 'No matching visible result',
    filters: 'Search and filters',
    kind: 'Kind',
    tier: 'Tier',
    authority: 'Authority',
    state: 'State',
    all: 'All',
    scene: 'Scene lens',
    overview: 'Overview',
    sensitivity: 'Sensitivity',
    inspector: 'Inspector',
    summary: 'Summary',
    evidence: 'Evidence',
    authorityTab: 'Authority',
    lineage: 'Lineage',
    governance: 'Governance',
    replay: 'Replay',
    conflict: 'Conflict',
    impact: 'Impact',
    sourceAnchor: 'Source anchor',
    sourceHash: 'Source hash',
    spanHash: 'Span hash',
    contextualWarning: 'Contextual only, not active authority',
    freshnessFresh: 'Fresh',
    freshnessBlocked: 'Authority-changing actions blocked until refresh',
    hiddenOmission: 'Authorized omission',
    nodesOmitted: 'nodes omitted',
    labelsMinimized: 'labels minimized',
    exportEvidence: 'Export evidence chain',
    justification: 'Justification',
    commandBlocked: 'Command blocked by stale projection',
    approve: 'Approve',
    validate: 'Validate',
    activate: 'Activate',
    reject: 'Reject',
    deprecate: 'Deprecate',
    escalate: 'Escalate',
    proposeSupersession: 'Propose supersession',
    requestSourceCorrection: 'Request source correction',
    notPermitted: 'No permitted governance action for this selection',
    pathExplanation: 'Path explanation',
    affected: 'Affected artifacts',
    incompleteImpact: 'Impact may be incomplete because of graph boundaries or authorization omissions.',
    snapshot: 'Snapshot',
    projectionHash: 'Projection hash',
    presentationHash: 'Presentation hash',
    eventHistory: 'Event history',
  },
  zh: {
    title: '治理知识图谱评审',
    subtitle: '定位、核验证据、比较冲突、执行治理动作并重放。',
    search: '搜索可见图谱',
    noMatches: '没有匹配的可见结果',
    filters: '搜索与筛选',
    kind: '类型',
    tier: '层级',
    authority: '权威',
    state: '状态',
    all: '全部',
    scene: '场景镜头',
    overview: '概览',
    sensitivity: '敏感性',
    inspector: '检查器',
    summary: '摘要',
    evidence: '证据',
    authorityTab: '权威',
    lineage: '沿革',
    governance: '治理',
    replay: '重放',
    conflict: '冲突',
    impact: '影响',
    sourceAnchor: '来源锚点',
    sourceHash: '来源哈希',
    spanHash: '片段哈希',
    contextualWarning: '仅作上下文，不是生效权威',
    freshnessFresh: '新鲜',
    freshnessBlocked: '刷新前禁止改变权威的操作',
    hiddenOmission: '授权省略',
    nodesOmitted: '个节点已省略',
    labelsMinimized: '个标签已最小化',
    exportEvidence: '导出证据链',
    justification: '理由',
    commandBlocked: '投影已过期，命令被阻止',
    approve: '批准',
    validate: '验证',
    activate: '激活',
    reject: '拒绝',
    deprecate: '弃用',
    escalate: '升级',
    proposeSupersession: '提出替代',
    requestSourceCorrection: '请求来源修正',
    notPermitted: '当前选择没有可执行的治理动作',
    pathExplanation: '路径解释',
    affected: '受影响制品',
    incompleteImpact: '由于图边界或授权省略，影响分析可能不完整。',
    snapshot: '快照',
    projectionHash: '投影哈希',
    presentationHash: '呈现哈希',
    eventHistory: '事件历史',
  },
} satisfies Record<'en' | 'zh', Record<string, string>>

export type GraphCopy = Record<string, string>

export function GraphLensTabs({
  lens,
  copy,
  onChange,
}: {
  lens: GraphLens
  copy: GraphCopy
  onChange: (lens: GraphLens) => void
}) {
  return (
    <div aria-label={copy.scene} className="flex flex-wrap gap-2">
      {LENS_VALUES.map((value) => (
        <button
          key={value}
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-blue)]"
          style={
            lens === value
              ? {
                  background: 'var(--theme-accent)',
                  color: 'var(--theme-accent-foreground)',
                }
              : undefined
          }
          onClick={() => onChange(value)}
        >
          {copy[value === 'authority' ? 'authorityTab' : value] ?? value}
        </button>
      ))}
    </div>
  )
}
