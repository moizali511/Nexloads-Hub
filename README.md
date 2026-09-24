# NEXLOADS HUB — v2 (clean rebuild)

This is the cleaned, consolidated, error-free rebuild. It's meant to be
deployed to a **brand new Supabase project + a brand new Vercel/hosting
project**, exactly as planned.

## What changed in this rebuild

1. **The "employees won't add" bug is fixed.** All 6 old migration
   files have been collapsed into ONE final `sql/schema.sql`. The old
   setup layered `create or replace function admin_add_employee(...)`
   six times across separate files, each with a different number of
   parameters — if those ever ran out of order, twice, or partially,
   Postgres/PostgREST ends up with more than one version of the same
   function name and can't tell which one to call, which is exactly
   the kind of thing that breaks "Add employee" with no clear error.
   Running one single, final file on a fresh database removes that
   risk completely.

2. **A second real bug got fixed along the way**: `login_employee`
   never returned `position` in the old schema, even though the
   frontend read `data.position` right after login and stored it in
   the session. Every employee's `position` was therefore always
   blank after logging in, which silently broke the old "is this
   person a dispatcher / cold caller" checks that depended on it.
   Fixed — login now returns `position`, `department`, and
   `manager_id` too.

3. **Departments replace fragile text-matching.** The old app guessed
   someone's role by checking if their free-text "position" contained
   the words "dispatch" or "cold caller". That broke the moment
   someone was titled anything else. Every employee now has a proper
   `department` field (Dispatcher, Cold Caller, Social Media Manager,
   Designer, Animator, Operations Manager, Team Leader, Other) that
   reliably drives their dashboard — `position` is still there as a
   free-text job title for display only.

4. **New Hub roles, each with their own space:**
   - **Social Media Manager, Designer, Animator, Operations Manager,
     Team Leader, Other** — each gets a "My Performance" tab to log
     their daily/task output (defaults to a sensible metric per role —
     Posts Published, Designs Completed, etc — but it's editable).
   - **Team Leader / Operations Manager** additionally get a "My Team"
     tab showing this month's numbers for everyone who reports to
     them (set via the new "Reports to" field when adding/editing an
     employee).

5. **Monthly progress graphs, everywhere they were asked for:**
   - Every employee sees their own "My progress" bar chart on their
     Overview tab (this month vs previous months).
   - Admin sees the same chart on each employee's detail page.
   - Admin's own Overview tab has a "Team pulse" list — every active
     employee, this month's number, and the %  change vs last month,
     click through to their full chart.
   - The chart automatically uses the right number per department:
     dispatch fee earned, trucks activated, or logged performance —
     no manual configuration needed.

## Setting up the new, clean accounts

### 1. Supabase (new project)
1. Create a brand new Supabase project.
2. Open the SQL Editor and run **`sql/schema.sql`** — the whole file,
   top to bottom, once. Do not run any other SQL file; there isn't
   one — this is the only migration you need.
3. Uncomment and edit the seed insert near the top of the file (or
   just run it separately) to create your first admin login:
   ```sql
   insert into employees (full_name, email, password_hash, role, department)
   values ('Admin', 'admin@nexloads.com', crypt('ChangeThisPassword123', gen_salt('bf')), 'admin', 'other');
   ```
4. Copy your new project's URL and anon public key (Project Settings →
   API).

### 2. Environment variables
Copy `.env.example` to `.env` and fill in the two Supabase values from
above:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 3. Install & run
```
npm install
npm run dev       # local dev
npm run build     # production build → dist/
```

### 4. Deploy (new Vercel project)
Point a brand new Vercel project at this folder, add the two env vars
above in its Vercel project settings, and deploy. Framework preset:
Vite.

## Notes for whoever manages this going forward
- Every table has RLS enabled with zero policies on purpose — the
  frontend uses the public anon key, but it can only ever reach the
  data through the RPC functions in `schema.sql`, each of which
  checks the caller's identity/role itself. Don't add table policies;
  add another RPC instead if you need a new kind of access.
- If you ever need to change what a role can do, look for the
  matching `admin_*` or `get_my_*` RPC in `schema.sql` — that's the
  single place each permission is enforced.
- New departments can be added by extending the `check` constraint on
  `employees.department` in the SQL, plus the `DEPARTMENTS` list in
  `src/utils/departments.js` on the frontend — those two need to stay
  in sync.

## v3 update — passwords, image attachments, live presence

### What's new
- **Employees can change their own password** (Settings tab on their dashboard) — needs their current password, same as before.
- **Password fields everywhere now have a show/hide eye icon.**
- **Admin can reset any employee's password** without knowing their old one (Employees tab → "Reset password" on their row). This is the safe alternative to storing/showing actual passwords — the database only ever stores a one-way hash, for everyone, no exceptions.
- **Messages can carry an attached screenshot** — a closed deal, a payment receipt, anything. Employees can now also message admin directly (not just receive messages), with or without an image, right from their Messages tab. Admin sees these in the same Messaging screen, clearly labeled, with the image inline.
- **Read receipts** — admin can see who has actually opened/seen each message ("Seen by 3 people", hover for names + times).
- **Live online status + last login** — Employees tab now shows a green pulsing dot next to anyone currently active in the app, "Last seen …" otherwise, and their last login time. Updates automatically every ~15 seconds without reloading the page.

### How to apply this to your already-live Supabase project
You do **not** need a new Supabase project for this. `sql/schema.sql` in this zip is the full, updated file — safe to paste and run in full again on your existing database:
- Every table uses `create table if not exists` and `alter table ... add column if not exists`, so existing tables just get the new columns added; nothing is dropped or wiped.
- Every function uses `create or replace function`, and the one function whose parameters changed (`admin_send_message`) is explicitly dropped and recreated with the new signature first, so there's no repeat of the old function-overload bug.
- Your existing employees, deals, messages, everything — all untouched.

Steps:
1. Supabase → SQL Editor → "+ New query".
2. Paste the **entire** `sql/schema.sql` from this zip.
3. Run it.
4. Push these updated frontend files to your GitHub repo (same repo, same folder structure as before) and let Vercel redeploy automatically — or trigger a redeploy manually from the Vercel dashboard if it doesn't pick it up on its own.

## Migration 001 — audit log, presence, admin time control

For **existing** Supabase projects, run **`sql/migrations/001_foundation_audit_presence_time.sql`** once in the SQL Editor (in addition to your current schema). It adds:

- `audit_logs` + admin audit viewer in the CRM
- Separate **online / away / offline** presence (heartbeat + tab visibility)
- **Clocked-in** flag independent of online status
- **Employment status** (`active`, `inactive`, `on_leave`, `closed`)
- **Admin force clock-out** with required reason + audit entry

The frontend defaults to **light mode** with optional dark/system theme (Settings → Appearance).

## Migrations 002 & 003 — full CRM + team chat

Run in order on Supabase SQL Editor:

1. `sql/migrations/001_foundation_audit_presence_time.sql`
2. `sql/migrations/002_core_crm.sql` — leads, clients, loads, brokers, ops trucks/drivers, calls, follow-ups, tasks, documents, notifications, global search, dashboard stats, RBAC `access_role`
3. `sql/migrations/003_team_chat.sql` — channels, DMs, groups, admin message moderation with audit

**Existing modules preserved:** Deals, cold-caller fleets/trucks, payroll, legacy admin↔employee messages, time clock, team updates.

**New admin areas:** Control center, leads pipeline, operations (clients/loads/trucks/drivers/brokers), revenue, tasks, team chat, expanded overview with date filters.

VoIP and external integrations use `src/services/integrations/` stubs until credentials are configured — no fake live integrations.

## Migrations 004–006 — RBAC menus, alerts, admin employee intel

Run after 001–003 (see **`sql/migrations/README.md`** for the full ordered list):

4. `sql/migrations/004_message_edit_delete_policy.sql`
5. `sql/migrations/005_login_access_role_finance_stats.sql` — session `access_role`, finance/manager revenue RPC
6. `sql/migrations/006_admin_employee_workspace_search.sql` — admin work snapshot + employee search

### Frontend (this repo)

- **Role-based sidebar** — `src/utils/navigation.js`; set **Hub menu permissions** per employee in Admin → Employees.
- **Fixed dark left sidebar**; **Light/Dark** toggle affects only the main panel (top right).
- **Alerts when clocked in** — CRM notifications, legacy messages, team chat: sound + OS notification + in-app toast (`AlertPollerContext`).
- **Admin search** — global search by employee name opens profile with **Work snapshot** (tasks, follow-ups, activity).

Redeploy Vercel after pulling; run SQL on Supabase; have staff **re-login** once.
