-- Run this whole file once in the Supabase SQL Editor (Database → SQL Editor → New query).
-- Creates the 4 tables the app doesn't have yet (staffing, leave, payroll, calendar events)
-- and seeds them with the same demo data the app currently keeps in localStorage, so the
-- switch to Supabase doesn't start everyone back at zero.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING throughout.

-- ============================================================================
-- staffing_assignments  (src/data/staffing.ts → Assignment)
-- ============================================================================
create table if not exists staffing_assignments (
  id text primary key,
  person_id text not null,
  project_id text not null,
  hours_per_week numeric not null,
  start_date date not null,
  open_ended boolean not null default true,
  note text
);

alter table staffing_assignments enable row level security;

drop policy if exists "allow all" on staffing_assignments;
create policy "allow all" on staffing_assignments for all using (true) with check (true);

insert into staffing_assignments (id, person_id, project_id, hours_per_week, start_date, open_ended, note) values
  ('s1', 'ajith-pathmanathan', 'atlas-launch', 10, '2026-08-31', true, null),
  ('s2', 'ashkar-haris', 'echo-integration', 15, '2026-08-01', true, null),
  ('s3', 'charinda-dissanayake', 'echo-migration', 20, '2026-07-01', true, null),
  ('s4', 'charinda-dissanayake', 'cobalt-launch', 8, '2026-09-01', true, null),
  ('s5', 'faran-siddiqui', 'falcon-launch', 30, '2026-09-07', true, null),
  ('s6', 'faran-siddiqui', 'vantage-crm', 30, '2026-08-01', true, null),
  ('s7', 'hashan-wijesinghe', 'legacy-migration', 40, '2025-11-01', false, 'Backfilled while hiring'),
  ('s8', 'priya-nair', 'atlas-launch', 8, '2026-09-10', true, null),
  ('s9', 'dinusha-randika', 'beacon-support', 5, '2026-01-01', true, null),
  ('s10', 'yuki-tanaka', 'vantage-crm', 20, '2026-08-01', true, null),
  ('s11', 'isabela-costa', 'nimbus-onboarding', 18, '2026-09-01', true, null),
  ('s12', 'kwame-mensah', 'pinecrest-crm', 22, '2026-06-01', true, null),
  ('s13', 'kwame-mensah', 'vertex-data-lake', 20, '2026-08-01', true, null),
  ('s14', 'nadia-rahman', 'orbit-analytics', 40, '2026-07-20', false, 'QA coverage through GA'),
  ('s15', 'felix-huber', 'orbit-analytics', 15, '2026-07-20', true, null),
  ('s16', 'felix-huber', 'talon-security-audit', 10, '2026-09-20', true, null),
  ('s17', 'meera-pillai', 'orbit-analytics', 12, '2026-07-20', true, null),
  ('s18', 'devon-marsh', 'pinecrest-crm', 16, '2026-06-01', true, null),
  ('s19', 'grace-kim', 'summit-partnership', 25, '2026-09-15', true, null),
  ('s20', 'fatima-al-sayed', 'union-hr-portal', 30, '2026-05-15', true, null),
  ('s21', 'rohan-kapoor', 'union-hr-portal', 38, '2026-05-15', true, null),
  ('s22', 'chloe-dubois', 'westgate-retainer', 8, '2026-01-01', true, null)
on conflict (id) do nothing;

-- ============================================================================
-- leave_requests  (src/data/leave.ts → LeaveRequest)
-- `date` is kept as the app's own display string ("14-Sep-2026"), not a real
-- date column — the app's parseLeaveDate() already parses exactly that format.
-- (The ld1–ld8 "demo absences" in leave.ts are generated fresh relative to
-- "this week" every page load and are intentionally NOT persisted here.)
-- ============================================================================
create table if not exists leave_requests (
  id text primary key,
  type text not null,
  date text not null,
  status text not null,
  requested_by text not null,
  days numeric not null
);

alter table leave_requests enable row level security;

drop policy if exists "allow all" on leave_requests;
create policy "allow all" on leave_requests for all using (true) with check (true);

insert into leave_requests (id, type, date, status, requested_by, days) values
  ('l1', 'Unpaid Time Off', '14-Sep-2026', 'Pending', 'Ridhwan Rahman', 1),
  ('l2', 'PTO', '10-Oct-2026', 'Approved', 'Sarah Malik', 2),
  ('l3', 'Sick Leave', '01-Nov-2026', 'Rejected', 'Ali Khan', 1),
  ('l4', 'Accrued Public Holiday', '15-Nov-2026', 'Pending', 'Fatima Hussain', 1),
  ('l5', 'Unpaid Time Off', '20-Dec-2026', 'Approved', 'Omar Farooq', 3),
  ('l6', 'Unpaid Time Off', '05-Jan-2027', 'Pending', 'Zeeshan Ali', 1),
  ('l7', 'LIEU', '26-Sep-2026', 'Pending', 'Priya Nair', 1),
  ('l8', 'PTO', '30-Sep-2026', 'Approved', 'Marcus Chen', 5),
  ('l9', 'Sick Leave', '22-Sep-2026', 'Approved', 'Yuki Tanaka', 2),
  ('l10', 'PTO', '18-Oct-2026', 'Rejected', 'Layla Haddad', 4),
  ('l11', 'Accrued Public Holiday', '02-Nov-2026', 'Approved', 'Amina Diallo', 1),
  ('l12', 'Unpaid Time Off', '12-Dec-2026', 'Pending', 'Oliver Bennett', 2),
  ('l13', 'LIEU', '08-Jan-2027', 'Approved', 'Sara Kowalski', 1),
  ('l14', 'PTO', '20-Jan-2027', 'Pending', 'Tomás Rivera', 3),
  ('l15', 'PTO', '24-Oct-2026', 'Approved', 'Pranath', 2),
  ('l16', 'LIEU', '02-Oct-2026', 'Pending', 'Pranath', 1),
  ('l17', 'PTO', '15-Oct-2026', 'Approved', 'Devon Marsh', 3),
  ('l18', 'Sick Leave', '03-Nov-2026', 'Pending', 'Isabela Costa', 1),
  ('l19', 'Unpaid Time Off', '20-Nov-2026', 'Rejected', 'Kwame Mensah', 2),
  ('l20', 'LIEU', '28-Sep-2026', 'Approved', 'Nadia Rahman', 1),
  ('l21', 'PTO', '01-Dec-2026', 'Pending', 'Felix Huber', 4),
  ('l22', 'Accrued Public Holiday', '25-Dec-2026', 'Approved', 'Meera Pillai', 1),
  ('l23', 'PTO', '10-Jan-2027', 'Pending', 'Diego Alvarez', 2),
  ('l24', 'Sick Leave', '14-Oct-2026', 'Approved', 'Grace Kim', 1),
  ('l25', 'Unpaid Time Off', '05-Feb-2027', 'Pending', 'Henrik Larsen', 3),
  ('l26', 'PTO', '19-Nov-2026', 'Approved', 'Aaliyah Johnson', 5),
  ('l27', 'LIEU', '30-Oct-2026', 'Rejected', 'Fatima Al-Sayed', 1),
  ('l28', 'PTO', '22-Dec-2026', 'Pending', 'Rohan Kapoor', 2),
  ('l29', 'Sick Leave', '11-Oct-2026', 'Approved', 'Charinda Dissanayake', 1),
  ('l30', 'Accrued Public Holiday', '07-Nov-2026', 'Pending', 'Ajith Pathmanathan', 1)
on conflict (id) do nothing;

-- ============================================================================
-- calendar_events  (src/data/calendarEvents.ts → CalendarEvent)
-- Read-only from the app's perspective today (no add/edit/delete UI exists yet),
-- same pattern as employment_history — the static array becomes the fallback
-- if this table is ever unreachable, instead of the only source of truth.
-- ============================================================================
create table if not exists calendar_events (
  id text primary key,
  date date not null,
  title text not null,
  category text not null,
  detail text
);

alter table calendar_events enable row level security;

drop policy if exists "allow all" on calendar_events;
create policy "allow all" on calendar_events for all using (true) with check (true);

insert into calendar_events (id, date, title, category, detail) values
  ('ce1', '2026-09-07', 'Labor Day', 'Public Holiday', '🇺🇸 USA'),
  ('ce2', '2026-09-07', 'Labour Day', 'Public Holiday', '🇨🇦 Canada'),
  ('ce3', '2026-09-11', 'Nayrouz', 'Public Holiday', '🇪🇬 Egypt'),
  ('ce4', '2026-09-15', 'Democracy & National Unity Day', 'Public Holiday', '🇹🇷 Turkey'),
  ('ce5', '2026-09-28', 'Milad un-Nabi', 'Public Holiday', '🇱🇰 Sri Lanka'),
  ('ce6', '2026-09-24', 'Company All-Hands', 'Main Event', 'Quarterly update · 4:00 PM'),
  ('ce7', '2026-09-14', 'Aruna Randika''s birthday', 'Birthday', null),
  ('ce8', '2026-09-17', 'Randunu Dimeshan''s birthday', 'Birthday', null),
  ('ce9', '2026-10-03', 'Thanksgiving Day', 'Public Holiday', '🇩🇪 Germany'),
  ('ce10', '2026-10-09', 'Hangul Day', 'Public Holiday', '🇰🇷 South Korea'),
  ('ce11', '2026-10-12', 'Ben Okafor''s work anniversary', 'Main Event', '5 years at Type B'),
  ('ce12', '2026-11-01', 'All Saints Day', 'Public Holiday', '🇫🇷 France'),
  ('ce13', '2026-09-22', 'Isabela Costa''s birthday', 'Birthday', null),
  ('ce14', '2026-10-15', 'All-Hands: Q4 Kickoff', 'Main Event', 'Company update · 4:00 PM')
on conflict (id) do nothing;

-- ============================================================================
-- payroll_periods  (src/data/payroll.ts → PayrollPeriod)
-- Earnings/deductions/adjustments/history are nested objects in the app, kept
-- as jsonb here rather than normalized into their own tables — same approach
-- as time_submissions.history, which already works well for this app.
-- ============================================================================
create table if not exists payroll_periods (
  id text primary key,
  person_id text not null,
  label text not null,
  cycle text not null,
  cycle_start date,
  cycle_end date,
  gross_pay numeric not null,
  actual_hours numeric not null,
  target_hours numeric not null,
  status text not null,
  pay_date date,
  earnings jsonb,
  deductions jsonb,
  adjustments jsonb,
  notes text,
  history jsonb,
  working_days numeric,
  holidays numeric,
  eligible_days numeric,
  pto_hours numeric,
  unpaid_hours numeric,
  timesheet_confirmed boolean,
  timesheet_confirmed_at timestamptz,
  timesheet_confirmed_by text,
  invoice_number text,
  invoice_amount numeric,
  invoice_issued_at date,
  invoice_paid_at date
);

alter table payroll_periods enable row level security;

drop policy if exists "allow all" on payroll_periods;
create policy "allow all" on payroll_periods for all using (true) with check (true);

insert into payroll_periods (
  id, person_id, label, cycle, cycle_start, cycle_end, gross_pay, actual_hours, target_hours, status,
  pay_date, earnings, deductions, adjustments, working_days, holidays, eligible_days, pto_hours,
  unpaid_hours, timesheet_confirmed, timesheet_confirmed_at, timesheet_confirmed_by,
  invoice_number, invoice_amount, invoice_issued_at, invoice_paid_at
) values
  ('pp0', 'pranath-b', 'October 2026', 'Sep 25 – Oct 24', '2026-09-25', '2026-10-24', 4200, 24, 152, 'Timesheet pending',
    null, '{"base":3800,"incentives":250,"bonus":150}', '{"providentFund":200,"salaryAdvance":0,"other":0}', '[]',
    22, 1, 22, 0, 0, false, null, null, null, null, null, null),
  ('pp1', 'pranath-b', 'September 2026', 'Aug 25 – Sep 24', '2026-08-25', '2026-09-24', 4200, 152, 152, 'Under review',
    null, '{"base":3800,"incentives":250,"bonus":150}', '{"providentFund":200,"salaryAdvance":0,"other":0}',
    '[{"type":"Equipment","description":"Monitor reimbursement","date":"2026-09-08","amount":75},{"type":"Software","description":"Annual license reimbursement","date":"2026-09-10","amount":25}]',
    21, 2, 21, 0, 0, true, '2026-09-25T09:10:00.000Z', 'Pranath', null, null, null, null),
  ('pp2', 'pranath-b', 'August 2026', 'Jul 25 – Aug 24', '2026-07-25', '2026-08-24', 4200, 148, 160, 'Approved',
    '2026-08-30', '{"base":3800,"incentives":250,"bonus":150}', '{"providentFund":200,"salaryAdvance":0,"other":0}', '[]',
    21, 0, 21, 8, 0, true, '2026-08-25T09:00:00.000Z', 'Pranath', 'INV-2026-08-001', 4200, '2026-08-25', null),
  ('pp3', 'pranath-b', 'July 2026', 'Jun 25 – Jul 24', '2026-06-25', '2026-07-24', 4200, 160, 160, 'Paid out',
    '2026-07-31', '{"base":3800,"incentives":250,"bonus":150}', '{"providentFund":200,"salaryAdvance":500,"other":0}',
    '[{"type":"Travel","description":"Client site visit reimbursement","date":"2026-07-14","amount":60}]',
    22, 1, 22, 0, 0, true, '2026-06-25T09:00:00.000Z', 'Pranath', 'INV-2026-07-001', 4200, '2026-06-25', '2026-07-31'),
  ('pp4', 'ajith-pathmanathan', 'September 2026', 'Aug 25 – Sep 24', null, null, 879.65, 175.55, 152, 'Under review',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp5', 'ashkar-haris', 'September 2026', 'Aug 25 – Sep 24', null, null, 1600, 0, 160, 'Timesheet pending',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp6', 'hashan-wijesinghe', 'September 2026', 'Aug 25 – Sep 24', null, null, 2200, 160, 160, 'Approved',
    '2026-09-30', '{"base":2000,"incentives":150,"bonus":50}', '{"providentFund":100,"salaryAdvance":0,"other":0}',
    '[{"type":"Equipment","description":"Keyboard reimbursement","date":"2026-09-05","amount":30}]',
    null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp7', 'charinda-dissanayake', 'September 2026', 'Aug 25 – Sep 24', null, null, 640, 0, 160, 'Timesheet pending',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp8', 'devon-marsh', 'September 2026', 'Aug 25 – Sep 24', null, null, 5200, 160, 160, 'Approved',
    '2026-09-30', '{"base":4800,"incentives":300,"bonus":100}', '{"providentFund":250,"salaryAdvance":0,"other":0}', '[]',
    null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp9', 'isabela-costa', 'September 2026', 'Aug 25 – Sep 24', null, null, 3100, 142, 160, 'Under review',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp10', 'kwame-mensah', 'September 2026', 'Aug 25 – Sep 24', null, null, 2900, 176, 160, 'Paid out',
    '2026-09-30', '{"base":2700,"incentives":150,"bonus":50}', '{"providentFund":135,"salaryAdvance":0,"other":0}', '[]',
    null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp11', 'nadia-rahman', 'September 2026', 'Aug 25 – Sep 24', null, null, 2600, 0, 160, 'Timesheet pending',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp12', 'felix-huber', 'September 2026', 'Aug 25 – Sep 24', null, null, 3400, 90, 160, 'Under review',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp13', 'batool-abdullah', 'September 2026', 'Aug 25 – Sep 24', null, null, 2650, 150, 160, 'Approved',
    '2026-09-30', '{"base":2400,"incentives":200,"bonus":50}', '{"providentFund":120,"salaryAdvance":0,"other":0}', '[]',
    null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp14', 'dinusha-randika', 'September 2026', 'Aug 25 – Sep 24', null, null, 2100, 160, 160, 'Paid out',
    '2026-09-30', '{"base":1950,"incentives":100,"bonus":50}', '{"providentFund":100,"salaryAdvance":0,"other":0}', '[]',
    null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp15', 'priya-nair', 'September 2026', 'Aug 25 – Sep 24', null, null, 2300, 40, 160, 'Timesheet pending',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp16', 'chamika-wijeratne', 'September 2026', 'Aug 25 – Sep 24', null, null, 2500, 155, 160, 'Under review',
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null),
  ('pp17', 'yuki-tanaka', 'September 2026', 'Aug 25 – Sep 24', null, null, 3000, 170, 160, 'Approved',
    '2026-09-30', '{"base":2750,"incentives":200,"bonus":50}', '{"providentFund":137,"salaryAdvance":0,"other":0}',
    '[{"type":"Software","description":"IDE license reimbursement","date":"2026-09-12","amount":20}]',
    null, null, null, null, null, null, null, null, null, null, null, null)
on conflict (id) do nothing;
