// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MeetingCoordinatorPanel } from './meeting-coordinator-panel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MeetingCoordinatorPanel', () => {
  it('shows active monitors and non-terminal delivery tasks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          scheduler: {
            delivery_retry_scheduler_status: 'unavailable',
            delivery_retry_scheduler_detail: 'cron service unavailable',
          },
          monitors: [
            {
              monitor_id: 'm_1',
              meeting_title: 'Planning',
              status: 'complete',
              pending_delivery_tasks: 1,
            },
          ],
          deliveryTasks: [
            {
              delivery_task_id: 'dt_1',
              status: 'failed_retryable',
              task_type: 'creator_escalation',
            },
          ],
        }),
      })),
    )
    const client = new QueryClient()

    render(
      <QueryClientProvider client={client}>
        <MeetingCoordinatorPanel />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Meeting Coordinator')).toBeTruthy()
    expect(await screen.findByText('Planning')).toBeTruthy()
    expect(await screen.findByText('failed_retryable')).toBeTruthy()
    expect(await screen.findByText('cron service unavailable')).toBeTruthy()
  })

  it('runs delivery retry and requeues failed delivery tasks', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () =>
        init?.method === 'POST'
          ? { ok: true }
          : {
              monitors: [],
              scheduler: { delivery_retry_scheduler_status: 'ok' },
              deliveryTasks: [
                {
                  delivery_task_id: 'dt_1',
                  status: 'failed_permanent',
                  task_type: 'creator_escalation',
                },
              ],
            },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new QueryClient()

    render(
      <QueryClientProvider client={client}>
        <MeetingCoordinatorPanel />
      </QueryClientProvider>,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Run delivery retry now' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Requeue delivery task dt_1' }),
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/meeting-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_delivery_retry' }),
      })
      expect(fetchMock).toHaveBeenCalledWith('/api/meeting-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'requeue_delivery_task',
          delivery_task_id: 'dt_1',
          reason: 'operator requested requeue',
        }),
      })
    })
  })
})
