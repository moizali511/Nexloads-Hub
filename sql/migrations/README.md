# Supabase migrations (run in order)

On an **existing** Nexloads Hub database that already has `schema.sql` (or prior migrations), run each file **once**, in numeric order, in the Supabase SQL Editor.

| # | File | What it adds |
|---|------|----------------|
| 001 | `001_foundation_audit_presence_time.sql` | Audit log, presence, employment status, admin force clock-out |
| 002 | `002_core_crm.sql` | CRM tables, RBAC `access_role`, tasks, notifications, global search |
| 003 | `003_team_chat.sql` | Team chat channels, DMs, groups |
| 004 | `004_message_edit_delete_policy.sql` | Chat delete admin-only; edit policies |
| 005 | `005_login_access_role_finance_stats.sql` | Login returns `access_role`; manager/finance revenue stats; `access_role` in employee list |
| 006 | `006_admin_employee_workspace_search.sql` | `admin_get_employee_workspace`; admin-only employee global search |

After **006**, redeploy the Vercel frontend. Users should **log out and back in** so `access_role` is in the browser session.

**Clock-in alerts:** employees must be clocked in for sound + desktop notifications; allow browser notifications when prompted on clock-in.
