# typeB Workspace

A React + TypeScript + Vite implementation of the Home, People (Directory & Profile),
and HR "My Leave" flow from the design.

## Working features

- **Home** — live clock/greeting, links into People and My Leave, available PTO summary, recent leave activity.
- **People → Directory** — search by name/email/title/department, filter by department, click a card to open a profile.
- **People → Profile** — employee details, manager, and direct reports, all derived from the same data so the reporting line is consistent across people.
- **HR → My Leave** — leave cycle summary, stat tiles (available PTO/LIEU/taken/pending), a request table, and a working "Request Leave" / "Request LIEU" modal that submits a new pending request and updates the stats and Home page live (persisted to `localStorage`).

Other sidebar items (Org chart, My team, Insights, Employee records, HR Overview, My Letters, Policies, Benefits) are present as navigation but show a placeholder — only the four flows above are fully built out per your scope choice.

## Run it

This machine doesn't have Node.js installed, so the app couldn't be built/run in this session. To run it locally:

```bash
cd "untitled folder 2"
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).
