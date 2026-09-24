/** Maps DB access_role / department to capability flags (UI hints; enforcement is in RPCs). */

export const ACCESS_ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
  { key: 'team_leader', label: 'Team Leader' },
  { key: 'cold_caller', label: 'Cold Caller' },
  { key: 'dispatcher', label: 'Dispatcher' },
  { key: 'finance', label: 'Account / Finance' },
  { key: 'employee', label: 'General Employee' },
]

export function resolveAccessRole(user) {
  if (user?.role === 'admin') return 'admin'
  return user?.access_role || user?.department || 'employee'
}

export function canManageAllLeads(role) {
  return ['admin', 'manager', 'team_leader'].includes(role)
}

export function canManageLoads(role) {
  return ['admin', 'manager', 'dispatcher', 'team_leader'].includes(role)
}

export function canViewFinance(role) {
  return ['admin', 'manager', 'finance', 'team_leader'].includes(role)
}
