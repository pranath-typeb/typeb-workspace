# typeB Workspace

A React + TypeScript + Vite implementation of the Type B OS platform design —
Home dashboard, People, HR (My Leave), and Projects, plus a fully functional
global bottom nav bar.

## Working features

- **Home** — live clock/greeting, Recent Works, Events this week, Who's off,
  a combined weekly-hours tracker, and an Available PTO card with a donut
  ring — all reading from the same shared data as the rest of the app.
- **People** — Directory (search/filter), Profile (details, manager, direct
  reports), Org chart (built live from manager/report relationships), My team
  (reporting line + project teammates), Insights (new joiners, upcoming
  anniversaries, timezones, headcount by department — all computed live), and
  Employee records (searchable list + an editable placement form that saves
  back to the shared people store).
- **HR → My Leave** — leave cycle summary, stat tiles, a request table, and a
  working "Request Leave" / "Request LIEU" modal.
- **Projects** — List (search/filter/stats + Create Project), Detail
  (Deactivate/Reactivate/Delete, linked team roster), Clients (live
  project-count aggregation), and Staffing (List/Timeline views, allocation
  status tabs, and a working Commit Hours flow).
- **Global bottom nav bar** — app switcher (filterable grid), a running
  timer with a save-to-project popup, notifications (with Mark all read),
  a profile menu (Settings/Data/Sign out, Light/Dark/Auto theme), a feedback
  popover, and global people search.
- **Toast notifications** for every add/update/delete across the app.

Data (people, projects, staffing assignments, leave requests) is stored in
`localStorage` per browser — there's no backend or shared database yet, so
changes don't sync across devices or users. HR's Overview/My Letters/Policies/
Benefits sub-pages, and the standalone Time/Payroll/Calendar/Analytics/
Settings/Messages apps, remain placeholders.

## Run it

```bash
cd "untitled folder 2"
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).
