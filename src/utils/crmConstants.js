export const LEAD_STATUSES = [
  'new', 'contacted', 'interested', 'follow_up', 'documents_pending',
  'onboarding', 'converted', 'not_interested', 'lost',
]

export const LEAD_STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  follow_up: 'Follow-up',
  documents_pending: 'Documents pending',
  onboarding: 'Onboarding',
  converted: 'Converted',
  not_interested: 'Not interested',
  lost: 'Lost',
}

export const CLIENT_STATUSES = ['onboarding', 'active', 'paused', 'inactive', 'closed']
export const LOAD_STATUSES = [
  'searching', 'found', 'negotiating', 'booked', 'picked_up',
  'in_transit', 'delivered', 'completed', 'cancelled',
]
export const TRUCK_STATUSES = [
  'available', 'dispatched', 'loaded', 'in_transit', 'delivered', 'out_of_service',
]
export const DRIVER_STATUSES = ['available', 'dispatched', 'on_load', 'off_duty', 'inactive']
export const DOCUMENT_STATUSES = ['pending', 'received', 'verified', 'expired']
export const TASK_STATUSES = ['todo', 'in_progress', 'completed', 'cancelled']
export const FOLLOW_UP_BUCKETS = ['due_today', 'upcoming', 'overdue', 'completed']
