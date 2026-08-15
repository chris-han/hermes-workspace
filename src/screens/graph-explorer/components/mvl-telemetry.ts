export type MvlTelemetryEvent = { event: string; tenantId: string; workspaceId: string; graphRef: string; graphVersion: string; graphHash: string; timestamp: string; locale: string }

export function emitMvlTelemetry(event: string, context: Omit<MvlTelemetryEvent, 'event' | 'timestamp'>) {
  const payload: MvlTelemetryEvent = { event, timestamp: new Date().toISOString(), ...context }
  window.dispatchEvent(new CustomEvent('semantier:mvl-telemetry', { detail: payload }))
  void fetch('/api/contextgraph/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => undefined)
}
