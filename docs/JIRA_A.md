# Checklist/Jira cho nguoi A - Sprint 1

Jira site: https://mobile-nhom-23.atlassian.net/
Sprint trong anh: `Sprint 1 - Week 1 Foundation`, 19-28/10/2026, 20 issues.
N1-N7 trong Excel la thu tu ngay lam viec, khong phai 7 ngay lich co dinh.

| Issue | Task | Proof and acceptance criteria |
|---|---|---|
| A01 (tim issue thuc te) | Repo + Expo | public repo; initial commit; B/C clone and run `npx expo start` |
| SCRUM-6 | A02 common theme/data | `src/theme/theme.ts`; `src/types/shop.ts`; written B/C contract approved |
| SCRUM-7 | A03 components/router | Button, Input, ProductCard; `/`, `/products`, `/products/[id]`, `/cart`, `/checkout`, `/account` work |
| SCRUM-8 | A04 real screens | Home, product list/search/filter, detail; choose size/color/branch from mock data |
| SCRUM-9 | A05 Supabase | product/SKU/inventory loaded; error/loading/empty; RLS SELECT tested on device |
| SCRUM-10 | A06 cart integration | All five DB products displayed; cart item includes `skuId`, `branchId`, `quantity`; C cart consumes correct item |
| SCRUM-11 | A07 testing/handoff | Android/device demo, PR review, README, 1-3 minute video, evidence |

### Procedure per issue
1. Jira: change status from To Do to In Progress when actually starting.
2. Add concise Description, Acceptance Criteria and link to the contract.
3. Create a Git branch including issue key, e.g. `feature/SCRUM-7-shared-components`.
4. Work, test, commit: `git commit -m "SCRUM-7 feat: shared components and navigation"`.
5. Push a Pull Request to `main`; another member reviews.
6. Put PR URL plus screenshots/video link in Jira comment; mark Done after acceptance.

### Dependencies
- SCRUM-9 (A05) is blocked until B04/`SCRUM-15` demo rows and B05/`SCRUM-16` readable RLS are available.
- SCRUM-10 (A06) depends on A04 and C04/`SCRUM-22` (cart contract).
- SCRUM-11 (A07) depends on A06, C06 and B's handoff.
- Public repo + Expo initial commit has already been shown, but the corresponding A01 issue was not visible in Sprint screenshot. Find its actual Jira ID before claiming Done.

### Daily Scrum
- Yesterday: what was merged/demoed?
- Today: what file/task am I changing?
- Blockers: B's DB schema/policy or C's cart contract? Link blocked issues.
