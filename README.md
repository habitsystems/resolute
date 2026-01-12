# Prioritise Everything

A tiny, no-backend tool that helps you rank any number of tasks by making simple pairwise choices. Add tasks, click which is more important when shown two at a time, and get a living priority list that updates as you add more tasks.

- Runs locally in your browser
- No account, no external services
- Data is stored on your device (LocalStorage)

---

## How it works

1) Add tasks
- Type a task into the input and press "Add task". Repeat for as many tasks as you like (no limit in the app; practical limits depend on your device/browser).
- Exact duplicates are ignored.

2) Compare pairs
- The app generates every unique unordered pair of tasks and asks you to pick which one is more important.
- You will be asked up to N×(N−1)/2 questions for N tasks. For example:
  - 5 tasks → 10 comparisons
  - 10 tasks → 45 comparisons
  - 20 tasks → 190 comparisons
- Choices are randomized to reduce ordering bias.
- You can undo the last choice if you mis-click.

Why pairs instead of full permutations?
- Showing both (A vs B) and (B vs A) would be redundant; one decision covers that pair. We only ask for each unique pair once.

3) See your ranked list
- The ranking updates after each decision.
- Scoring method:
  - Primary: most pairwise wins (how many times a task was chosen over another)
  - Secondary tie-breaker: fewest losses
  - Next tie-breaker: head-to-head result (if A beat B directly, A ranks above B)
  - Final tie-breaker: alphabetical by normalized task name

Add more tasks later
- You can add new tasks at any time. Only the new comparisons (between the new task and all existing tasks) will be asked. Your past answers are preserved and the ranking updates as you answer.

Reset
- Use "Reset all" to delete all tasks and answers if you want to start fresh.

---

## Directions for completing the form

- Step 1: List everything that’s on your plate. Don’t overthink it—use short names. Examples: "Write Q1 report", "Pay invoices", "Plan sprint".
- Step 2: When two tasks appear, click the one that is more important/urgent to you. If they are truly equal, pick the one you’d do first.
- Step 3: Keep answering until you see "All comparisons are done". You may stop earlier; the rank will still reflect the answers given so far.
- Step 4: Review the ranked list. Add any missing tasks, then answer the new comparisons to refine the list.
- Tips:
  - You can undo your last choice if you mis-clicked.
  - If two tasks keep tying in your mind, rename them to be more specific.

---

## Print or export to PDF

- Click the "Print / PDF" button under the Ranked priorities section.
- In your browser’s print dialog, choose "Save as PDF" to export, or select a physical printer.
- The printed document includes a clean title, timestamp, and your numbered priority list.
- Only the prioritised list is printed; the rest of the app UI is hidden automatically for a tidy result.

---

## Running locally

Requirements
- Node.js 16+ (any recent LTS is fine)

Steps
1. Install dependencies: none required
2. Start the server:
   ```bash
   npm start
   ```
3. Open your browser at:
   - http://localhost:3000

Everything is static and self-contained. The small Node server just serves the files.

---

## Data & privacy

- All data lives in your browser’s LocalStorage under the key `pe_state_v1`.
- Clearing your browser data or clicking "Reset all" removes it.
- No network calls are made; nothing leaves your machine.

---

## Project structure

```
/ (project root)
├─ index.js            # tiny static file server
├─ package.json        # scripts and metadata
├─ README.md           # this file
└─ public/
   ├─ index.html       # UI: add tasks, compare pairs, see rankings
   ├─ app.js           # logic: state, pair generation, ranking, persistence
   └─ style.css        # basic styling
```

---

## Notes on scale and performance

- The number of comparisons grows quadratically with the number of tasks (O(N²)). For very large lists (e.g., 100+ tasks → 4950 comparisons), consider adding tasks in groups and stopping when the ranking feels "good enough" for your needs.
- The app persists partial progress; you don’t have to finish in one sitting.

---

## License

Copyright (c) 2026 Habit Labs

This project is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later).
You should have received a copy of the GNU General Public License along with this program.
If not, see https://www.gnu.org/licenses/.

See the LICENSE file for the full text.

Note: On 2026-01-11, this project was re-licensed from MIT to GPL-3.0-or-later.
