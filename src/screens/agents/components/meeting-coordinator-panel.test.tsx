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
              event_id: 'event_1',
              calendar_id: 'cal_1',
              cron_job_id: 'cron_1',
              last_checked_at: '2026-06-18T01:00:00Z',
              pending_delivery_tasks: 1,
            },
          ],
          deliveryTasks: [
            {
              delivery_task_id: 'dt_1',
              status: 'failed_retryable',
              task_type: 'creator_escalation',
              attempt_count: 2,
              next_attempt_at: '2026-06-18T01:02:00Z',
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
    expect(screen.getByText(/event_1/)).toBeTruthy()
    expect(screen.getByText(/cal_1/)).toBeTruthy()
    expect(screen.getByText(/cron_1/)).toBeTruthy()
    expect(screen.getByText(/2026-06-18T01:00:00Z/)).toBeTruthy()
    expect(await screen.findByText('failed_retryable')).toBeTruthy()
    expect(screen.getByText(/creator_escalation/)).toBeTruthy()
    expect(screen.getByTestId('delivery-task-dt_1-attempt-count').textContent).toContain('2')
    expect(screen.getByText(/2026-06-18T01:02:00Z/)).toBeTruthy()
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
