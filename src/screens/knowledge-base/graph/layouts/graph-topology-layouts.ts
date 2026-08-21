export type GraphTopologyMode =
  | 'layout'
  | 'force-directed'
  | 'hierarchical'
  | 'radial'
  | 'circular'
  | 'communities'

export type GraphTopologyNode = {
  readonly id: string
  readonly label?: string
  readonly group?: string
  readonly x?: number
  readonly y?: number
}

export type GraphTopologyEdge = {
  readonly id: string
  readonly source: string
  readonly target: string
}

export type GraphTopologyInput = {
  readonly nodes: readonly GraphTopologyNode[]
  readonly edges: readonly GraphTopologyEdge[]
}

export type GraphTopologyOptions = {
  readonly selectedRootId?: string | null
  readonly seed?: string
  readonly performanceMode?: 'normal' | 'large'
  readonly canvasWidth?: number
  readonly canvasHeight?: number
}

export type GraphTopologyResult = {
  readonly mode: GraphTopologyMode
  readonly positions: ReadonlyMap<string, Readonly<{ x: number; y: number }>>
  readonly rootIds: readonly string[]
  readonly componentCount: number
  readonly cyclePolicyApplied: boolean
  readonly coordinateOrigin: 'fixture' | 'deterministic' | 'computed'
  readonly positionHash: string
}

const DEFAULT_WIDTH = 820
const DEFAULT_HEIGHT = 520

function sortById(left: string, right: string) {
  return left.localeCompare(right)
}

function toFiniteNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback
}

function hashPositionMap(positions: Map<string, { x: number; y: number }>): string {
  const entries = Array.from(positions.entries()).sort(([left], [right]) => sortById(left, right))
  let hash = 2166136261
  for (const [id, point] of entries) {
    const tokens = [id, point.x.toFixed(6), point.y.toFixed(6)]
    for (const token of tokens) {
      for (const char of token) {
        hash ^= char.charCodeAt(0)
        hash = Math.imul(hash, 16777619)
      }
      hash ^= 0x1f
      hash = Math.imul(hash, 16777619)
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seedPhase(seed?: string): number {
  if (!seed) return 0
  return (hashSeed(seed) / 0xffffffff) * Math.PI * 2
}

function seedJitter(seed: string | undefined, key: string, amplitude: number): number {
  if (!seed) return 0
  const unit = hashSeed(`${seed}:${key}`) / 0xffffffff
  return (unit * 2 - 1) * amplitude
}

function circularFallback(
  nodes: GraphTopologyNode[],
  options: GraphTopologyOptions,
): Map<string, { x: number; y: number }> {
  const width = options.canvasWidth ?? DEFAULT_WIDTH
  const height = options.canvasHeight ?? DEFAULT_HEIGHT
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.max(80, Math.min(width, height) * 0.28)
  const phase = seedPhase(options.seed)
  const sorted = [...nodes].sort((left, right) => sortById(left.id, right.id))
  const positions = new Map<string, { x: number; y: number }>()

  sorted.forEach((node, index) => {
    const angle = (index / Math.max(1, sorted.length)) * Math.PI * 2 + phase
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    })
  })

  return positions
}

function hasCompleteFixtureCoordinates(nodes: readonly GraphTopologyNode[]) {
  return nodes.length > 0 && nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))
}

function getAllNeighbours(edges: readonly GraphTopologyEdge[]) {
  const adjacency = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set())
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set())
    adjacency.get(edge.source)!.add(edge.target)
    adjacency.get(edge.target)!.add(edge.source)
  }
  return adjacency
}

function computeCommunityBuckets(
  nodes: readonly GraphTopologyNode[],
  edges: readonly GraphTopologyEdge[],
): string[][] {
  const explicitGroups = new Map<string, string[]>()
  for (const node of nodes) {
    if (!node.group) continue
    const bucket = explicitGroups.get(node.group) ?? []
    bucket.push(node.id)
    explicitGroups.set(node.group, bucket)
  }
  if (explicitGroups.size > 1) {
    return [...explicitGroups.values()].map((bucket) => bucket.sort(sortById))
  }

  const adjacency = getAllNeighbours(edges)
  const unvisited = new Set(nodes.map((node) => node.id))
  const buckets: string[][] = []
  while (unvisited.size > 0) {
    const seed = [...unvisited].sort(sortById)[0]
    const queue = [seed]
    const bucket: string[] = []
    unvisited.delete(seed)
    while (queue.length > 0) {
      const current = queue.shift()!
      bucket.push(current)
      for (const neighbor of [...(adjacency.get(current) ?? [])].sort(sortById)) {
        if (!unvisited.has(neighbor)) continue
        unvisited.delete(neighbor)
        queue.push(neighbor)
      }
    }
    buckets.push(bucket.sort(sortById))
  }
  return buckets
}

function computeRoots(
  nodes: readonly GraphTopologyNode[],
  edges: readonly GraphTopologyEdge[],
  selectedRootId?: string | null,
): { rootIds: string[]; cyclePolicyApplied: boolean } {
  const seenNodes = new Set(nodes.map((node) => node.id))
  const validEdges = edges.filter((edge) => seenNodes.has(edge.source) && seenNodes.has(edge.target))
  const inDegree = new Map<string, number>()
  const descendants = new Map<string, Set<string>>()

  nodes.forEach((node) => {
    inDegree.set(node.id, 0)
    descendants.set(node.id, new Set())
  })

  validEdges.forEach((edge) => {
    const sourceSet = descendants.get(edge.source) ?? new Set<string>()
    if (!sourceSet.has(edge.target)) {
      sourceSet.add(edge.target)
      descendants.set(edge.source, sourceSet)
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
    }
  })

  const roots = nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
    .sort(sortById)

  if (selectedRootId && nodes.some((node) => node.id === selectedRootId)) {
    return { rootIds: [selectedRootId, ...roots.filter((id) => id !== selectedRootId)], cyclePolicyApplied: false }
  }

  return { rootIds: roots, cyclePolicyApplied: roots.length === 0 }
}

function determineRadialRoot(
  nodes: readonly GraphTopologyNode[],
  edges: readonly GraphTopologyEdge[],
  selectedRootId?: string | null,
): string {
  const nodeIds = [...nodes].map((node) => node.id).sort(sortById)
  const adjacency = new Map<string, number>()
  nodes.forEach((node) => adjacency.set(node.id, 0))
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) return
    adjacency.set(edge.source, (adjacency.get(edge.source) ?? 0) + 1)
    adjacency.set(edge.target, (adjacency.get(edge.target) ?? 0) + 1)
  })

  if (selectedRootId && nodeIds.includes(selectedRootId)) {
    return selectedRootId
  }

  const zeroIndegree = nodeIds.filter((id) => {
    const incoming = edges.filter((edge) => edge.target === id).length
    return incoming === 0
  })
  if (zeroIndegree.length === 1) {
    return zeroIndegree[0]
  }
  if (zeroIndegree.length > 1) {
    return zeroIndegree.sort(sortById)[0]
  }

  const topDegree = nodeIds.sort((left, right) => {
    const diff = (adjacency.get(right) ?? 0) - (adjacency.get(left) ?? 0)
    if (diff !== 0) return diff
    return sortById(left, right)
  })
  return topDegree[0] ?? nodeIds[0] ?? ''
}

export function computeGraphTopology(
  input: GraphTopologyInput,
  mode: GraphTopologyMode,
  options: GraphTopologyOptions = {},
): GraphTopologyResult {
  const nodes = [...input.nodes].sort((left, right) => sortById(left.id, right.id))
  const edges = input.edges.filter(
    (edge) => nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target),
  )

  const positions = new Map<string, { x: number; y: number }>()
  let rootIds: string[] = []
  let cyclePolicyApplied = false
  let coordinateOrigin: GraphTopologyResult['coordinateOrigin'] = 'deterministic'

  if (nodes.length === 0) {
    return {
      mode,
      positions,
      rootIds: [],
      componentCount: 0,
      cyclePolicyApplied: false,
      coordinateOrigin: 'deterministic',
      positionHash: hashPositionMap(positions),
    }
  }

  if (mode === 'layout') {
    if (hasCompleteFixtureCoordinates(nodes)) {
      nodes.forEach((node) => {
        positions.set(node.id, {
          x: toFiniteNumber(node.x, 0),
          y: toFiniteNumber(node.y, 0),
        })
      })
      coordinateOrigin = 'fixture'
    } else {
      const circular = circularFallback(nodes, options)
      circular.forEach((point, id) => positions.set(id, point))
      coordinateOrigin = 'deterministic'
    }
    rootIds = [...nodes].map((node) => node.id)
  }

  if (mode === 'force-directed') {
    const initial = hasCompleteFixtureCoordinates(nodes)
      ? new Map(nodes.map((node) => [node.id, { x: toFiniteNumber(node.x, 0), y: toFiniteNumber(node.y, 0) }]))
      : circularFallback(nodes, options)
    initial.forEach((point, id) => positions.set(id, point))
    if (options.seed) {
      // Deterministic micro-jitter keyed by seed to support repeatable in-mode relayout.
      const amplitude = 18
      for (const [id, point] of positions.entries()) {
        positions.set(id, {
          x: point.x + seedJitter(options.seed, `${id}:x`, amplitude),
          y: point.y + seedJitter(options.seed, `${id}:y`, amplitude),
        })
      }
    }
    coordinateOrigin = initial.size > 0 && hasCompleteFixtureCoordinates(nodes) ? 'fixture' : 'deterministic'
    rootIds = [...nodes].map((node) => node.id)
  }

  if (mode === 'hierarchical') {
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, Set<string>>()
    const nodeIds = new Set(nodes.map((node) => node.id))
    nodes.forEach((node) => {
      inDegree.set(node.id, 0)
      adjacency.set(node.id, new Set())
    })

    for (const edge of edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
      const sink = adjacency.get(edge.source) ?? new Set<string>()
      if (!sink.has(edge.target)) {
        sink.add(edge.target)
        adjacency.set(edge.source, sink)
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
      }
    }

    const allRoots = nodes
      .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
      .map((node) => node.id)
      .sort(sortById)
    rootIds = allRoots.length > 0 ? allRoots : nodes.map((node) => node.id).sort(sortById)

    const layers = new Map<string, number>()
    const queue = [...rootIds].sort(sortById)
    queue.forEach((rootId) => layers.set(rootId, 0))
    const processed = new Set<string>()

    while (queue.length > 0) {
      const currentId = queue.shift()!
      if (processed.has(currentId)) continue
      processed.add(currentId)
      const currentDepth = layers.get(currentId) ?? 0
      const children = [...(adjacency.get(currentId) ?? new Set())].sort(sortById)
      children.forEach((childId) => {
        const nextDepth = Math.max(layers.get(childId) ?? 0, currentDepth + 1)
        layers.set(childId, nextDepth)
        queue.push(childId)
      })
    }

    if (allRoots.length === 0) {
      cyclePolicyApplied = true
      nodes.forEach((node, index) => {
        positions.set(node.id, { x: 180 + (index % 3) * 200, y: 120 + Math.floor(index / 3) * 150 })
      })
    } else {
      const xGap = 180
      const componentGap = 220
      const paddingX = 120
      const rootReach = new Map<string, Set<string>>()

      for (const rootId of allRoots) {
        const visited = new Set<string>([rootId])
        const queue = [rootId]
        while (queue.length > 0) {
          const currentId = queue.shift()!
          const children = [...(adjacency.get(currentId) ?? new Set())].sort(sortById)
          for (const childId of children) {
            if (visited.has(childId)) continue
            visited.add(childId)
            queue.push(childId)
          }
        }
        rootReach.set(rootId, visited)
      }

      const assignedRoot = new Map<string, string>()
      for (const node of nodes) {
        const owner = allRoots.find((rootId) => rootReach.get(rootId)?.has(node.id))
        assignedRoot.set(node.id, owner ?? node.id)
      }

      const componentRoots = [...allRoots]
      for (const node of nodes) {
        const owner = assignedRoot.get(node.id) ?? node.id
        if (!componentRoots.includes(owner)) {
          componentRoots.push(owner)
        }
      }

      let cursorX = paddingX
      for (const componentRootId of componentRoots) {
        const componentNodes = nodes
          .filter((node) => (assignedRoot.get(node.id) ?? node.id) === componentRootId)
          .sort((left, right) => {
            const depthDelta = (layers.get(left.id) ?? 0) - (layers.get(right.id) ?? 0)
            if (depthDelta !== 0) return depthDelta
            return sortById(left.id, right.id)
          })
        if (componentNodes.length === 0) continue

        const depthBuckets = new Map<number, string[]>()
        for (const node of componentNodes) {
          const depth = layers.get(node.id) ?? 0
          const list = depthBuckets.get(depth) ?? []
          list.push(node.id)
          depthBuckets.set(depth, list)
        }

        const maxBreadth = Math.max(1, ...Array.from(depthBuckets.values()).map((bucket) => bucket.length))
        const componentWidth = Math.max(xGap, (maxBreadth - 1) * xGap + xGap)

        const orderedDepths = [...depthBuckets.keys()].sort((left, right) => left - right)
        for (const depth of orderedDepths) {
          const bucket = [...(depthBuckets.get(depth) ?? [])].sort(sortById)
          const rowWidth = Math.max(xGap, (bucket.length - 1) * xGap + xGap)
          const rowStartX = cursorX + (componentWidth - rowWidth) / 2
          bucket.forEach((nodeId, index) => {
            positions.set(nodeId, {
              x: rowStartX + index * xGap,
              y: 120 + depth * 150,
            })
          })
        }

        cursorX += componentWidth + componentGap
      }
    }
    coordinateOrigin = 'computed'
  }

  if (mode === 'circular') {
    const circular = circularFallback(nodes, options)
    circular.forEach((point, id) => positions.set(id, point))
    rootIds = [...nodes].map((node) => node.id).sort(sortById)
    coordinateOrigin = 'computed'
  }

  if (mode === 'communities') {
    const buckets = computeCommunityBuckets(nodes, edges)
    const width = options.canvasWidth ?? DEFAULT_WIDTH
    const height = options.canvasHeight ?? DEFAULT_HEIGHT
    const centerX = width / 2
    const centerY = height / 2
    const orbit = Math.max(120, Math.min(width, height) * 0.28)
    buckets.forEach((bucket, bucketIndex) => {
      const clusterAngle = (bucketIndex / Math.max(1, buckets.length)) * Math.PI * 2
      const clusterX = centerX + Math.cos(clusterAngle) * orbit
      const clusterY = centerY + Math.sin(clusterAngle) * orbit
      const localRadius = Math.max(36, Math.min(92, 18 + bucket.length * 8))
      bucket.forEach((nodeId, nodeIndex) => {
        const angle = (nodeIndex / Math.max(1, bucket.length)) * Math.PI * 2
        positions.set(nodeId, {
          x: clusterX + Math.cos(angle) * localRadius,
          y: clusterY + Math.sin(angle) * localRadius,
        })
      })
    })
    rootIds = buckets.map((bucket) => bucket[0]).filter(Boolean)
    coordinateOrigin = 'computed'
  }

  if (mode === 'radial') {
    const root = determineRadialRoot(nodes, edges, options.selectedRootId ?? null)
    const adjacency = getAllNeighbours(edges)
    const queue: Array<{ id: string; distance: number }> = [{ id: root, distance: 0 }]
    const distances = new Map<string, number>([[root, 0]])
    const visited = new Set<string>([root])

    while (queue.length > 0) {
      const current = queue.shift()!
      const neighbours = [...(adjacency.get(current.id) ?? new Set())].sort(sortById)
      neighbours.forEach((neighbourId) => {
        if (visited.has(neighbourId)) return
        visited.add(neighbourId)
        distances.set(neighbourId, current.distance + 1)
        queue.push({ id: neighbourId, distance: current.distance + 1 })
      })
    }

    const ringNodes = [...nodes].sort((left, right) => {
      const distanceDelta = (distances.get(left.id) ?? 0) - (distances.get(right.id) ?? 0)
      if (distanceDelta !== 0) return distanceDelta
      return sortById(left.id, right.id)
    })

    rootIds = [root]
    const angleShift = -Math.PI / 2
    ringNodes.forEach((node, index) => {
      const depth = distances.get(node.id) ?? 0
      const sameDepth = ringNodes.filter((candidate) => (distances.get(candidate.id) ?? 0) === depth)
      const orderInDepth = sameDepth.map((candidate) => candidate.id).sort(sortById).indexOf(node.id)
      const angle = (orderInDepth / Math.max(1, sameDepth.length)) * Math.PI * 2 + angleShift
      const radius = 80 + depth * 110
      positions.set(node.id, {
        x: node.id === root ? 0 : Math.cos(angle) * radius,
        y: node.id === root ? 0 : Math.sin(angle) * radius,
      })
    })

    if (rootIds.length === 0) {
      rootIds = [nodes[0]?.id ?? '']
    }
    coordinateOrigin = 'computed'
  }

  if (mode === 'layout' || mode === 'force-directed') {
    rootIds = [...nodes].map((node) => node.id).sort(sortById)
  }

  if (positions.size === 0 && nodes.length > 0) {
    const fallback = circularFallback(nodes, options)
    fallback.forEach((point, id) => positions.set(id, point))
  }

  const sortedMap = new Map<string, { x: number; y: number }>()
  for (const [id, point] of [...positions.entries()].sort(([left], [right]) => sortById(left, right))) {
    sortedMap.set(id, {
      x: Number.isFinite(point.x) ? Number(point.x) : 0,
      y: Number.isFinite(point.y) ? Number(point.y) : 0,
    })
  }

  const result: GraphTopologyResult = {
    mode,
    positions: sortedMap,
    rootIds: [...new Set(rootIds)].sort(sortById),
    componentCount: Math.max(1, new Set(nodes.map((node) => node.id)).size),
    cyclePolicyApplied,
    coordinateOrigin,
    positionHash: hashPositionMap(sortedMap),
  }

  return result
}
