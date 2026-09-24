/**
 * Role-based navigation — single source of truth for who sees which screens.
 * Backend RPCs still enforce data; this controls UI noise and wrong routes.
 *
 * Roles: admin (login), manager, team_leader, cold_caller, dispatcher, finance, employee
 */

import { resolveAccessRole } from './permissions'

/** @typedef {{ key: string, label: string }} NavTab */

const EMPLOYEE_TAB_DEFS = [
  { key: 'overview', label: 'Overview', roles: ['*'] },
  { key: 'coldcalling', label: 'Cold Calling', roles: ['cold_caller'] },
  { key: 'leads', label: 'Leads', roles: ['cold_caller', 'team_leader', 'manager'] },
  { key: 'calls', label: 'Calls', roles: ['cold_caller', 'dispatcher', 'team_leader', 'manager'] },
  { key: 'followups', label: 'Follow-ups', roles: ['cold_caller', 'team_leader', 'manager'] },
  { key: 'deals', label: 'Deals & Invoices', roles: ['dispatcher'] },
  { key: 'loads', label: 'Loads', roles: ['dispatcher', 'team_leader', 'manager'] },
  { key: 'clients', label: 'Clients', roles: ['dispatcher', 'team_leader', 'manager'] },
  { key: 'trucks', label: 'Trucks', roles: ['dispatcher', 'team_leader', 'manager'] },
  { key: 'drivers', label: 'Drivers', roles: ['dispatcher', 'team_leader', 'manager'] },
  { key: 'brokers', label: 'Brokers', roles: ['dispatcher', 'team_leader', 'manager'] },
  { key: 'performance', label: 'My Performance', roles: ['employee'], departments: ['social_media', 'designer', 'animator', 'other'] },
  { key: 'team', label: 'My Team', roles: ['team_leader', 'manager'], departments: ['team_leader', 'operations_manager'] },
  { key: 'revenue', label: 'Revenue', roles: ['manager', 'finance'] },
  { key: 'tasks', label: 'Tasks', roles: ['*'] },
  { key: 'teamchat', label: 'Team chat', roles: ['*'] },
  { key: 'updates', label: 'Team updates', roles: ['*'] },
  { key: 'messages', label: 'Legacy messages', roles: ['*'] },
  { key: 'settings', label: 'Settings', roles: ['*'] },
]

const ADMIN_TAB_DEFS = [
  { key: 'overview', label: 'Overview', roles: ['admin'] },
  { key: 'control', label: 'Control center', roles: ['admin'] },
  { key: 'employees', label: 'Employees', roles: ['admin'] },
  { key: 'leads', label: 'Leads', roles: ['admin', 'manager', 'team_leader'] },
  { key: 'calls', label: 'Calls', roles: ['admin', 'manager', 'team_leader', 'cold_caller'] },
  { key: 'followups', label: 'Follow-ups', roles: ['admin', 'manager', 'team_leader', 'cold_caller'] },
  { key: 'clients', label: 'Clients', roles: ['admin', 'manager', 'team_leader', 'dispatcher'] },
  { key: 'loads', label: 'Loads', roles: ['admin', 'manager', 'team_leader', 'dispatcher'] },
  { key: 'trucks', label: 'Trucks', roles: ['admin', 'manager', 'team_leader', 'dispatcher'] },
  { key: 'drivers', label: 'Drivers', roles: ['admin', 'manager', 'team_leader', 'dispatcher'] },
  { key: 'brokers', label: 'Brokers', roles: ['admin', 'manager', 'team_leader', 'dispatcher'] },
  { key: 'deals', label: 'Deals & Sales', roles: ['admin', 'manager', 'dispatcher', 'finance'] },
  { key: 'coldcallers', label: 'Cold Callers', roles: ['admin', 'manager', 'team_leader'] },
  { key: 'revenue', label: 'Revenue', roles: ['admin', 'manager', 'finance'] },
  { key: 'timelogs', label: 'Time logs', roles: ['admin', 'manager'] },
  { key: 'tasks', label: 'Tasks', roles: ['admin', 'manager', 'team_leader', 'cold_caller', 'dispatcher', 'finance', 'employee'] },
  { key: 'teamchat', label: 'Team chat', roles: ['admin', 'manager', 'team_leader', 'cold_caller', 'dispatcher', 'finance', 'employee'] },
  { key: 'messages', label: 'Legacy messages', roles: ['admin', 'manager'] },
  { key: 'audit', label: 'Audit log', roles: ['admin'] },
  { key: 'updates', label: 'Team updates', roles: ['admin', 'manager', 'team_leader', 'cold_caller', 'dispatcher', 'finance', 'employee'] },
  { key: 'payroll', label: 'Payroll & Bonuses', roles: ['admin', 'finance'] },
  { key: 'settings', label: 'Settings', roles: ['admin', 'manager', 'team_leader', 'cold_caller', 'dispatcher', 'finance', 'employee'] },
]

function roleMatches(def, role, department) {
  if (def.roles.includes('*')) return true
  if (def.roles.includes(role)) return true
  if (def.departments?.includes(department)) return true
  return false
}

export function canAccessEmployeeTab(user, tabKey) {
  const role = resolveAccessRole(user)
  const department = user?.department || 'other'
  const def = EMPLOYEE_TAB_DEFS.find((d) => d.key === tabKey)
  if (!def) return false
  return roleMatches(def, role, department)
}

export function canAccessAdminTab(user, tabKey) {
  if (tabKey === 'employeeDetail') return user?.role === 'admin'
  const role = resolveAccessRole(user)
  if (user?.role === 'admin') return true
  const def = ADMIN_TAB_DEFS.find((d) => d.key === tabKey)
  if (!def) return false
  return roleMatches(def, role, user?.department)
}

export function getEmployeeTabs(user, labelOverrides = {}) {
  const role = resolveAccessRole(user)
  const department = user?.department || 'other'
  return EMPLOYEE_TAB_DEFS
    .filter((d) => roleMatches(d, role, department))
    .map((d) => ({
      key: d.key,
      label: labelOverrides[d.key] ?? d.label,
    }))
}

export function getAdminTabs(user) {
  if (user?.role === 'admin') {
    return ADMIN_TAB_DEFS.map((d) => ({ key: d.key, label: d.label }))
  }
  return ADMIN_TAB_DEFS
    .filter((d) => roleMatches(d, resolveAccessRole(user), user?.department))
    .map((d) => ({ key: d.key, label: d.label }))
}

export function canUseGlobalSearch(user) {
  const role = resolveAccessRole(user)
  return ['admin', 'manager', 'team_leader', 'dispatcher', 'cold_caller', 'finance'].includes(role)
}

/** Control center shortcuts filtered the same way as admin tabs */
export function getAdminControlSections(user) {
  const all = [
    { title: 'People', items: [['employees', 'Employees'], ['timelogs', 'Time logs'], ['audit', 'Audit log']] },
    { title: 'Sales', items: [['leads', 'Leads'], ['calls', 'Calls'], ['followups', 'Follow-ups'], ['coldcallers', 'Cold Callers']] },
    { title: 'Operations', items: [['clients', 'Clients'], ['loads', 'Loads'], ['trucks', 'Trucks'], ['drivers', 'Drivers'], ['brokers', 'Brokers']] },
    { title: 'Finance', items: [['deals', 'Deals & Sales'], ['revenue', 'Revenue'], ['payroll', 'Payroll']] },
    { title: 'Communication', items: [['teamchat', 'Team chat'], ['messages', 'Legacy messages'], ['updates', 'Team updates']] },
    { title: 'System', items: [['tasks', 'Tasks'], ['settings', 'Settings']] },
  ]
  return all
    .map((sec) => ({
      ...sec,
      items: sec.items.filter(([key]) => canAccessAdminTab(user, key)),
    }))
    .filter((sec) => sec.items.length > 0)
}

export function usesPerformancePanel(user) {
  const role = resolveAccessRole(user)
  if (['cold_caller', 'dispatcher', 'manager', 'team_leader', 'finance'].includes(role)) return false
  const dept = user?.department
  return ['social_media', 'designer', 'animator', 'other'].includes(dept) || role === 'employee'
}
