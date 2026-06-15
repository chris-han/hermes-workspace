import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMeetingCoordinatorState,
  requeueDeliveryTask,
  runDeliveryRetryNow,
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

  const monitors = query.data?.monitors ?? []
  const deliveryTasks = query.data?.deliveryTasks ?? []
  const scheduler = query.data?.scheduler

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
                  <p className="text-xs text-[var(--theme-muted)]">
                    {monitor.status}
                    {monitor.pending_delivery_tasks
                      ? ` · ${monitor.pending_delivery_tasks} delivery task`
                      : ''}
                  </p>
                </div>
              ))
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
                  <p className="text-xs text-[var(--theme-muted)]">
                    {task.status}
                  </p>
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
