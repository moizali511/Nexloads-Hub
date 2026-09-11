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
