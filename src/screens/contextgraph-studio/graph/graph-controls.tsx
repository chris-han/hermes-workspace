export function GraphControls({ onReset }: { onReset?: () => void }) {
  return <div className="absolute bottom-3 left-3 z-10"><button type="button" className="rounded-md border border-border bg-card px-2 py-1 text-xs" onClick={onReset}>Reset layout</button></div>
}
