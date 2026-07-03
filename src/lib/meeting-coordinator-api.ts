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

export type MeetingCoordinatorNegotiation = {
  negotiation_id: string
  monitor_id?: string
  meeting_title?: string
  status: string
  event_id?: string
  calendar_id?: string
  declined_attendee_user_id?: string | null
  trigger_attendee_user_ids_json?: string | null
  current_round?: number
  max_rounds?: number
  selected_slot_json?: string | null
  scheduler_status?: string
  finalize_status?: string
  updated_at?: string | null
  expires_at_utc?: string | null
  participants?: Array<MeetingCoordinatorNegotiationParticipant>
  candidate_slots?: Array<MeetingCoordinatorCandidateSlot>
  votes?: Array<MeetingCoordinatorVote>
  messages?: Array<MeetingCoordinatorMessage>
  finalize_attempts?: Array<MeetingCoordinatorFinalizeAttempt>
  events?: Array<MeetingCoordinatorEvent>
}

export type MeetingCoordinatorNegotiationParticipant = {
  attendee_user_id: string
  display_name?: string | null
  role?: string
  required_for_consent?: number
  latest_response_status?: string
  latest_slot_id?: string | null
  delivery_status?: string
}

export type MeetingCoordinatorCandidateSlot = {
  slot_id: string
  proposed_by_user_id?: string
  round_number?: number
  start_time?: string
  end_time?: string
  timezone?: string
  status?: string
}

export type MeetingCoordinatorVote = {
  vote_id: string
  slot_id?: string
  attendee_user_id?: string
  vote?: string
  alternative_slot_id?: string | null
}

export type MeetingCoordinatorMessage = {
  message_event_id: string
  direction?: string
  participant_user_id?: string
  message_id?: string | null
  message_type?: string
  created_at?: string
}

export type MeetingCoordinatorFinalizeAttempt = {
  finalize_attempt_id: string
  selected_slot_id?: string
  decision_source?: string
  requested_by_user_id?: string
  status?: string
  updated_at?: string
}

export type MeetingCoordinatorEvent = {
  event_id: string
  event_type?: string
  actor_id?: string
  created_at?: string
}

export type MeetingCoordinatorSchedulerState = {
  delivery_retry_scheduler_status: string
  delivery_retry_scheduler_detail?: string | null
  updated_at?: string | null
}

export async function fetchMeetingCoordinatorState(): Promise<{
  monitors: Array<MeetingCoordinatorMonitor>
  deliveryTasks: Array<MeetingCoordinatorDeliveryTask>
  negotiations: Array<MeetingCoordinatorNegotiation>
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
    negotiations: Array.isArray(payload.negotiations) ? payload.negotiations : [],
    scheduler:
      payload.scheduler && typeof payload.scheduler === 'object'
        ? payload.scheduler
        : { delivery_retry_scheduler_status: 'unknown' },
  }
}

export async function runNegotiationNow(negotiationId: string): Promise<void> {
  const response = await fetch('/api/meeting-coordinator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'run_negotiation',
      negotiation_id: negotiationId,
    }),
  })
  if (!response.ok) {
    const payload = await response.json()
    throw new Error(payload.error || payload.detail || 'Failed to run negotiation')
  }
}

export async function finalizeNegotiation(input: {
  negotiationId: string
  selectedSlotId: string
}): Promise<void> {
  const response = await fetch('/api/meeting-coordinator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'finalize_negotiation',
      negotiation_id: input.negotiationId,
      selected_slot_id: input.selectedSlotId,
      decision_source: 'consent',
      requester_confirmation: true,
    }),
  })
  if (!response.ok) {
    const payload = await response.json()
    throw new Error(payload.error || payload.detail || 'Failed to finalize negotiation')
  }
}

export async function cancelNegotiation(negotiationId: string): Promise<void> {
  const response = await fetch('/api/meeting-coordinator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'cancel_negotiation',
      negotiation_id: negotiationId,
      reason: 'operator requested cancellation',
    }),
  })
  if (!response.ok) {
    const payload = await response.json()
    throw new Error(payload.error || payload.detail || 'Failed to cancel negotiation')
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
