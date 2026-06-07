import React, { useRef, useState } from 'react'
import { useStreamingMessage } from '@/screens/chat/hooks/use-streaming-message'
import { ensureDefaultSmbOrganization } from '@/lib/organization-membership'

const PROMPTS = [
  '基于当前组织的 demo dataset，生成营业分析，重点说明收入结构、项目毛利、回款节奏、现金压力和需要关注的经营异常。',
  '基于当前组织的 demo dataset，演示日常入账报销流程，给出费用分类、建议会计分录、需要补充的凭证材料和风险提示。',
  '基于当前组织的 demo dataset，生成报税报告，汇总增值税、企业所得税相关准备事项，并说明本期重点关注项目。',
]

async function ensureChatSession(label: string): Promise<{ sessionKey: string; friendlyId: string }> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  if (!response.ok) throw new Error(`Create session failed: ${response.status}`)
  const payload = (await response.json()) as {
    ok?: boolean
    error?: string
    sessionKey?: string
    friendlyId?: string
  }
  if (!payload.ok || !payload.sessionKey) throw new Error(payload.error || 'Create session failed')
  return { sessionKey: payload.sessionKey, friendlyId: payload.friendlyId || payload.sessionKey }
}

function extractTextFromMessage(message: any): string {
  if (!message) return ''
  const content = message.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c?.text ?? c?.thinking ?? ''))
      .join('\n')
      .trim()
  }
  return ''
}

export function DemoInsightsRunner({
  onClose,
}: {
  onClose?: () => void
}) {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Array<{ prompt: string; text?: string; error?: string }>>([])
  const resolveRef = useRef<((v: string) => void) | null>(null)
  const rejectRef = useRef<((e: any) => void) | null>(null)

  const { isStreaming, streamingText, error, startStreaming, cancelStreaming, resetStreaming } =
    useStreamingMessage({
      onComplete: (msg) => {
        const finalText = extractTextFromMessage(msg)
        if (resolveRef.current) {
          resolveRef.current(finalText)
          resolveRef.current = null
        }
      },
      onError: (err) => {
        if (rejectRef.current) {
          rejectRef.current(err)
          rejectRef.current = null
        }
      },
    })

  const runSingle = async (prompt: string) => {
    setResults([])
    setRunning(true)
    try {
      await ensureDefaultSmbOrganization()
      const { sessionKey, friendlyId } = await ensureChatSession('示例：单次洞察')
      const out = await runStreaming(sessionKey, friendlyId, prompt)
      setResults((r) => [...r, { prompt, text: out }])
    } catch (err) {
      setResults((r) => [...r, { prompt, error: err instanceof Error ? err.message : String(err) }])
    } finally {
      setRunning(false)
    }
  }

  const runAll = async () => {
    setResults([])
    setRunning(true)
    try {
      await ensureDefaultSmbOrganization()
      const { sessionKey, friendlyId } = await ensureChatSession('索阳示例：三点洞察')
      for (const p of PROMPTS) {
        try {
          const out = await runStreaming(sessionKey, friendlyId, p)
          setResults((r) => [...r, { prompt: p, text: out }])
        } catch (err) {
          setResults((r) => [...r, { prompt: p, error: err instanceof Error ? err.message : String(err) }])
        }
      }
    } catch (err) {
      setResults((r) => [...r, { prompt: 'session', error: err instanceof Error ? err.message : String(err) }])
    } finally {
      setRunning(false)
    }
  }

  function runStreaming(sessionKey: string, friendlyId: string, prompt: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      resolveRef.current = resolve
      rejectRef.current = reject
      try {
        startStreaming({ sessionKey, friendlyId, message: prompt })
      } catch (err) {
        reject(err)
        resolveRef.current = null
        rejectRef.current = null
      }
    })
  }

  return (
    <div className="rounded-xl border p-4 shadow theme-card-surface w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Demo Insights Runner</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetStreaming()
              setResults([])
            }}
            className="rounded px-3 py-1 text-sm border"
          >
            Reset
          </button>
          <button
            onClick={() => onClose?.()}
            className="rounded bg-gray-100 px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => void runSingle(PROMPTS[0])}
          disabled={running || isStreaming}
          className="rounded-xl bg-accent-500 px-3 py-1 text-sm font-semibold text-white"
        >
          Run Insight 1
        </button>
        <button
          onClick={() => void runSingle(PROMPTS[1])}
          disabled={running || isStreaming}
          className="rounded-xl border px-3 py-1 text-sm font-semibold"
        >
          Run Insight 2
        </button>
        <button
          onClick={() => void runSingle(PROMPTS[2])}
          disabled={running || isStreaming}
          className="rounded-xl border px-3 py-1 text-sm font-semibold"
        >
          Run Insight 3
        </button>
        <button
          onClick={() => void runAll()}
          disabled={running || isStreaming}
          className="rounded-xl border px-3 py-1 text-sm font-semibold"
        >
          Run All
        </button>
        {isStreaming ? (
          <button
            onClick={() => cancelStreaming()}
            className="rounded-xl border px-3 py-1 text-sm text-red-600"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="min-h-[80px] rounded border p-3 font-mono text-sm whitespace-pre-wrap">
          {isStreaming ? streamingText : error ? `Error: ${error}` : results.length ? results.map((r, i) => `#${i + 1} ${r.prompt}\n${(r.text || r.error) || ''}\n`).join('\n---\n') : 'No output yet.'}
        </div>
      </div>
    </div>
  )
}

export default DemoInsightsRunner
