# ID-691 — Dashboard table hover cursor should not change when there is no action

**For:** Sonnet (implementer)
**Source task:** Asana ID-691 "Hover cursor on Dashboard table should not change if there is no new action"
**Working dir:** `/home/cpride/code/devWork/ULWork/v2/UnlockEdv2`
**Stack:** React + TypeScript + Tailwind CSS, frontend in `frontend/`

---

## Problem

On the admin Dashboard, hovering over rows of the **Facility Health table** changes the mouse
cursor to a pointer (hand) and applies clickable-looking hover styling (the facility name
changes to the brand/accent color). This signals that the row is clickable, but the row has
**no `onClick` handler and no navigation** — nothing happens when clicked. This false affordance
is the bug shown in the attached `dashboard_cursor_err.mp4`.

Desired rule: **the cursor (and clickable hover affordances) should only change on hover when the
row actually has an action.**

## Root cause (confirmed)

File: `frontend/src/pages/Dashboard.tsx`
Component: `FacilityHealthTable` (lines ~581–703)

The `<tr>` is rendered with `cursor-pointer` and link-colored hover text, but has **no `onClick`**:

```tsx
// Dashboard.tsx ~line 634-642
{rows.map((row) => (
    <tr
        key={row.facility_id}
        className="hover:bg-surface-hover/50 dark:hover:bg-[#262626]/50 cursor-pointer transition-colors"
    >
        <td className="px-6 py-4">
            <div className="text-brand-dark dark:text-white hover:text-brand dark:hover:text-[#8fb55e] transition-colors">
                {row.facility_name}
            </div>
        </td>
        ...
```

Two misleading affordances:
1. `cursor-pointer` on the `<tr>` — changes the cursor to a hand.
2. `hover:text-brand dark:hover:text-[#8fb55e]` on the facility-name `<div>` — makes the name
   look like a link on hover.

The neutral row background highlight (`hover:bg-surface-hover/50 ...`) is fine to keep — it only
indicates the hovered row, not clickability.

## Convention in this codebase (confirms intended fix)

- `frontend/src/components/shared/DataTable.tsx` (~line 102-113): `onRowClick && 'cursor-pointer'`
  — pointer only when a click handler exists.
- `frontend/src/pages/Dashboard.tsx` `MissingAttendanceWidget` (~line 463-480): `cursor-pointer`
  only when `isDepartment` is true, which is also the only case it navigates.
- `frontend/src/components/ui/table.tsx` `TableRow` (~line 55-65): base row has hover background
  but no `cursor-pointer` by default.

Only `FacilityHealthTable` violates this. `TodaysSchedule`, `MissingAttendanceWidget`, and
`MetricCards` already gate cursor/click correctly.

## Implementation plan

The facility rows are not clickable today, so remove the clickable affordances. Do **not** invent
a navigation target — that is a product decision, not part of this bug.

### Step 1 — `FacilityHealthTable` row className (line ~637)

From:
```tsx
className="hover:bg-surface-hover/50 dark:hover:bg-[#262626]/50 cursor-pointer transition-colors"
```
To (drop `cursor-pointer`):
```tsx
className="hover:bg-surface-hover/50 dark:hover:bg-[#262626]/50 transition-colors"
```

### Step 2 — facility-name `<div>` (line ~640)

From:
```tsx
<div className="text-brand-dark dark:text-white hover:text-brand dark:hover:text-[#8fb55e] transition-colors">
    {row.facility_name}
</div>
```
To:
```tsx
<div className="text-brand-dark dark:text-white">
    {row.facility_name}
</div>
```

### Step 3 — sanity scan

Grep `Dashboard.tsx` for any other element pairing `cursor-pointer` with no `onClick`/navigation.
Per investigation, only `FacilityHealthTable` is wrong — confirm.

## Verification

1. `cd frontend && npm run typecheck` and `npm run lint` — no new errors (className-only changes).
2. Run the app, open the admin Dashboard, hover Facility Health rows:
   - Cursor stays the default arrow (no hand/pointer).
   - Facility name no longer changes color on hover.
   - Subtle row background highlight on hover is acceptable to keep.
3. Confirm against `dashboard_cursor_err.mp4` that the reported behavior no longer occurs.

## Out of scope / notes

- This fix intentionally does **not** add click navigation to facility rows. If the team later
  decides facility rows should navigate (e.g., to a facility detail view), the correct change is
  to **add** an `onClick`/navigation handler — at which point `cursor-pointer` and the
  link-colored name become correct affordances again. Separate feature, not this bug.
- Keep changes minimal, match surrounding Tailwind style, no new deps.
- Branch off `main` (e.g. `fix/dashboard-hover-cursor`); commit message references ID-691.
  Include a short before/after screen capture in the PR since it's a visual change.
