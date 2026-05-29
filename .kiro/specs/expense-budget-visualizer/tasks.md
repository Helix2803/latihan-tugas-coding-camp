# Implementation Plan: Expense & Budget Visualizer

## Overview

This plan implements the Expense & Budget Visualizer — a zero-dependency, single-page web application built with pure HTML, CSS, and Vanilla JavaScript. Tasks are ordered so that foundational infrastructure (file structure, HTML, CSS, data layer) is built before UI features, and tests are written last once all logic is in place.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"],
      "description": "Project scaffold — create directory layout and empty files"
    },
    {
      "wave": 2,
      "tasks": ["2"],
      "description": "HTML skeleton with all sections, IDs, and CDN script tags"
    },
    {
      "wave": 3,
      "tasks": ["3"],
      "description": "CSS styles including layout, list, chart, and over-limit class"
    },
    {
      "wave": 4,
      "tasks": ["4", "5"],
      "description": "StorageService and AppState with default data seeding (independent of each other)"
    },
    {
      "wave": 5,
      "tasks": ["6"],
      "description": "Validator — depends on AppState for category membership checks"
    },
    {
      "wave": 6,
      "tasks": ["7", "11", "12"],
      "description": "Add Transaction handler, Custom Categories, and ChartManager (all depend on Validator and AppState)"
    },
    {
      "wave": 7,
      "tasks": ["8", "9"],
      "description": "Transaction List renderer + Balance Display, and Delete Transaction (depend on Task 7)"
    },
    {
      "wave": 8,
      "tasks": ["10", "13"],
      "description": "Sort Control and Spending Limits feature (depend on list renderer)"
    },
    {
      "wave": 9,
      "tasks": ["14"],
      "description": "Full initialization bootstrap — wires all renderers and event listeners"
    },
    {
      "wave": 10,
      "tasks": ["15"],
      "description": "Error handling and edge cases — wraps all renderers and storage calls"
    },
    {
      "wave": 11,
      "tasks": ["16"],
      "description": "Unit tests — cover all boundary values from the design document"
    },
    {
      "wave": 12,
      "tasks": ["17"],
      "description": "Property-based tests using fast-check — 11 properties, 100+ iterations each"
    }
  ]
}
```

## Tasks

- [x] 1. Set up project file structure
  - Create the directory layout: `expense-budget-visualizer/`, `css/`, `js/`
  - Create empty placeholder files: `index.html`, `css/style.css`, `js/app.js`
  - Verify the folder structure matches the design spec: `index.html` at root, one CSS file in `css/`, one JS file in `js/`
  - **Acceptance**: Directory tree matches the Module Structure defined in the design document; all three files exist

- [x] 2. Build the HTML skeleton in `index.html`
  - Add `<!DOCTYPE html>`, `<html lang>`, `<head>` with charset, viewport meta, title, and `<link>` to `css/style.css`
  - Add CDN `<script>` tag for Chart.js (`https://cdn.jsdelivr.net/npm/chart.js`) before the closing `</body>`; add `<script src="js/app.js" defer></script>` after it
  - Implement the Balance Display section: a `<header>` or `<section>` containing an element with `id="balance-display"` showing total spending
  - Implement the Transaction Input Form (`id="transaction-form"`): text input for item name (`id="expense-name"`, maxlength 100), number input for amount (`id="expense-amount"`), `<select>` for category (`id="category-select"`), and a submit button; include `<span>` elements for inline validation error messages adjacent to each field
  - Implement the Add Category Form (`id="add-category-form"`): text input (`id="new-category"`, maxlength 50) and a submit button; include an error message `<span>`
  - Implement the Spending Limit Form (`id="limit-form"`): a `<select>` to pick the category (`id="limit-category-select"`), a number input for the limit value (`id="limit-value"`), and a submit button; include an error message `<span>`
  - Implement the Sort Control: a `<select>` with `id="sort-select"` containing options for insertion order, amount ascending, amount descending, and category A–Z
  - Implement the Transaction List container: a `<ul>` or `<div>` with `id="transaction-list"` and an empty-state `<p id="empty-state">No transactions yet</p>` inside it
  - Implement the Pie Chart section: a `<canvas id="expense-chart">` wrapped in a container; add a placeholder element `id="chart-placeholder"` with text "No data to display"
  - Add `aria-live="polite"` regions for all inline error message spans to support screen readers
  - **Acceptance**: Opening `index.html` in a browser shows all UI sections without JavaScript errors; all `id` attributes match those referenced in the design document

- [x] 3. Write all CSS styles in `css/style.css`
  - Style the overall page layout (centered container, max-width, font family, background color)
  - Style the Balance Display prominently at the top (large font, clear label)
  - Style the Input Form, Add Category Form, Spending Limit Form, and Sort Control with consistent spacing, input sizing, and button appearance
  - Style the Transaction List: scrollable container (fixed max-height with `overflow-y: auto`), each list item showing name, amount, category, and a delete button
  - Style the empty-state message (centered, muted color)
  - Style the Pie Chart canvas container (centered, responsive width)
  - Style the chart placeholder message (centered, muted color, hidden by default when chart is active)
  - Add a distinct `.over-limit` CSS class for transaction list items that exceed their category spending limit (e.g., red/orange left border or background tint)
  - Add a responsive layout using media queries so the app is usable on mobile viewports (min-width breakpoint at 600 px)
  - **Acceptance**: The page is visually organized, readable, and the `.over-limit` class produces a clearly distinct appearance; layout does not break at 375 px viewport width

- [x] 4. Implement `StorageService` in `js/app.js`
  - Define the `StorageService` object with `KEYS` constants: `TRANSACTIONS = 'ebv_transactions'`, `CATEGORIES = 'ebv_categories'`, `LIMITS = 'ebv_spending_limits'`
  - Implement `StorageService.save(key, data)`: calls `JSON.stringify(data)` and `localStorage.setItem(key, ...)` inside a `try/catch`; on `QuotaExceededError` or any other error, call a `showToast()` helper with the message "Storage limit reached. New data could not be saved."
  - Implement `StorageService.load(key)`: calls `localStorage.getItem(key)` and `JSON.parse(...)` inside a `try/catch`; returns the parsed value on success, or `null` on any error (including malformed JSON)
  - Implement `StorageService.clear(key)`: calls `localStorage.removeItem(key)` inside a `try/catch`
  - **Acceptance**: `StorageService.save` and `StorageService.load` round-trip a sample object correctly; `StorageService.load` returns `null` when given a key with no stored value or with malformed JSON

- [x] 5. Define `AppState` and seed default data in `js/app.js`
  - Define the `AppState` plain object with properties: `transactions: []`, `categories: []`, `spendingLimits: {}`, `sortOrder: 'insertion'`
  - Define `DEFAULT_CATEGORIES` constant: `['Food', 'Transport', 'Fun']`
  - Write an `initAppState()` function that:
    - Loads transactions from `StorageService.load(StorageService.KEYS.TRANSACTIONS)`; if the result is not an array, sets `AppState.transactions = []` and sets a flag to show the corrupt-data error banner
    - Loads custom categories from `StorageService.load(StorageService.KEYS.CATEGORIES)`; if the result is not an array, falls back to `[]` silently
    - Merges loaded custom categories with `DEFAULT_CATEGORIES` (deduplicating case-insensitively) into `AppState.categories`
    - Loads spending limits from `StorageService.load(StorageService.KEYS.LIMITS)`; if the result is not a plain object, falls back to `{}` silently; assigns to `AppState.spendingLimits`
  - **Acceptance**: After calling `initAppState()` with empty `localStorage`, `AppState.categories` equals `['Food', 'Transport', 'Fun']`, `AppState.transactions` equals `[]`, and `AppState.spendingLimits` equals `{}`

- [x] 6. Implement `Validator` in `js/app.js`
  - Implement `Validator.validateTransaction({ name, amount, category })`:
    - `name`: must be a non-empty string after trimming, max 100 characters
    - `amount`: must be a finite number > 0; when parsed from a string, must have at most 2 decimal places (reject values like `1.001`)
    - `category`: must be a non-empty string present in `AppState.categories`
    - Returns `{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }`
  - Implement `Validator.validateCategory(name, existingCategories)`:
    - `name`: must be a non-empty string after trimming, 1–50 characters
    - Must not match any entry in `existingCategories` case-insensitively
    - Returns `{ valid: boolean, error?: string }`
  - Implement `Validator.validateSpendingLimit(value)`:
    - Must be a finite number in the range [0.01, 999999999.99]
    - Returns `{ valid: boolean, error?: string }`
  - **Acceptance**: All validation rules from the design document's Validation Rules table are enforced; boundary values (amount = 0, amount = 0.001, name = 101 chars, limit = 0, limit = 1000000000) are correctly rejected

- [x] 7. Implement the Add Transaction feature
  - Implement `handleAddTransaction(event)`:
    - Prevents default form submission
    - Reads `expense-name`, `expense-amount`, and `category-select` values from the DOM
    - Calls `Validator.validateTransaction()`; if invalid, injects error messages into the corresponding `<span>` elements and returns early
    - On valid input, creates a `Transaction` object: `{ id: crypto.randomUUID(), name: trimmed name, amount: parseFloat(amount), category, createdAt: Date.now() }`
    - Pushes the new transaction to `AppState.transactions`
    - Calls `StorageService.save(StorageService.KEYS.TRANSACTIONS, AppState.transactions)`
    - Calls `renderTransactionList()`, `renderBalanceDisplay()`, `renderPieChart()`, `renderSpendingLimitIndicators()`
    - Resets the form fields (name → `''`, amount → `''`, category selector → default placeholder)
    - Clears any previously shown validation error messages
  - Register the handler on `#transaction-form`'s `submit` event inside `DOMContentLoaded`
  - **Acceptance**: Submitting a valid form adds the transaction to the list and localStorage; submitting an invalid form shows inline errors and does not mutate state; form resets after successful submission

- [x] 8. Implement `renderTransactionList()` and `renderBalanceDisplay()`
  - Implement `renderTransactionList()`:
    - Reads `AppState.transactions` and `AppState.sortOrder`
    - Applies the active sort:
      - `'insertion'`: sort by `createdAt` ascending (oldest first, newest last)
      - `'amount-asc'`: sort by `amount` ascending; tie-break by `createdAt` ascending
      - `'amount-desc'`: sort by `amount` descending; tie-break by `createdAt` ascending
      - `'category-az'`: sort by `category` alphabetically A–Z (case-insensitive); tie-break by `createdAt` ascending
    - If `AppState.transactions` is empty, shows `#empty-state` and hides the list items
    - Otherwise, hides `#empty-state` and renders one `<li>` per transaction containing: item name, formatted amount (e.g., `$12.50`), category badge, and a delete button with `data-id` attribute set to the transaction's `id`
    - Applies the `.over-limit` CSS class to each `<li>` whose category total exceeds `AppState.spendingLimits[category]`
    - Uses event delegation on the list container for delete button clicks (calls `handleDeleteTransaction`)
  - Implement `renderBalanceDisplay()`:
    - Sums all `AppState.transactions` amounts
    - Updates `#balance-display` text to the sum formatted as a fixed 2-decimal string (e.g., `"$0.00"`)
  - **Acceptance**: List renders correctly for 0, 1, and many transactions; balance updates correctly; `.over-limit` class is applied only to transactions in over-limit categories

- [x] 9. Implement the Delete Transaction feature
  - Implement `handleDeleteTransaction(id)`:
    - Filters `AppState.transactions` to remove the entry with the matching `id`
    - Calls `StorageService.save(StorageService.KEYS.TRANSACTIONS, AppState.transactions)`
    - Calls `renderTransactionList()`, `renderBalanceDisplay()`, `renderPieChart()`, `renderSpendingLimitIndicators()`
  - Wire up event delegation on `#transaction-list` for clicks on elements with class `delete-btn`; extract `data-id` and call `handleDeleteTransaction`
  - **Acceptance**: Clicking delete removes the transaction from the DOM and from `localStorage` immediately; balance and chart update accordingly; no confirmation dialog is shown

- [x] 10. Implement the Sort Control
  - Implement `handleSortChange(event)`:
    - Reads the selected value from `#sort-select`
    - Updates `AppState.sortOrder` to the new value
    - Calls `renderTransactionList()`
  - Register the handler on `#sort-select`'s `change` event inside `DOMContentLoaded`
  - Ensure `renderTransactionList()` (from Task 8) correctly applies all four sort options with tie-breaking by `createdAt`
  - **Acceptance**: Changing the sort dropdown reorders the list within 100 ms; all four sort options produce the correct order; tie-breaking by `createdAt` works correctly

- [x] 11. Implement `ChartManager` and `renderPieChart()`
  - Implement `ChartManager`:
    - `ChartManager.instance`: holds the Chart.js instance (initially `null`)
    - `ChartManager.init(canvasId)`: creates a new `Chart` instance of type `'pie'` on the canvas; stores it in `ChartManager.instance`
    - `ChartManager.update(labels, data, colors, overLimitFlags)`: updates `instance.data.labels`, `instance.data.datasets[0].data`, `instance.data.datasets[0].backgroundColor`, and applies a distinct border style for over-limit segments; calls `instance.update()`
    - `ChartManager.destroy()`: calls `instance.destroy()` if instance exists and sets `instance = null`
  - Implement `renderPieChart()`:
    - Aggregates `AppState.transactions` by category: `{ [category]: totalAmount }`
    - If no transactions exist (or all totals are 0), shows `#chart-placeholder` and hides the canvas; returns early
    - Otherwise, hides `#chart-placeholder` and shows the canvas
    - Assigns a deterministic color per category from a fixed palette array (cycling if needed)
    - Determines which categories exceed their spending limit (for over-limit visual distinction)
    - Calls `ChartManager.update(labels, data, colors, overLimitFlags)` if the chart is already initialized, or `ChartManager.init('expense-chart')` followed by `ChartManager.update(...)` on first render
  - Wrap the entire `renderPieChart()` body in `try/catch`; on error, log to `console.error` and return without throwing
  - **Acceptance**: Chart renders with correct proportional segments; placeholder shows when no transactions exist; over-limit segments are visually distinct; chart updates within 1 second of any transaction change

- [x] 12. Implement Custom Categories feature
  - Implement `renderCategorySelector()`:
    - Clears and rebuilds the `<option>` elements in `#category-select` and `#limit-category-select` from `AppState.categories`
    - Preserves a default placeholder option (e.g., `"-- Select Category --"`) as the first option with an empty value
  - Implement `handleAddCategory(event)`:
    - Prevents default form submission
    - Reads the value from `#new-category`
    - Calls `Validator.validateCategory(name, AppState.categories)`; if invalid, injects the error message into the category error `<span>` and returns early
    - Pushes the trimmed category name to `AppState.categories`
    - Calls `StorageService.save(StorageService.KEYS.CATEGORIES, AppState.categories.filter(c => !DEFAULT_CATEGORIES.includes(c)))` (persist only custom categories)
    - Calls `renderCategorySelector()`
    - Resets `#new-category` input and clears the error span
  - Register the handler on `#add-category-form`'s `submit` event inside `DOMContentLoaded`
  - **Acceptance**: Adding a valid category appends it to both selectors and persists it; duplicate (case-insensitive) and empty names are rejected with an error message; default categories are always present

- [x] 13. Implement Spending Limits feature
  - Implement `renderSpendingLimitIndicators()`:
    - For each category in `AppState.categories`, compute the sum of `AppState.transactions` amounts for that category
    - Compare the sum against `AppState.spendingLimits[category]` (if defined)
    - Re-applies `.over-limit` class to all `<li>` elements in `#transaction-list` whose category is over-limit
    - Triggers `renderPieChart()` to refresh over-limit segment styling
  - Implement `handleSetSpendingLimit(event)`:
    - Prevents default form submission
    - Reads the selected category from `#limit-category-select` and the value from `#limit-value`
    - Calls `Validator.validateSpendingLimit(value)`; if invalid, injects the error message into the limit error `<span>` and returns early
    - Sets `AppState.spendingLimits[category] = parseFloat(value)`
    - Calls `StorageService.save(StorageService.KEYS.LIMITS, AppState.spendingLimits)`
    - Calls `renderSpendingLimitIndicators()` and `renderPieChart()`
    - Resets the limit form fields and clears the error span
  - Register the handler on `#limit-form`'s `submit` event inside `DOMContentLoaded`
  - **Acceptance**: Setting a limit for a category immediately highlights over-limit transactions and chart segments; updating a limit re-evaluates immediately; invalid limit values are rejected with an error message; limits persist across page reloads

- [x] 14. Implement app initialization and full persistence bootstrap
  - Write the main `init()` function called inside `DOMContentLoaded`:
    1. Call `initAppState()` (Task 5) to load all data from `localStorage`
    2. If the corrupt-transactions flag was set during `initAppState()`, show a visible error banner (`id="error-banner"`) with the message "Saved transaction data could not be loaded."
    3. Call `renderCategorySelector()` to populate both category `<select>` elements
    4. Call `renderTransactionList()` to render loaded transactions
    5. Call `renderBalanceDisplay()` to show the loaded total
    6. Call `renderPieChart()` to render the loaded chart
    7. Call `renderSpendingLimitIndicators()` to apply any loaded over-limit highlights
    8. Register all event listeners: `#transaction-form` submit, `#add-category-form` submit, `#limit-form` submit, `#sort-select` change, `#transaction-list` click (delegated delete)
  - Implement `showToast(message)`: creates a temporary toast `<div>` appended to `<body>`, displays the message for ~3 seconds, then removes itself from the DOM
  - **Acceptance**: On page load with existing `localStorage` data, all transactions, categories, spending limits, and over-limit highlights are correctly restored; on first load (empty storage), the app shows the empty state with default categories; the error banner appears only when transaction data is corrupt

- [x] 15. Implement error handling and edge cases
  - Wrap each UI renderer call in individual `try/catch` blocks inside `init()` and inside each event handler; on error, log to `console.error` and continue executing the remaining renderers (Requirement 5.5)
  - Ensure `StorageService.save` catches `QuotaExceededError` and calls `showToast("Storage limit reached. New data could not be saved.")` without throwing
  - Ensure `StorageService.load` returns `null` (not throws) for any parse or access error
  - Add a `crypto.randomUUID` fallback for browsers that do not support it: generate a UUID-like string using `Math.random()` if `crypto.randomUUID` is undefined
  - Verify that opening `index.html` via `file://` URL produces no console errors on load
  - **Acceptance**: Simulating a corrupt `localStorage` value for transactions shows the error banner; simulating a `QuotaExceededError` shows the toast; a renderer error does not prevent other renderers from running; the app loads without errors from a `file://` URL

- [x] 16. Write unit tests for core logic
  - Set up a test environment using Node.js built-in `node:test` and `assert` modules (no build tools required); create `js/app.test.js`
  - Write unit tests for `Validator.validateTransaction`:
    - Empty name → invalid
    - Name of exactly 100 characters → valid
    - Name of 101 characters → invalid
    - Amount = 0 → invalid
    - Amount = -1 → invalid
    - Amount = 0.001 (3 decimal places) → invalid
    - Amount = 0.01 → valid
    - Amount = 1.005 → invalid (3 decimal places)
    - Category not in list → invalid
    - All fields valid → valid
  - Write unit tests for `Validator.validateCategory`:
    - Empty string → invalid
    - Whitespace-only string → invalid
    - Name of 51 characters → invalid
    - Name of 50 characters → valid
    - Duplicate (same case) → invalid
    - Duplicate (different case) → invalid
    - Unique name → valid
  - Write unit tests for `Validator.validateSpendingLimit`:
    - 0 → invalid
    - 0.01 → valid
    - 999999999.99 → valid
    - 1000000000 → invalid
    - NaN → invalid
    - `"abc"` → invalid
  - Write unit tests for `StorageService`:
    - `load` with malformed JSON returns `null`
    - `load` with no stored key returns `null`
    - `save` then `load` round-trips an object correctly
  - Write unit tests for `renderBalanceDisplay`:
    - Zero transactions → displays `"$0.00"`
    - One transaction of `12.5` → displays `"$12.50"`
    - Multiple transactions → displays correct sum
  - Write unit tests for sort tie-breaking:
    - Two transactions with equal amounts: the one with the earlier `createdAt` appears first in `amount-asc`
    - Two transactions in the same category: tie-break by `createdAt` in `category-az`
  - Write unit test for empty-state rendering:
    - `AppState.transactions = []` → `#empty-state` is visible
  - **Acceptance**: All unit tests pass; tests cover all boundary values listed in the design document's Testing Strategy section

- [x] 17. Write property-based tests using fast-check
  - Set up fast-check via CDN in a test HTML file, or install it as a dev dependency for a Node.js test runner; each property test runs a minimum of 100 iterations (`numRuns: 100`)
  - Use the tag format: `Feature: expense-budget-visualizer, Property {N}: {property_text}`

  - [x] 17.1 Write property test for Property 1 (valid transaction persisted)
    - Generator: random valid `{ name, amount, category }` where name is 1–100 non-empty chars, amount is a positive number with ≤2 decimal places, category is drawn from `DEFAULT_CATEGORIES`
    - Assert: after add-transaction logic, `AppState.transactions` contains the entry AND `StorageService.load(KEYS.TRANSACTIONS)` contains the entry
    - **Validates: Requirements 1.3, 1.5, 2.3, 5.1**

  - [x] 17.2 Write property test for Property 2 (invalid transaction rejected)
    - Generator: random inputs where at least one field is invalid (empty name, amount ≤ 0 or non-numeric, or empty category)
    - Assert: `Validator.validateTransaction()` returns `valid: false`; `AppState.transactions.length` is unchanged; `localStorage` is unchanged
    - **Validates: Requirements 1.3, 1.4**

  - [x] 17.3 Write property test for Property 3 (balance equals sum)
    - Generator: random arrays of valid transactions (0–50 items)
    - Assert: `sum(transactions.map(t => t.amount))` equals `parseFloat(balanceText)` for any array
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [x] 17.4 Write property test for Property 4 (pie chart proportions)
    - Generator: random non-empty transaction arrays grouped by category
    - Assert: for each category, `categoryTotal / grandTotal` equals the segment's data value divided by the sum of all data values (within floating-point tolerance)
    - **Validates: Requirements 4.1, 4.2**

  - [x] 17.5 Write property test for Property 5 (deletion removes from state and storage)
    - Generator: random non-empty transaction arrays; pick a random index to delete
    - Assert: after deletion, neither `AppState.transactions` nor `StorageService.load(KEYS.TRANSACTIONS)` contains an entry with the deleted `id`
    - **Validates: Requirements 2.4, 2.5, 5.2**

  - [x] 17.6 Write property test for Property 6 (whitespace/empty category rejected)
    - Generator: strings composed entirely of whitespace characters or the empty string
    - Assert: `Validator.validateCategory(name, AppState.categories)` returns `valid: false`; category list length is unchanged
    - **Validates: Requirements 6.5**

  - [x] 17.7 Write property test for Property 7 (duplicate category rejected)
    - Generator: pick a random existing category from `AppState.categories`; optionally mutate its casing
    - Assert: `Validator.validateCategory(duplicate, AppState.categories)` returns `valid: false`; category list length is unchanged
    - **Validates: Requirements 6.5**

  - [x] 17.8 Write property test for Property 8 (sort preserves all transactions)
    - Generator: random transaction arrays (1–30 items); random sort option from `['insertion', 'amount-asc', 'amount-desc', 'category-az']`
    - Assert: the sorted array contains exactly the same set of `id`s as the original (same length, same elements, possibly different order)
    - **Validates: Requirements 7.1, 7.2**

  - [x] 17.9 Write property test for Property 9 (over-limit highlighting consistency)
    - Generator: random transactions + spending limits where at least one category total exceeds its limit
    - Assert: every transaction in an over-limit category has the `.over-limit` class in the DOM; the corresponding chart segment has its over-limit indicator
    - **Validates: Requirements 8.2, 8.3, 8.7**

  - [x] 17.10 Write property test for Property 10 (spending limit round-trip)
    - Generator: random valid limit values in [0.01, 999999999.99]; random category name
    - Assert: `StorageService.save(KEYS.LIMITS, { [cat]: value })` followed by `StorageService.load(KEYS.LIMITS)` returns an object where `result[cat] === value`
    - **Validates: Requirements 8.5**

  - [x] 17.11 Write property test for Property 11 (localStorage round-trip)
    - Generator: random arrays of valid `Transaction` objects
    - Assert: `StorageService.save(KEYS.TRANSACTIONS, transactions)` followed by `StorageService.load(KEYS.TRANSACTIONS)` returns an array where each element has identical `id`, `name`, `amount`, `category`, and `createdAt` fields
    - **Validates: Requirements 5.1, 5.2, 5.3**

## Notes

- All tasks target a zero-build-tool environment. No `npm install`, no bundler, no transpiler — everything runs directly in the browser or via `node` for tests.
- Chart.js is loaded from CDN; `window.Chart` must be available before `DOMContentLoaded` fires. The `<script>` tag for Chart.js must appear before `js/app.js`.
- `crypto.randomUUID()` is available in all target browsers (Chrome 92+, Firefox 95+, Edge 92+, Safari 15.4+). A `Math.random()`-based fallback is included for the `file://` edge case on older Safari.
- Property-based tests (Task 17) test pure logic functions extracted from `app.js` and do not require a running browser — they can be executed with Node.js using fast-check's npm package.
- The `StorageService` tests (Task 16) require a `localStorage` mock when run in Node.js (e.g., a simple in-memory object shim).
- Tasks 4 and 5 are independent of each other and can be implemented in the same wave.
