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
          negotiations: [
            {
              negotiation_id: 'neg_1',
              monitor_id: 'm_1',
              meeting_title: 'Planning',
              status: 'awaiting_requester_decision',
              event_id: 'event_1',
              calendar_id: 'cal_1',
              declined_attendee_user_id: 'ou_a',
              trigger_attendee_user_ids_json: '["ou_a"]',
              current_round: 2,
              max_rounds: 5,
              scheduler_status: 'scheduled',
              finalize_status: 'not_started',
              expires_at_utc: '2026-06-18T02:00:00Z',
              participants: [
                {
                  attendee_user_id: 'ou_a',
                  display_name: 'Amy',
                  role: 'decliner',
                  latest_response_status: 'proposed_slot',
                },
              ],
              candidate_slots: [
                {
                  slot_id: 'slot_1',
                  start_time: '2026-06-18T03:00:00Z',
                  end_time: '2026-06-18T03:30:00Z',
                  status: 'candidate',
                },
              ],
              votes: [
                {
                  vote_id: 'vote_1',
                  attendee_user_id: 'ou_b',
                  slot_id: 'slot_1',
                  vote: 'yes',
                },
              ],
              messages: [
                {
                  message_event_id: 'msg_evt_1',
                  direction: 'outbound',
                  participant_user_id: 'ou_a',
                  message_type: 'ask_decliner_slot',
                  created_at: '2026-06-18T01:01:00Z',
                },
              ],
              finalize_attempts: [
                {
                  finalize_attempt_id: 'fin_1',
                  selected_slot_id: 'slot_1',
                  status: 'pending',
                  updated_at: '2026-06-18T01:05:00Z',
                },
              ],
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
    expect((await screen.findAllByText('Planning')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/event_1/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/cal_1/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/cron_1/)).toBeTruthy()
    expect(screen.getByText(/2026-06-18T01:00:00Z/)).toBeTruthy()
    expect(await screen.findByText('failed_retryable')).toBeTruthy()
    expect(screen.getByText(/creator_escalation/)).toBeTruthy()
    expect(screen.getByTestId('delivery-task-dt_1-attempt-count').textContent).toContain('2')
    expect(screen.getByText(/2026-06-18T01:02:00Z/)).toBeTruthy()
    expect(await screen.findByText('cron service unavailable')).toBeTruthy()
    expect(await screen.findByText('awaiting_requester_decision')).toBeTruthy()
    expect(screen.getAllByText(/neg_1/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/ou_a/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/scheduled/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/2026-06-18T02:00:00Z/)).toBeTruthy()
    expect(screen.getByText('Candidate slots')).toBeTruthy()
    expect(screen.getAllByText(/slot_1/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Votes')).toBeTruthy()
    expect(screen.getByText(/ou_b: yes on slot_1/)).toBeTruthy()
    expect(screen.getByText('Participants')).toBeTruthy()
    expect(screen.getByText(/Amy: decliner/)).toBeTruthy()
    expect(screen.getByText('Messages')).toBeTruthy()
    expect(screen.getByText(/ask_decliner_slot/)).toBeTruthy()
    expect(screen.getByText('Finalize attempts')).toBeTruthy()
    expect(screen.getByText(/fin_1/)).toBeTruthy()
  })

  it('runs delivery retry, requeues failed tasks, and operates negotiations', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () =>
        init?.method === 'POST'
          ? { ok: true }
          : {
              monitors: [],
              scheduler: { delivery_retry_scheduler_status: 'ok' },
              negotiations: [
                {
                  negotiation_id: 'neg_1',
                  status: 'collecting_votes',
                },
              ],
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
    vi.spyOn(window, 'prompt').mockReturnValue('slot_1')
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
    fireEvent.click(
      await screen.findByRole('button', { name: 'Run negotiation neg_1' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Finalize negotiation neg_1' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancel negotiation neg_1' }),
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
      expect(fetchMock).toHaveBeenCalledWith('/api/meeting-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_negotiation',
          negotiation_id: 'neg_1',
        }),
      })
      expect(fetchMock).toHaveBeenCalledWith('/api/meeting-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize_negotiation',
          negotiation_id: 'neg_1',
          selected_slot_id: 'slot_1',
          decision_source: 'consent',
          requester_confirmation: true,
        }),
      })
      expect(fetchMock).toHaveBeenCalledWith('/api/meeting-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_negotiation',
          negotiation_id: 'neg_1',
          reason: 'operator requested cancellation',
        }),
      })
    })
  })
})
