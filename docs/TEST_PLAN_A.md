# QA test cases - N7 - nguoi A (nen screenshot/ghi video)

Use mock mode first (no .env) then switch to real Supabase once B is ready.

| ID | Task | Steps | Expected |
|---|---|---|---|
| T01 | A01 | `npx expo start` then `a` | App opens on Android Emulator |
| T02 | A03 | Home -> All products -> Details -> Back | No routing error; A/C routes exist |
| T03 | A04 | Open Home | Hero, first 4 featured products visible |
| T04 | A04 | Open products, type "áo" | Filters product names, no crash |
| T05 | A04 | Change category tabs | Product list filters correctly |
| T06 | A04 | Detail: select S/M/L and color | SKU changes according to selected variant |
| T07 | A04 | Switch branches | Stock and remaining update by selected SKU+branch |
| T08 | A04 | Product p03, size 30, branch b01 | Stock = 0, add-to-cart disabled (in mock mode) |
| T09 | A05 | With no .env | Mock badge displayed, 5 products and 3 branches |
| T10 | A05 | Real URL/key, B seed and RLS read allowed | 5 DB products shown, mock badge disappears |
| T11 | A05 | Real URL/key but wrong table/policy | Error with retry, NOT mock data silently |
| T12 | A05 | Real URL/key, empty products table | Empty state visible |
| T13 | A06 | Choose product variant and branch, qty 1 -> Add | Cart item contains correct SKU, branch and quantity |
| T14 | A06 | Add same SKU + same branch again | One row, quantity accumulates up to stock |
| T15 | A06 | Add same SKU from another branch | Separate cart row; stock not mixed |
| T16 | A06 | Increase, decrease and remove cart row | Cart total changes and 0 removes row |
| T17 | A07 | Empty name/phone/address at checkout | Required field messages shown |
| T18 | A07 | Valid name, phone and address -> COD | Demo alert shown; does not write orders |
| T19 | A07 | `npx tsc --noEmit` | No TS errors after dependencies installed |
| T20 | A07 | Another team member clone then npm install | Reproduces the same Expo app |

**Caveat:** The cart's maxAvailable is a UI snapshot; it is not a stock reservation. Before real checkout, a trusted backend/server procedure must revalidate and atomically modify inventory.
