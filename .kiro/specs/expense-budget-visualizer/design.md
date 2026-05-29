# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a client-side single-page application (SPA) built with pure HTML, CSS, and Vanilla JavaScript. It enables users to record expense transactions, organize them by category, visualize spending distribution via an interactive pie chart, and set per-category spending limits — all without a backend server or build toolchain.

The application runs as a standalone `index.html` file (or from a `file://` URL) and persists all state in the browser's `localStorage`. Chart rendering is delegated to [Chart.js 3.x](https://www.chartjs.org/docs/latest/) loaded from a public CDN.

### Key Design Goals

- **Zero dependencies installed locally** — Chart.js is the only external library, loaded via CDN.
- **Single-file JS module** — all application logic lives in `js/app.js`; all styles in `css/style.css`.
- **Reactive UI without a framework** — state mutations trigger targeted DOM updates rather than full re-renders.
- **Resilient persistence** — corrupt or missing `localStorage` data is handled gracefully with fallback to defaults.

---

## Architecture

The application follows a **Model-View-Controller (MVC)** pattern adapted for a single-file vanilla JS context:

```
┌─────────────────────────────────────────────────────────┐
│                        index.html                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Input_Form  │  │Transaction   │  │  Pie_Chart    │  │
│  │  (View)      │  │  List (View) │  │  (View)       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                  │           │
│  ┌──────▼─────────────────▼──────────────────▼───────┐  │
│  │                  Controller (app.js)               │  │
│  │  - Event listeners                                 │  │
│  │  - Validator                                       │  │
│  │  - UI update orchestration                        │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │                  Model (app.js)                    │  │
│  │  - AppState (in-memory)                            │  │
│  │  - StorageService (localStorage read/write)        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action
    │
    ▼
Event Listener (Controller)
    │
    ▼
Validator (if input form)
    │
    ▼
AppState mutation
    │
    ├──► StorageService.save()   ──► localStorage
    │
    └──► UI Renderer
              ├──► renderTransactionList()
              ├──► renderBalanceDisplay()
              └──► renderPieChart()
```

### Module Structure

```
expense-budget-visualizer/
├── index.html          # Single HTML entry point
├── css/
│   └── style.css       # All styles
└── js/
    └── app.js          # All application logic
```

---

## Components and Interfaces

### 1. AppState (In-Memory Model)

A plain JavaScript object holding the canonical application state. All UI reads from this object; all mutations go through controller functions that also persist to `localStorage`.

```js
const AppState = {
  transactions: [],      // Transaction[]
  categories: [],        // string[] (default + custom)
  spendingLimits: {},    // { [categoryName]: number }
  sortOrder: 'insertion' // 'insertion' | 'amount-asc' | 'amount-desc' | 'category-az'
};
```

### 2. StorageService

Encapsulates all `localStorage` interactions. Wraps reads/writes in `try/catch` to handle quota errors and JSON parse failures.

```js
const StorageService = {
  KEYS: {
    TRANSACTIONS: 'ebv_transactions',
    CATEGORIES:   'ebv_categories',
    LIMITS:       'ebv_spending_limits'
  },
  save(key, data)  { /* JSON.stringify + localStorage.setItem */ },
  load(key)        { /* localStorage.getItem + JSON.parse, returns null on error */ },
  clear(key)       { /* localStorage.removeItem */ }
};
```

### 3. Validator

Pure functions that validate form inputs and return structured error objects.

```js
const Validator = {
  validateTransaction({ name, amount, category }) {
    // Returns { valid: boolean, errors: { name?, amount?, category? } }
  },
  validateCategory(name, existingCategories) {
    // Returns { valid: boolean, error?: string }
  },
  validateSpendingLimit(value) {
    // Returns { valid: boolean, error?: string }
  }
};
```

### 4. UI Renderers

Functions that read from `AppState` and update the DOM. Each renderer is idempotent — calling it multiple times with the same state produces the same DOM output.

| Function | Responsibility |
|---|---|
| `renderTransactionList()` | Rebuilds the transaction list DOM, applies sort, applies over-limit highlights |
| `renderBalanceDisplay()` | Recalculates and updates the total balance text |
| `renderPieChart()` | Updates Chart.js dataset labels, data, and colors; shows/hides placeholder |
| `renderCategorySelector()` | Rebuilds `<select>` options from `AppState.categories` |
| `renderSpendingLimitIndicators()` | Re-evaluates all categories against limits and updates visual indicators |

### 5. ChartManager

Wraps the Chart.js instance lifecycle.

```js
const ChartManager = {
  instance: null,
  init(canvasId)  { /* new Chart(...) */ },
  update(data)    { /* instance.data = ...; instance.update() */ },
  destroy()       { /* instance.destroy() */ }
};
```

Chart.js CDN URL (version 4.x is backward-compatible with 3.x config syntax):
```
https://cdn.jsdelivr.net/npm/chart.js
```

### 6. Event Handlers (Controller)

Registered in a `DOMContentLoaded` listener:

| Event | Handler | Action |
|---|---|---|
| `#transaction-form` submit | `handleAddTransaction` | Validate → mutate AppState → persist → render |
| `#add-category-form` submit | `handleAddCategory` | Validate → mutate AppState → persist → render |
| `.delete-btn` click (delegated) | `handleDeleteTransaction` | Mutate AppState → persist → render |
| `#sort-select` change | `handleSortChange` | Update `AppState.sortOrder` → render list |
| `#limit-form` submit | `handleSetSpendingLimit` | Validate → mutate AppState → persist → render |

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id         - UUID v4 (crypto.randomUUID() or fallback)
 * @property {string} name       - Item name, 1–100 characters
 * @property {number} amount     - Positive number, max 2 decimal places
 * @property {string} category   - Category name string
 * @property {number} createdAt  - Unix timestamp (Date.now()) for insertion order
 */
```

### Category

Categories are stored as a plain `string[]` in `AppState.categories`. Default categories are seeded on first load if `localStorage` has no saved list:

```js
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
```

### SpendingLimit

```js
/**
 * @typedef {Object} SpendingLimits
 * A plain object mapping category name → numeric limit.
 * { [categoryName: string]: number }
 * Example: { "Food": 500.00, "Transport": 150.00 }
 */
```

### LocalStorage Schema

| Key | Type | Description |
|---|---|---|
| `ebv_transactions` | `Transaction[]` (JSON) | All recorded transactions |
| `ebv_categories` | `string[]` (JSON) | Custom categories only (defaults re-seeded on load) |
| `ebv_spending_limits` | `{ [cat]: number }` (JSON) | Per-category spending limits |

### Validation Rules

| Field | Rule |
|---|---|
| Transaction name | Non-empty string, max 100 chars |
| Transaction amount | Positive finite number > 0, max 2 decimal places |
| Transaction category | Must be a non-empty string present in `AppState.categories` |
| Custom category name | 1–50 chars, case-insensitive unique across all categories |
| Spending limit | Finite number in range [0.01, 999999999.99] |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction is always persisted and reflected in the list

*For any* valid transaction (non-empty name, positive amount, known category), after it is added, the transaction list rendered in the DOM and the data retrieved from `localStorage` SHALL both contain an entry matching that transaction's name, amount, and category.

**Validates: Requirements 1.3, 1.5, 2.3, 5.1**

---

### Property 2: Invalid transaction is always rejected

*For any* transaction input where at least one field is invalid (empty name, non-positive or non-numeric amount, or no category selected), the Validator SHALL return `valid: false`, the transaction list length SHALL remain unchanged, and `localStorage` SHALL NOT be updated.

**Validates: Requirements 1.3, 1.4**

---

### Property 3: Balance display equals sum of all transaction amounts

*For any* collection of transactions, the value shown in the Balance_Display SHALL equal the arithmetic sum of all transaction amounts, formatted to two decimal places.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

### Property 4: Pie chart segments are proportional to category totals

*For any* non-empty collection of transactions grouped by category, each pie chart segment's proportional size SHALL equal that category's total amount divided by the sum of all transaction amounts.

**Validates: Requirements 4.1, 4.2**

---

### Property 5: Deletion removes transaction from list and storage

*For any* transaction that exists in `AppState.transactions`, after it is deleted, neither the DOM transaction list nor `localStorage` SHALL contain an entry with that transaction's `id`.

**Validates: Requirements 2.4, 2.5, 5.2**

---

### Property 6: Whitespace-only and empty category names are rejected

*For any* string composed entirely of whitespace characters (or the empty string), submitting it as a custom category name SHALL be rejected, the category list SHALL remain unchanged, and `localStorage` SHALL NOT be updated.

**Validates: Requirements 6.5**

---

### Property 7: Duplicate category names are rejected (case-insensitive)

*For any* category name that already exists in `AppState.categories` (compared case-insensitively), attempting to add it again SHALL be rejected, the category list length SHALL remain unchanged, and `localStorage` SHALL NOT be updated.

**Validates: Requirements 6.5**

---

### Property 8: Sorting preserves all transactions and changes only display order

*For any* sort option applied to a non-empty transaction list, the sorted list SHALL contain exactly the same set of transaction `id`s as the unsorted list, with no additions or removals.

**Validates: Requirements 7.1, 7.2**

---

### Property 9: Over-limit highlighting is consistent between list and chart

*For any* category where the sum of transaction amounts exceeds the configured Spending_Limit, ALL transactions in that category in the Transaction_List SHALL carry the over-limit visual indicator, AND the corresponding Pie_Chart segment SHALL carry its over-limit visual indicator.

**Validates: Requirements 8.2, 8.3, 8.7**

---

### Property 10: Spending limit round-trip persistence

*For any* valid spending limit value set for a category, after the page is reloaded, the value retrieved from `localStorage` and restored into `AppState.spendingLimits` SHALL equal the originally saved value.

**Validates: Requirements 8.5**

---

### Property 11: LocalStorage round-trip preserves transaction data

*For any* list of valid transactions written to `localStorage` via `StorageService.save()`, reading them back via `StorageService.load()` SHALL produce an array of objects with identical `id`, `name`, `amount`, `category`, and `createdAt` fields.

**Validates: Requirements 5.1, 5.2, 5.3**

---

## Error Handling

### Corrupt localStorage Data

On initialization, each `StorageService.load()` call is wrapped in `try/catch`. If `JSON.parse` throws or the parsed value is not the expected type:

- **Transactions**: discard, initialize with `[]`, display a visible error banner (e.g., "Saved transaction data could not be loaded.").
- **Custom categories**: discard, initialize with `DEFAULT_CATEGORIES` only, continue silently.
- **Spending limits**: discard, initialize with `{}`, continue silently.

### Partial Render Failure

If one UI renderer throws (e.g., Chart.js canvas not found), the error is caught and logged to `console.error`. The remaining renderers continue executing so the rest of the UI remains functional (Requirement 5.5).

### Form Validation Errors

Inline error messages are injected adjacent to the invalid field using `aria-live="polite"` regions so screen readers announce them. Errors are cleared on the next successful submission or when the user modifies the field.

### localStorage Quota Exceeded

If `localStorage.setItem` throws a `QuotaExceededError`, the app displays a non-blocking toast notification: "Storage limit reached. New data could not be saved." The in-memory `AppState` remains updated so the UI stays consistent for the current session.

---

## Testing Strategy

### Unit Tests (Example-Based)

Focus on specific behaviors and edge cases:

- `Validator.validateTransaction` with boundary inputs (empty name, amount = 0, amount = -1, amount = 0.001 decimal precision).
- `Validator.validateCategory` with empty string, whitespace-only, duplicate (same case), duplicate (different case).
- `Validator.validateSpendingLimit` with 0, 0.01, 999999999.99, 1000000000, NaN, "abc".
- `StorageService.load` when `localStorage` contains malformed JSON.
- `renderBalanceDisplay` with zero transactions, one transaction, multiple transactions.
- Sort functions: tie-breaking by `createdAt` when amounts or categories are equal.
- Empty-state rendering: transaction list shows "No transactions yet" when `AppState.transactions` is empty.

### Property-Based Tests

The application is well-suited for property-based testing because its core logic consists of pure functions (Validator, sort, balance calculation, category aggregation) with large input spaces.

**Recommended library**: [fast-check](https://fast-check.dev/) (works in browser via CDN or Node.js for test runner).

Each property test runs a **minimum of 100 iterations**.

Tag format: `Feature: expense-budget-visualizer, Property {N}: {property_text}`

| Property | Test Description |
|---|---|
| Property 1 | Generate random valid transactions; verify list and storage contain them after add |
| Property 2 | Generate random invalid inputs; verify rejection and no state mutation |
| Property 3 | Generate random transaction arrays; verify `sum(amounts) === parseFloat(balanceText)` |
| Property 4 | Generate random transactions; verify each segment's data value equals category total |
| Property 5 | Generate random transaction sets; pick random id to delete; verify removal from state and storage |
| Property 6 | Generate whitespace/empty strings; verify category rejection |
| Property 7 | Generate category lists with duplicates (varied casing); verify rejection |
| Property 8 | Generate random transactions + sort option; verify sorted array is a permutation of original |
| Property 9 | Generate transactions + limits where some categories exceed limit; verify all indicators present |
| Property 10 | Generate random limit values; save then reload; verify round-trip equality |
| Property 11 | Generate random transaction arrays; serialize then deserialize; verify field-level equality |

### Integration / Smoke Tests

- Open `index.html` via `file://` URL in Chrome, Firefox, Edge, Safari — verify no console errors on load.
- Verify Chart.js CDN loads and `window.Chart` is defined before `DOMContentLoaded` fires.
- Verify `localStorage` keys are written after adding a transaction.
- Verify page reload restores all transactions, categories, and spending limits.
