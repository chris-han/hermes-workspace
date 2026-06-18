export type MeetingCoordinatorMonitor = {
  monitor_id: string
  meeting_title?: string
  status: string
  event_id?: string
  calendar_id?: string
  cron_job_id?: string | null
  last_checked_at?: string | null
  pending_delivery_tasks?: number
}

export type MeetingCoordinatorDeliveryTask = {
  delivery_task_id: string
  status: string
  task_type: string
  attempt_count?: number
  next_attempt_at?: string | null
}

export type MeetingCoordinatorSchedulerState = {
  delivery_retry_scheduler_status: string
  delivery_retry_scheduler_detail?: string | null
  updated_at?: string | null
}

export async function fetchMeetingCoordinatorState(): Promise<{
  monitors: Array<MeetingCoordinatorMonitor>
  deliveryTasks: Array<MeetingCoordinatorDeliveryTask>
  scheduler: MeetingCoordinatorSchedulerState
}> {
  const response = await fetch('/api/meeting-coordinator')
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(
      payload.error || payload.detail || 'Failed to load meeting coordinator state',
    )
  }
  return {
    monitors: Array.isArray(payload.monitors) ? payload.monitors : [],
    deliveryTasks: Array.isArray(payload.deliveryTasks) ? payload.deliveryTasks : [],
    scheduler:
      payload.scheduler && typeof payload.scheduler === 'object'
        ? payload.scheduler
        : { delivery_retry_scheduler_status: 'unknown' },
  }
}

export async function runDeliveryRetryNow(): Promise<void> {
  const response = await fetch('/api/meeting-coordinator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'run_delivery_retry' }),
  })
  if (!response.ok) {
    const payload = await response.json()
    throw new Error(payload.error || payload.detail || 'Failed to run delivery retry')
  }
}

export async function requeueDeliveryTask(deliveryTaskId: string): Promise<void> {
  const response = await fetch('/api/meeting-coordinator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'requeue_delivery_task',
      delivery_task_id: deliveryTaskId,
      reason: 'operator requested requeue',
    }),
  })
  if (!response.ok) {
    const payload = await response.json()
    throw new Error(payload.error || payload.detail || 'Failed to requeue delivery task')
  }
}
