// Single source of truth for the Hub's departments (job functions).
// `position` on an employee stays free text (their actual title, e.g.
// "Senior Dispatcher"); `department` is this fixed set and is what all
// dashboard routing / charts key off — much more reliable than the old
// approach of guessing from the position text.

export const DEPARTMENTS = [
  { key: 'dispatcher', label: 'Dispatcher', defaultMetric: 'Dispatch Fee Earned ($)', hasBuiltinPanel: true },
  { key: 'cold_caller', label: 'Cold Caller', defaultMetric: 'Trucks Activated', hasBuiltinPanel: true },
  { key: 'social_media', label: 'Social Media Manager', defaultMetric: 'Posts Published', hasBuiltinPanel: false },
  { key: 'designer', label: 'Designer', defaultMetric: 'Designs Completed', hasBuiltinPanel: false },
  { key: 'animator', label: 'Animator', defaultMetric: 'Videos/Animations Delivered', hasBuiltinPanel: false },
  { key: 'operations_manager', label: 'Operations Manager', defaultMetric: 'Tasks Managed', hasBuiltinPanel: false },
  { key: 'team_leader', label: 'Team Leader', defaultMetric: 'Team Tasks Reviewed', hasBuiltinPanel: false },
  { key: 'other', label: 'Other', defaultMetric: 'Tasks Completed', hasBuiltinPanel: false },
]

export function departmentLabel(key) {
  return DEPARTMENTS.find((d) => d.key === key)?.label || 'Other'
}

export function defaultMetricFor(key) {
  return DEPARTMENTS.find((d) => d.key === key)?.defaultMetric || 'Tasks Completed'
}

// Departments that get the generic daily/task Performance Log panel
// (dispatcher + cold_caller already have their own dedicated panels).
export function usesPerformanceLog(key) {
  return !DEPARTMENTS.find((d) => d.key === key)?.hasBuiltinPanel
}

// Departments that can have people reporting to them / see a Team tab.
export const MANAGER_DEPARTMENTS = ['team_leader', 'operations_manager']

export function isManagerDepartment(key) {
  return MANAGER_DEPARTMENTS.includes(key)
}
