# chore: replace Tailwind v4 arbitrary values with canonical class names

## Why

Since adopting Tailwind v4 the project's default spacing scale now includes built-in
equivalents for many arbitrary values previously required (e.g. `z-[100]` → `z-100`,
`w-[160px]` → `w-40`, `max-h-[400px]` → `max-h-100`). The VS Code Tailwind CSS
IntelliSense extension (`suggestCanonicalClasses` / owner: `tailwindcss-intellisense`)
fires a warning on every one of these occurrences. These warnings surface in every PR
that touches the file, creating ongoing noise and inconsistency across the codebase.
This task cleans them up app-wide in one dedicated sweep rather than piecemeal in every PR.

## No visual regression risk

Every replacement is a pure alias — the compiled CSS output is bit-for-bit identical.
`w-[160px]` and `w-40` both emit `width: 10rem`; `rounded-[4px]` and `rounded-1`
both emit `border-radius: 0.25rem`. The Figma-matched layout is completely unchanged.

## Conversion rule

```
arbitrary [Npx]  →  canonical -[N÷4]    (only when N is divisible by 4)
z-[N]            →  z-N                 (integer z-index values)
[calc(...)], hex colors, viewport units  →  leave unchanged (no canonical form)
```

## Scan result — 52 actionable replacements across 27 files

Exhaustiveness verified: a follow-up pass checked `ring-[Npx]`, `rounded-[Npx]`,
`translate-y-[Npx]`, and `text-[Npx]`. Only `rounded-[4px]` → `rounded-1` was
newly actionable (3 occurrences). All other newly found patterns are non-divisible-by-4
values with no canonical equivalent.

### Z-index (2)
| File | Current | Canonical |
|------|---------|-----------|
| `pages/class-detail/RosterTab.tsx:424` | `z-[100]` | `z-100` |
| `components/ui/navigation-menu.tsx:148` | `z-[1]` | `z-1` |

### Width (11 files, ~18 occurrences)
| File | Current → Canonical |
|------|---------------------|
| `pages/admin/resident-profile/DetailedAttendanceDialog.tsx` | `w-[100px]`→`w-25`, `w-[120px]`→`w-30` (×2) |
| `components/ui/drawer.tsx` | `w-[100px]`→`w-25` |
| `pages/class-detail/RosterTab.tsx` | `w-[140px]`→`w-35` |
| `pages/ClassesPage.tsx` | `w-[140px]`→`w-35`, `w-[180px]`→`w-45`, `w-[200px]`→`w-50` (×2), `w-[220px]`→`w-55` (×2) |
| `pages/program-detail/ProgramOverviewFacilityAdmin.tsx` | `w-[140px]`→`w-35` |
| `pages/class-detail/SupportTab.tsx` | `w-[160px]`→`w-40` |
| `pages/class-detail/EnrollmentHistoryTab.tsx` | `w-[160px]`→`w-40` |
| `components/charts/OperationalInsightsCharts.tsx` | `w-[160px]`→`w-40`, `w-[200px]`→`w-50` |
| `components/student/ActivityHistoryCard.tsx` | `w-[160px]`→`w-40` |
| `pages/programs/ProgramsPage.tsx` | `w-[220px]`→`w-55` (×2), `w-[240px]`→`w-60` (×2) |
| `components/schedule/SessionDetailSheet.tsx` | `w-[400px]`→`w-100`, `w-[500px]`→`w-125` |
| `pages/auth/Login.tsx` | `w-[420px]`→`w-105`, `w-[520px]`→`w-130` |

### Min-width (8 canonical — skip non-integer results like `min-w-[70px]`=17.5)
| File | Current → Canonical |
|------|---------------------|
| `pages/admin/resident-profile/DetailedAttendanceDialog.tsx` | `min-w-[100px]`→`min-w-25` |
| `pages/class-detail/AuditTab.tsx` | `min-w-[80px]`→`min-w-20` |
| `pages/class-detail/TakeAttendanceModal.tsx` | `min-w-[80px]`→`min-w-20` |
| `pages/ClassesPage.tsx` | `min-w-[80px]`→`min-w-20`, `min-w-[100px]`→`min-w-25` (×2) |
| `pages/program-detail/ClassesTab.tsx` | `min-w-[100px]`→`min-w-25` |
| `pages/programs/ClassEvents.tsx` | `min-w-[160px]`→`min-w-40` |
| `pages/programs/ProgramOverviewFacilityAdmin.tsx` | `min-w-[180px]`→`min-w-45` |
| `pages/Dashboard.tsx` | `min-w-[200px]`→`min-w-50` (×4) |
| `components/student/ActivityHistoryCard.tsx` | `min-w-[200px]`→`min-w-50` |
| `components/knowledge-center/OpenContentItemAccordion.tsx` | `min-w-[300px]`→`min-w-75` |
| `components/ui/command.tsx` | `min-w-[500px]`→`min-w-125` |
| `pages/event-attendance/index.tsx` | `min-w-[300px]`→`min-w-75` |

### Height (3)
| File | Current → Canonical |
|------|---------------------|
| `components/charts/OperationalInsightsCharts.tsx` | `h-[280px]`→`h-70` |
| `pages/auth/Login.tsx` | `h-[420px]`→`h-105`, `h-[520px]`→`h-130` |

### Min-height (2)
| File | Current → Canonical |
|------|---------------------|
| `pages/class-detail/ScheduleTab.tsx` | `min-h-[80px]`→`min-h-20` |
| `pages/event-attendance/index.tsx` | `min-h-[80px]`→`min-h-20` |

### Max-height (4 canonical)
| File | Current → Canonical |
|------|---------------------|
| `pages/class-detail/EditClassModal.tsx` | `max-h-[300px]`→`max-h-75` (leave `max-h-[90vh]` as-is) |
| `pages/program-detail/EditProgramDialog.tsx` | `max-h-[300px]`→`max-h-75` (leave `max-h-[90vh]` as-is) |
| `pages/event-attendance/AttendanceRow.tsx` | `max-h-[400px]`→`max-h-100`, `max-h-[800px]`→`max-h-200` |

### Max-width (2 canonical — skip `max-w-[250px]`=62.5 non-integer)
| File | Current → Canonical |
|------|---------------------|
| `pages/class-detail/ScheduleTab.tsx` | `max-w-[600px]`→`max-w-150` |
| `pages/class-detail/ScheduleTab.tsx` | `max-w-[700px]`→`max-w-175` |

### Rounded (3 canonical — skip `rounded-[1px]` and `rounded-[2px]` non-integer)
| File | Current → Canonical |
|------|---------------------|
| `pages/programs/ProgramsPage.tsx:645,704,869` | `rounded-[4px]`→`rounded-1` |

## Out of scope — intentionally kept as arbitrary values

These have no canonical equivalent and must not be changed:

| Pattern | Reason |
|---------|--------|
| `min-w-[70px]`, `min-w-[130px]`, `min-w-[250px]`, `max-w-[250px]` | Non-integer spacing result |
| `pt-[34px]` | 34÷4=8.5, non-integer |
| `rounded-[1px]`, `rounded-[2px]` | Not divisible by 4 |
| `ring-[1px]`, `ring-[3px]` | Not divisible by 4 |
| `translate-y-[2px]` | Not divisible by 4 |
| `text-[10px]` | 10÷4=2.5, non-integer |
| `opacity-[0.07]` | No standard opacity scale entry |
| `max-h-[90vh]` | Viewport unit — no canonical form |
| `top-[1px]`, `p-[3px]` | Not divisible by 4 |
| All `calc(...)` values | No canonical form |
| All hex color values | No canonical form |

## Verification (after implementation)

Build check — should pass with zero errors:
```bash
cd frontend && npm run build
```

Zero-warning grep:
```bash
grep -rn 'z-\[[0-9]\+\]' frontend/src
grep -rn '\(h\|w\|max-w\|min-w\|max-h\|min-h\|rounded\)-\[[0-9]\+px\]' frontend/src
```
Both should return zero results.

## Notes

- `components/ui/` files (e.g. `command.tsx`, `drawer.tsx`, `navigation-menu.tsx`) are project-owned shadcn components — fix them the same as application code
- `class-detail/index.tsx` `z-[100]` and `Schedule.tsx` `h-[600px]` / `max-w-[1400px]` were already fixed in branch `cpride/class-detail-a11y` (ID-640)
- Asana task metadata: Type=Chore/Tech debt · Impact=Low/Limited · Complexity=Small · No dependencies
