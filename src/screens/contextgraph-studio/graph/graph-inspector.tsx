export function GraphInspector({ title, children }: { title: string; children?: React.ReactNode }) {
  return <aside aria-label="Graph inspector" className="rounded-lg border border-border bg-card p-3"><h2 className="text-sm font-semibold">{title}</h2>{children}</aside>
}
