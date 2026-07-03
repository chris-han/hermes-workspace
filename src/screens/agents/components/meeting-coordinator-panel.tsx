import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelNegotiation,
  fetchMeetingCoordinatorState,
  finalizeNegotiation,
  requeueDeliveryTask,
  runDeliveryRetryNow,
  runNegotiationNow,
} from '@/lib/meeting-coordinator-api'

export function MeetingCoordinatorPanel() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['meeting-coordinator'],
    queryFn: fetchMeetingCoordinatorState,
  })
  const retryMutation = useMutation({
    mutationFn: runDeliveryRetryNow,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['meeting-coordinator'] }),
  })
  const requeueMutation = useMutation({
    mutationFn: requeueDeliveryTask,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['meeting-coordinator'] }),
  })
  const runNegotiationMutation = useMutation({
    mutationFn: runNegotiationNow,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['meeting-coordinator'] }),
  })
  const finalizeNegotiationMutation = useMutation({
    mutationFn: finalizeNegotiation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['meeting-coordinator'] }),
  })
  const cancelNegotiationMutation = useMutation({
    mutationFn: cancelNegotiation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['meeting-coordinator'] }),
  })

  const monitors = query.data?.monitors ?? []
  const deliveryTasks = query.data?.deliveryTasks ?? []
  const negotiations = query.data?.negotiations ?? []
  const scheduler = query.data?.scheduler

  const field = (label: string, value: unknown) =>
    value === null || value === undefined || value === '' ? null : (
      <p className="text-xs text-[var(--theme-muted)]">
        <span className="font-medium text-[var(--theme-muted-2)]">{label}: </span>
        {String(value)}
      </p>
    )
  const compactRow = (key: string, value: string) => (
    <p key={key} className="truncate text-xs text-[var(--theme-muted)]">
      {value}
    </p>
  )

  return (
    <section className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-card)] p-5 shadow-[0_16px_50px_var(--theme-shadow)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--theme-text)]">
            Meeting Coordinator
          </h2>
          <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
            Active RSVP monitors and pending creator escalation delivery tasks
          </p>
        </div>
        <button
          type="button"
          onClick={() => retryMutation.mutate()}
          className="rounded-md border border-[var(--theme-border)] px-3 py-2 text-sm text-[var(--theme-text)]"
        >
          Run delivery retry now
        </button>
      </div>

      {query.isPending ? (
        <p className="mt-4 text-sm text-[var(--theme-muted)]">
          Loading meeting monitors...
        </p>
      ) : query.error ? (
        <p className="mt-4 text-sm text-[var(--theme-danger)]">
          {query.error instanceof Error
            ? query.error.message
            : 'Failed to load meeting monitors'}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {scheduler?.delivery_retry_scheduler_detail ? (
            <p className="md:col-span-2 rounded-md border border-[var(--theme-danger)] p-3 text-sm text-[var(--theme-danger)]">
              {scheduler.delivery_retry_scheduler_detail}
            </p>
          ) : null}
          <div className="rounded-md border border-[var(--theme-border)] p-3">
            <h3 className="text-sm font-medium text-[var(--theme-text)]">
              Monitors
            </h3>
            {monitors.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--theme-muted)]">
                No meeting monitors
              </p>
            ) : (
              monitors.map((monitor) => (
                <div
                  key={monitor.monitor_id}
                  className="mt-2 rounded-md bg-[var(--theme-card2)] p-2"
                >
                  <p className="text-sm text-[var(--theme-text)]">
                    {monitor.meeting_title || monitor.monitor_id}
                  </p>
                  <div className="mt-1 grid gap-1">
                    {field('status', monitor.status)}
                    {field('monitor', monitor.monitor_id)}
                    {field('event', monitor.event_id)}
                    {field('calendar', monitor.calendar_id)}
                    {field('cron', monitor.cron_job_id)}
                    {field('last checked', monitor.last_checked_at)}
                    {field('pending delivery tasks', monitor.pending_delivery_tasks)}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="rounded-md border border-[var(--theme-border)] p-3 md:col-span-2">
            <h3 className="text-sm font-medium text-[var(--theme-text)]">
              Negotiations
            </h3>
            {negotiations.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--theme-muted)]">
                No active negotiations
              </p>
            ) : (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {negotiations.map((negotiation) => {
                  const finalize = () => {
                    const selectedSlotId = window
                      .prompt('Selected slot id')
                      ?.trim()
                    if (!selectedSlotId) return
                    finalizeNegotiationMutation.mutate({
                      negotiationId: negotiation.negotiation_id,
                      selectedSlotId,
                    })
                  }
                  return (
                    <div
                      key={negotiation.negotiation_id}
                      className="rounded-md bg-[var(--theme-card2)] p-2"
                    >
                      <p className="text-sm text-[var(--theme-text)]">
                        {negotiation.meeting_title || negotiation.negotiation_id}
                      </p>
                      <div className="mt-1 grid gap-1">
                        {field('status', negotiation.status)}
                        {field('negotiation', negotiation.negotiation_id)}
                        {field('monitor', negotiation.monitor_id)}
                        {field('event', negotiation.event_id)}
                        {field('calendar', negotiation.calendar_id)}
                        {field('decliner', negotiation.declined_attendee_user_id)}
                        {field('triggers', negotiation.trigger_attendee_user_ids_json)}
                        {field('round', negotiation.current_round)}
                        {field('max rounds', negotiation.max_rounds)}
                        {field('scheduler', negotiation.scheduler_status)}
                        {field('finalize', negotiation.finalize_status)}
                        {field('expires', negotiation.expires_at_utc)}
                        {field('updated', negotiation.updated_at)}
                      </div>
                      {negotiation.candidate_slots?.length ? (
                        <div className="mt-2 rounded-md border border-[var(--theme-border)] p-2">
                          <p className="text-xs font-medium text-[var(--theme-muted-2)]">
                            Candidate slots
                          </p>
                          <div className="mt-1 grid gap-1">
                            {negotiation.candidate_slots.map((slot) =>
                              compactRow(
                                slot.slot_id,
                                `${slot.slot_id}: ${slot.start_time || ''} - ${slot.end_time || ''} (${slot.status || 'candidate'})`,
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                      {negotiation.votes?.length ? (
                        <div className="mt-2 rounded-md border border-[var(--theme-border)] p-2">
                          <p className="text-xs font-medium text-[var(--theme-muted-2)]">
                            Votes
                          </p>
                          <div className="mt-1 grid gap-1">
                            {negotiation.votes.map((vote) =>
                              compactRow(
                                vote.vote_id,
                                `${vote.attendee_user_id || 'unknown'}: ${vote.vote || 'unknown'} on ${vote.slot_id || 'unknown slot'}`,
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                      {negotiation.participants?.length ? (
                        <div className="mt-2 rounded-md border border-[var(--theme-border)] p-2">
                          <p className="text-xs font-medium text-[var(--theme-muted-2)]">
                            Participants
                          </p>
                          <div className="mt-1 grid gap-1">
                            {negotiation.participants.map((participant) =>
                              compactRow(
                                participant.attendee_user_id,
                                `${participant.display_name || participant.attendee_user_id}: ${participant.role || 'participant'} / ${participant.latest_response_status || 'unknown'}`,
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                      {negotiation.messages?.length ? (
                        <div className="mt-2 rounded-md border border-[var(--theme-border)] p-2">
                          <p className="text-xs font-medium text-[var(--theme-muted-2)]">
                            Messages
                          </p>
                          <div className="mt-1 grid gap-1">
                            {negotiation.messages.slice(-4).map((message) =>
                              compactRow(
                                message.message_event_id,
                                `${message.direction || 'message'} ${message.message_type || ''} ${message.participant_user_id || ''} ${message.created_at || ''}`,
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                      {negotiation.finalize_attempts?.length ? (
                        <div className="mt-2 rounded-md border border-[var(--theme-border)] p-2">
                          <p className="text-xs font-medium text-[var(--theme-muted-2)]">
                            Finalize attempts
                          </p>
                          <div className="mt-1 grid gap-1">
                            {negotiation.finalize_attempts.map((attempt) =>
                              compactRow(
                                attempt.finalize_attempt_id,
                                `${attempt.finalize_attempt_id}: ${attempt.status || 'pending'} ${attempt.selected_slot_id || ''} ${attempt.updated_at || ''}`,
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runNegotiationMutation.mutate(
                              negotiation.negotiation_id,
                            )
                          }
                          className="rounded-md border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-text)]"
                        >
                          Run negotiation {negotiation.negotiation_id}
                        </button>
                        <button
                          type="button"
                          onClick={finalize}
                          className="rounded-md border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-text)]"
                        >
                          Finalize negotiation {negotiation.negotiation_id}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            cancelNegotiationMutation.mutate(
                              negotiation.negotiation_id,
                            )
                          }
                          className="rounded-md border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-text)]"
                        >
                          Cancel negotiation {negotiation.negotiation_id}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="rounded-md border border-[var(--theme-border)] p-3">
            <h3 className="text-sm font-medium text-[var(--theme-text)]">
              Delivery Tasks
            </h3>
            {deliveryTasks.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--theme-muted)]">
                No pending delivery tasks
              </p>
            ) : (
              deliveryTasks.map((task) => (
                <div
                  key={task.delivery_task_id}
                  className="mt-2 rounded-md bg-[var(--theme-card2)] p-2"
                >
                  <p className="text-sm text-[var(--theme-text)]">
                    {task.task_type}
                  </p>
                  <div className="mt-1 grid gap-1">
                    {field('delivery task', task.delivery_task_id)}
                    {field('status', task.status)}
                    <p className="text-xs text-[var(--theme-muted)]">
                      <span className="font-medium text-[var(--theme-muted-2)]">
                        attempts:{' '}
                      </span>
                      <span
                        data-testid={`delivery-task-${task.delivery_task_id}-attempt-count`}
                      >
                        {task.attempt_count ?? 0}
                      </span>
                    </p>
                    {field('next attempt', task.next_attempt_at)}
                  </div>
                  {task.status.startsWith('failed_') ? (
                    <button
                      type="button"
                      onClick={() => requeueMutation.mutate(task.delivery_task_id)}
                      className="mt-2 rounded-md border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-text)]"
                    >
                      Requeue delivery task {task.delivery_task_id}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  )
}
