/**
 * Expense & Budget Visualizer — app.js
 * Single-file application logic (MVC, vanilla JS, no build tools).
 */

'use strict';

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

/**
 * Displays a non-blocking toast notification for ~3 seconds.
 * @param {string} message
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    background: '#333',
    color: '#fff',
    padding: '0.75rem 1.25rem',
    borderRadius: '4px',
    zIndex: '9999',
    fontSize: '0.9rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    opacity: '1',
    transition: 'opacity 0.4s ease',
  });

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  }, 3000);
}

// ---------------------------------------------------------------------------
// StorageService
// ---------------------------------------------------------------------------

/**
 * Encapsulates all localStorage interactions.
 * Wraps reads/writes in try/catch to handle quota errors and JSON parse failures.
 */
const StorageService = {
  /** localStorage key constants */
  KEYS: {
    TRANSACTIONS: 'ebv_transactions',
    CATEGORIES:   'ebv_categories',
    LIMITS:       'ebv_spending_limits',
  },

  /**
   * Serialises `data` to JSON and writes it to localStorage under `key`.
   * On QuotaExceededError or any other error, shows a toast and does NOT throw.
   *
   * @param {string} key
   * @param {*} data
   */
  save(key, data) {
    try {
      const serialised = JSON.stringify(data);
      localStorage.setItem(key, serialised);
    } catch (err) {
      // QuotaExceededError is a DOMException; catch all errors for resilience.
      showToast('Storage limit reached. New data could not be saved.');
    }
  },

  /**
   * Reads the value stored under `key` from localStorage and parses it as JSON.
   * Returns the parsed value on success, or `null` on any error
   * (missing key, malformed JSON, or any other exception).
   *
   * @param {string} key
   * @returns {*|null}
   */
  load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  },

  /**
   * Removes the entry stored under `key` from localStorage.
   * Errors are silently swallowed.
   *
   * @param {string} key
   */
  clear(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      // Nothing to do — removal failure is non-critical.
    }
  },
};

// ---------------------------------------------------------------------------
// AppState (In-Memory Model)
// ---------------------------------------------------------------------------

/**
 * Canonical in-memory application state.
 * All UI reads from this object; all mutations go through controller functions
 * that also persist to localStorage.
 *
 * @type {{
 *   transactions: Array,
 *   categories: string[],
 *   spendingLimits: Object,
 *   sortOrder: string
 * }}
 */
const AppState = {
  transactions:  [],
  categories:    [],
  spendingLimits: {},
  sortOrder:     'insertion',
};

// ---------------------------------------------------------------------------
// Default categories
// ---------------------------------------------------------------------------

/** @type {string[]} */
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

// ---------------------------------------------------------------------------
// initAppState
// ---------------------------------------------------------------------------

/**
 * Flag set by initAppState() when the stored transaction data is corrupt.
 * The bootstrap (Task 14) reads this flag to decide whether to show the
 * error banner.
 *
 * @type {boolean}
 */
let transactionDataCorrupt = false;

/**
 * Loads persisted data from localStorage into AppState.
 *
 * - Transactions: if the stored value is not an array, falls back to [] and
 *   sets `transactionDataCorrupt = true` so the caller can show an error banner.
 * - Custom categories: if the stored value is not an array, falls back to []
 *   silently; merged with DEFAULT_CATEGORIES (case-insensitive deduplication).
 * - Spending limits: if the stored value is not a plain object (or is null /
 *   an array), falls back to {} silently.
 */
function initAppState() {
  // Reset the corrupt-data flag on each call.
  transactionDataCorrupt = false;

  // --- Transactions ---
  const storedTransactions = StorageService.load(StorageService.KEYS.TRANSACTIONS);
  if (Array.isArray(storedTransactions)) {
    AppState.transactions = storedTransactions;
  } else {
    AppState.transactions = [];
    if (storedTransactions !== null) {
      // null means the key was simply absent; anything else is corrupt data.
      transactionDataCorrupt = true;
    }
  }

  // --- Custom categories ---
  const storedCategories = StorageService.load(StorageService.KEYS.CATEGORIES);
  const customCategories = Array.isArray(storedCategories) ? storedCategories : [];

  // Merge DEFAULT_CATEGORIES with custom categories, deduplicating
  // case-insensitively. Default categories always come first.
  const seen = new Set(DEFAULT_CATEGORIES.map(c => c.toLowerCase()));
  const merged = [...DEFAULT_CATEGORIES];
  for (const cat of customCategories) {
    if (typeof cat === 'string' && !seen.has(cat.toLowerCase())) {
      seen.add(cat.toLowerCase());
      merged.push(cat);
    }
  }
  AppState.categories = merged;

  // --- Spending limits ---
  const storedLimits = StorageService.load(StorageService.KEYS.LIMITS);
  if (
    storedLimits !== null &&
    typeof storedLimits === 'object' &&
    !Array.isArray(storedLimits)
  ) {
    AppState.spendingLimits = storedLimits;
  } else {
    AppState.spendingLimits = {};
  }
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Pure validation functions for form inputs.
 * Each method returns a structured result object so callers can display
 * field-level error messages without coupling validation logic to the DOM.
 */
const Validator = {
  /**
   * Validates a transaction input object.
   *
   * Rules:
   *  - name:     non-empty string after trimming, max 100 characters
   *  - amount:   finite number > 0; when the raw value is a string it must
   *              have at most 2 decimal places (e.g. "1.001" is rejected)
   *  - category: non-empty string that exists in AppState.categories
   *
   * @param {{ name: string, amount: string|number, category: string }} input
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
   */
  validateTransaction({ name, amount, category }) {
    const errors = {};

    // --- name ---
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.name = 'Item name is required.';
    } else if (name.trim().length > 100) {
      errors.name = 'Item name must be 100 characters or fewer.';
    }

    // --- amount ---
    // Accept both numeric and string inputs (the DOM always gives strings).
    const amountStr = String(amount);
    const amountNum = parseFloat(amountStr);

    if (amountStr.trim() === '' || isNaN(amountNum) || !isFinite(amountNum)) {
      errors.amount = 'Amount must be a valid number.';
    } else if (amountNum <= 0) {
      errors.amount = 'Amount must be greater than zero.';
    } else {
      // Check decimal precision: reject more than 2 decimal places.
      // Use the string representation to count digits after the decimal point.
      const decimalMatch = amountStr.trim().match(/\.(\d+)$/);
      if (decimalMatch && decimalMatch[1].length > 2) {
        errors.amount = 'Amount must have at most 2 decimal places.';
      }
    }

    // --- category ---
    if (typeof category !== 'string' || category.trim().length === 0) {
      errors.category = 'Please select a category.';
    } else if (!AppState.categories.includes(category)) {
      errors.category = 'Selected category is not valid.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  },

  /**
   * Validates a custom category name.
   *
   * Rules:
   *  - name: non-empty string after trimming, 1–50 characters
   *  - must not match any entry in existingCategories (case-insensitive)
   *
   * @param {string} name
   * @param {string[]} existingCategories
   * @returns {{ valid: boolean, error?: string }}
   */
  validateCategory(name, existingCategories) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return { valid: false, error: 'Category name is required.' };
    }

    const trimmed = name.trim();

    if (trimmed.length > 50) {
      return { valid: false, error: 'Category name must be 50 characters or fewer.' };
    }

    const lowerTrimmed = trimmed.toLowerCase();
    const isDuplicate = existingCategories.some(
      (cat) => cat.toLowerCase() === lowerTrimmed
    );

    if (isDuplicate) {
      return { valid: false, error: 'This category already exists.' };
    }

    return { valid: true };
  },

  /**
   * Validates a spending limit value.
   *
   * Rules:
   *  - Must be a finite number in the range [0.01, 999999999.99]
   *
   * @param {string|number} value
   * @returns {{ valid: boolean, error?: string }}
   */
  validateSpendingLimit(value) {
    const num = typeof value === 'number' ? value : parseFloat(String(value));

    if (isNaN(num) || !isFinite(num)) {
      return { valid: false, error: 'Spending limit must be a valid number.' };
    }

    if (num < 0.01 || num > 999999999.99) {
      return {
        valid: false,
        error: 'Spending limit must be between 0.01 and 999,999,999.99.',
      };
    }

    return { valid: true };
  },
};

// ---------------------------------------------------------------------------
// UI Renderers
// ---------------------------------------------------------------------------

/**
 * Rebuilds the transaction list DOM from AppState.
 * Reads AppState.transactions and AppState.sortOrder, applies the active sort,
 * renders one <li> per transaction, and applies .over-limit CSS class where needed.
 * Uses event delegation on the list container for delete button clicks.
 */
function renderTransactionList() {
  const list = document.getElementById('transaction-list');
  const emptyState = document.getElementById('empty-state');

  if (!list) return;

  // --- Compute category totals for over-limit detection ---
  const categoryTotals = {};
  for (const t of AppState.transactions) {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  }

  // --- Sort a shallow copy of transactions ---
  const sorted = AppState.transactions.slice();

  switch (AppState.sortOrder) {
    case 'amount-asc':
      sorted.sort((a, b) => {
        if (a.amount !== b.amount) return a.amount - b.amount;
        return a.createdAt - b.createdAt;
      });
      break;
    case 'amount-desc':
      sorted.sort((a, b) => {
        if (a.amount !== b.amount) return b.amount - a.amount;
        return a.createdAt - b.createdAt;
      });
      break;
    case 'category-az':
      sorted.sort((a, b) => {
        const catA = a.category.toLowerCase();
        const catB = b.category.toLowerCase();
        if (catA !== catB) return catA < catB ? -1 : 1;
        return a.createdAt - b.createdAt;
      });
      break;
    case 'insertion':
    default:
      sorted.sort((a, b) => a.createdAt - b.createdAt);
      break;
  }

  // --- Empty state ---
  if (sorted.length === 0) {
    if (emptyState) emptyState.style.display = '';
    // Remove all <li> elements, keep #empty-state
    const items = list.querySelectorAll('li');
    items.forEach(li => li.remove());
    return;
  }

  // Hide empty state
  if (emptyState) emptyState.style.display = 'none';

  // --- Remove existing <li> elements before re-rendering ---
  const existingItems = list.querySelectorAll('li');
  existingItems.forEach(li => li.remove());

  // --- Render one <li> per transaction ---
  for (const transaction of sorted) {
    const isOverLimit =
      AppState.spendingLimits[transaction.category] !== undefined &&
      categoryTotals[transaction.category] > AppState.spendingLimits[transaction.category];

    const li = document.createElement('li');
    li.className = 'transaction-item' + (isOverLimit ? ' over-limit' : '');
    li.dataset.id = transaction.id;

    // Item name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'transaction-name';
    nameSpan.textContent = transaction.name;

    // Formatted amount
    const amountSpan = document.createElement('span');
    amountSpan.className = 'transaction-amount';
    amountSpan.textContent = '$' + transaction.amount.toFixed(2);

    // Category badge
    const categorySpan = document.createElement('span');
    categorySpan.className = 'transaction-category';
    categorySpan.textContent = transaction.category;

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.id = transaction.id;
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', 'Delete transaction: ' + transaction.name);

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  }

  // --- Event delegation for delete buttons ---
  // Remove any previously attached delegated listener to avoid duplicates,
  // then re-attach. We use a named handler stored on the element.
  if (list._delegatedDeleteHandler) {
    list.removeEventListener('click', list._delegatedDeleteHandler);
  }
  list._delegatedDeleteHandler = function (event) {
    const btn = event.target.closest('.delete-btn');
    if (btn && btn.dataset.id) {
      handleDeleteTransaction(btn.dataset.id);
    }
  };
  list.addEventListener('click', list._delegatedDeleteHandler);
}

/**
 * Recalculates and updates the total balance display.
 * Sums all AppState.transactions amounts and updates #balance-display.
 */
function renderBalanceDisplay() {
  const balanceDisplay = document.getElementById('balance-display');
  if (!balanceDisplay) return;

  const total = AppState.transactions.reduce((sum, t) => sum + t.amount, 0);
  balanceDisplay.textContent = '$' + total.toFixed(2);
}

// ---------------------------------------------------------------------------
// ChartManager
// ---------------------------------------------------------------------------

/**
 * Fixed color palette for pie chart segments.
 * Colors cycle if there are more categories than palette entries.
 * @type {string[]}
 */
const CHART_COLOR_PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
];

/**
 * Wraps the Chart.js instance lifecycle.
 * Keeps a single Chart instance and provides init / update / destroy helpers.
 */
const ChartManager = {
  /** @type {Chart|null} */
  instance: null,

  /**
   * Creates a new Chart.js pie chart on the given canvas element and stores
   * the instance in `ChartManager.instance`.
   *
   * @param {string} canvasId - The `id` attribute of the target `<canvas>`.
   */
  init(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      throw new Error('ChartManager.init: canvas element not found: ' + canvasId);
    }

    // Destroy any pre-existing instance to avoid duplicate charts.
    if (this.instance) {
      this.destroy();
    }

    this.instance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: [],
            borderColor: [],
            borderWidth: [],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return label + ': $' + value.toFixed(2) + ' (' + pct + '%)';
              },
            },
          },
        },
      },
    });
  },

  /**
   * Updates the chart's labels, data, and colors, applying a distinct border
   * style for over-limit segments, then calls `instance.update()`.
   *
   * @param {string[]} labels          - Category names.
   * @param {number[]} data            - Total amounts per category (same order as labels).
   * @param {string[]} colors          - Background colors per segment (same order).
   * @param {boolean[]} overLimitFlags - `true` for each segment whose category is over-limit.
   */
  update(labels, data, colors, overLimitFlags) {
    if (!this.instance) return;

    const borderColors = overLimitFlags.map((isOver) =>
      isOver ? '#cc0000' : 'rgba(255,255,255,0.8)'
    );
    const borderWidths = overLimitFlags.map((isOver) => (isOver ? 4 : 1));

    this.instance.data.labels = labels;
    this.instance.data.datasets[0].data = data;
    this.instance.data.datasets[0].backgroundColor = colors;
    this.instance.data.datasets[0].borderColor = borderColors;
    this.instance.data.datasets[0].borderWidth = borderWidths;

    this.instance.update();
  },

  /**
   * Destroys the Chart.js instance (if one exists) and resets `instance` to `null`.
   */
  destroy() {
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
    }
  },
};

// ---------------------------------------------------------------------------
// renderPieChart
// ---------------------------------------------------------------------------

/**
 * Updates the pie chart with current transaction data.
 *
 * - Aggregates AppState.transactions by category.
 * - Shows #chart-placeholder and hides the canvas when there is no data.
 * - Assigns deterministic colors from CHART_COLOR_PALETTE (cycling as needed).
 * - Marks categories that exceed their spending limit for visual distinction.
 * - Initialises ChartManager on first call; updates it on subsequent calls.
 * - Errors are caught and logged; the function never throws.
 */
function renderPieChart() {
  try {
    const canvas = document.getElementById('expense-chart');
    const placeholder = document.getElementById('chart-placeholder');

    // --- Aggregate transactions by category ---
    const totals = {};
    for (const t of AppState.transactions) {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    }

    // Filter to categories with a positive total.
    const categories = Object.keys(totals).filter((cat) => totals[cat] > 0);

    // --- No data: show placeholder, hide canvas ---
    if (categories.length === 0) {
      if (placeholder) placeholder.style.display = '';
      if (canvas) canvas.style.display = 'none';
      // Destroy any existing chart instance so it doesn't linger.
      ChartManager.destroy();
      return;
    }

    // --- Has data: hide placeholder, show canvas ---
    if (placeholder) placeholder.style.display = 'none';
    if (canvas) canvas.style.display = '';

    // --- Build parallel arrays for Chart.js ---
    const labels = categories;
    const data = categories.map((cat) => totals[cat]);
    const colors = categories.map(
      (_, i) => CHART_COLOR_PALETTE[i % CHART_COLOR_PALETTE.length]
    );
    const overLimitFlags = categories.map((cat) => {
      const limit = AppState.spendingLimits[cat];
      return limit !== undefined && totals[cat] > limit;
    });

    // --- Init or update ---
    if (!ChartManager.instance) {
      ChartManager.init('expense-chart');
    }
    ChartManager.update(labels, data, colors, overLimitFlags);
  } catch (err) {
    console.error('renderPieChart error:', err);
  }
}

/**
 * Rebuilds the <option> elements in both category <select> elements
 * (#category-select and #limit-category-select) from AppState.categories.
 *
 * Always inserts a placeholder option with an empty value as the first entry,
 * then appends one <option> per category in AppState.categories.
 */
function renderCategorySelector() {
  const selects = [
    document.getElementById('category-select'),
    document.getElementById('limit-category-select'),
  ];

  for (const select of selects) {
    if (!select) continue;

    // Preserve the current selection so we can restore it after rebuilding.
    const previousValue = select.value;

    // Clear all existing options.
    select.innerHTML = '';

    // Add the default placeholder option.
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.textContent = '-- Select Category --';
    select.appendChild(placeholder);

    // Add one option per category.
    for (const category of AppState.categories) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    }

    // Restore the previous selection if it still exists; otherwise reset to placeholder.
    if (previousValue && AppState.categories.includes(previousValue)) {
      select.value = previousValue;
    } else {
      select.selectedIndex = 0;
    }
  }
}

/**
 * Handles the #add-category-form submit event.
 *
 * Flow:
 *  1. Prevent default form submission.
 *  2. Read the value from #new-category.
 *  3. Validate via Validator.validateCategory(); on failure inject the error
 *     message into #new-category-error and return early.
 *  4. Push the trimmed name to AppState.categories.
 *  5. Persist only custom categories (those not in DEFAULT_CATEGORIES) to
 *     localStorage via StorageService.
 *  6. Rebuild both category selectors via renderCategorySelector().
 *  7. Reset the #new-category input and clear the error span.
 *
 * @param {Event} event
 */
function handleAddCategory(event) {
  event.preventDefault();

  const input = document.getElementById('new-category');
  const errorSpan = document.getElementById('new-category-error');

  const rawValue = input ? input.value : '';

  // Validate the category name.
  const result = Validator.validateCategory(rawValue, AppState.categories);

  if (!result.valid) {
    if (errorSpan) errorSpan.textContent = result.error || '';
    return; // Do not mutate state.
  }

  // Push the trimmed name to AppState.
  const trimmedName = rawValue.trim();
  AppState.categories.push(trimmedName);

  // Persist only custom categories (exclude defaults).
  StorageService.save(
    StorageService.KEYS.CATEGORIES,
    AppState.categories.filter(c => !DEFAULT_CATEGORIES.includes(c))
  );

  // Rebuild both category <select> elements.
  try { renderCategorySelector(); } catch (err) { console.error('handleAddCategory: renderCategorySelector error:', err); }

  // Reset the input field and clear any error message.
  if (input) input.value = '';
  if (errorSpan) errorSpan.textContent = '';
}

/**
 * Re-evaluates spending limits and updates visual indicators.
 *
 * For each category in AppState.categories, computes the sum of transaction
 * amounts for that category and compares it against AppState.spendingLimits.
 * Re-applies the .over-limit CSS class to all <li> elements in
 * #transaction-list whose category total exceeds its limit, and removes the
 * class from those that do not. Then triggers renderPieChart() to refresh
 * over-limit segment styling.
 */
function renderSpendingLimitIndicators() {
  // --- Compute per-category totals ---
  const categoryTotals = {};
  for (const t of AppState.transactions) {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  }

  // --- Determine which categories are over their limit ---
  const overLimitCategories = new Set();
  for (const category of AppState.categories) {
    const limit = AppState.spendingLimits[category];
    if (limit !== undefined && (categoryTotals[category] || 0) > limit) {
      overLimitCategories.add(category);
    }
  }

  // --- Update .over-limit class on each <li> in #transaction-list ---
  const list = document.getElementById('transaction-list');
  if (list) {
    const items = list.querySelectorAll('li');
    items.forEach(li => {
      // Each <li> has a data-id attribute; find the matching transaction to
      // get its category.
      const id = li.dataset.id;
      const transaction = AppState.transactions.find(t => t.id === id);
      if (transaction) {
        if (overLimitCategories.has(transaction.category)) {
          li.classList.add('over-limit');
        } else {
          li.classList.remove('over-limit');
        }
      }
    });
  }

  // --- Refresh chart to update over-limit segment styling ---
  renderPieChart();
}

// ---------------------------------------------------------------------------
// handleSetSpendingLimit — Controller
// ---------------------------------------------------------------------------

/**
 * Handles the #limit-form submit event.
 *
 * Flow:
 *  1. Prevent default form submission.
 *  2. Read the selected category from #limit-category-select and the value
 *     from #limit-value.
 *  3. Validate via Validator.validateSpendingLimit(); on failure inject the
 *     error message into #limit-value-error and return early.
 *  4. Set AppState.spendingLimits[category] = parseFloat(value).
 *  5. Persist the updated limits via StorageService.
 *  6. Call renderSpendingLimitIndicators() and renderPieChart() to refresh UI.
 *  7. Reset the limit form fields and clear the error span.
 *
 * @param {Event} event
 */
function handleSetSpendingLimit(event) {
  event.preventDefault();

  const categorySelect = document.getElementById('limit-category-select');
  const limitInput     = document.getElementById('limit-value');
  const errorSpan      = document.getElementById('limit-value-error');

  const category = categorySelect ? categorySelect.value : '';
  const value    = limitInput     ? limitInput.value     : '';

  // --- Validate the limit value ---
  const result = Validator.validateSpendingLimit(value);

  if (!result.valid) {
    if (errorSpan) errorSpan.textContent = result.error || '';
    return; // Do not mutate state.
  }

  // --- Validate that a category was selected ---
  if (!category) {
    if (errorSpan) errorSpan.textContent = 'Please select a category.';
    return;
  }

  // --- Mutate AppState ---
  AppState.spendingLimits[category] = parseFloat(value);

  // --- Persist ---
  StorageService.save(StorageService.KEYS.LIMITS, AppState.spendingLimits);

  // --- Update UI ---
  try { renderSpendingLimitIndicators(); } catch (err) { console.error('handleSetSpendingLimit: renderSpendingLimitIndicators error:', err); }
  try { renderPieChart(); } catch (err) { console.error('handleSetSpendingLimit: renderPieChart error:', err); }

  // --- Reset form fields and clear error ---
  if (categorySelect) categorySelect.selectedIndex = 0;
  if (limitInput)     limitInput.value = '';
  if (errorSpan)      errorSpan.textContent = '';
}

// ---------------------------------------------------------------------------
// handleDeleteTransaction
// ---------------------------------------------------------------------------

/**
 * Removes the transaction with the given id from AppState and persists the change.
 *
 * @param {string} id
 */
function handleDeleteTransaction(id) {
  AppState.transactions = AppState.transactions.filter(t => t.id !== id);
  StorageService.save(StorageService.KEYS.TRANSACTIONS, AppState.transactions);
  try { renderTransactionList(); } catch (err) { console.error('handleDeleteTransaction: renderTransactionList error:', err); }
  try { renderBalanceDisplay(); } catch (err) { console.error('handleDeleteTransaction: renderBalanceDisplay error:', err); }
  try { renderPieChart(); } catch (err) { console.error('handleDeleteTransaction: renderPieChart error:', err); }
  try { renderSpendingLimitIndicators(); } catch (err) { console.error('handleDeleteTransaction: renderSpendingLimitIndicators error:', err); }
}

// ---------------------------------------------------------------------------
// crypto.randomUUID fallback
// ---------------------------------------------------------------------------

/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID() when available; falls back to a Math.random()-based
 * implementation for environments where crypto.randomUUID is not defined
 * (e.g., file:// URLs on older Safari).
 *
 * @returns {string} A UUID v4 string.
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 UUID using Math.random()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// handleAddTransaction — Controller
// ---------------------------------------------------------------------------

/**
 * Handles the #transaction-form submit event.
 *
 * Flow:
 *  1. Prevent default form submission.
 *  2. Read field values from the DOM.
 *  3. Validate via Validator.validateTransaction(); on failure inject error
 *     messages into the adjacent <span> elements and return early.
 *  4. On success, create a Transaction object, push it to AppState, persist
 *     to localStorage, trigger all UI renderers, reset the form, and clear
 *     any previously shown error messages.
 *
 * @param {Event} event
 */
function handleAddTransaction(event) {
  event.preventDefault();

  // --- Read field values ---
  const nameInput     = document.getElementById('expense-name');
  const amountInput   = document.getElementById('expense-amount');
  const categoryInput = document.getElementById('category-select');

  const nameValue     = nameInput     ? nameInput.value     : '';
  const amountValue   = amountInput   ? amountInput.value   : '';
  const categoryValue = categoryInput ? categoryInput.value : '';

  // --- Error span references ---
  const nameError     = document.getElementById('expense-name-error');
  const amountError   = document.getElementById('expense-amount-error');
  const categoryError = document.getElementById('category-select-error');

  // --- Validate ---
  const result = Validator.validateTransaction({
    name:     nameValue,
    amount:   amountValue,
    category: categoryValue,
  });

  if (!result.valid) {
    // Inject error messages into the corresponding <span> elements.
    if (nameError)     nameError.textContent     = result.errors.name     || '';
    if (amountError)   amountError.textContent   = result.errors.amount   || '';
    if (categoryError) categoryError.textContent = result.errors.category || '';
    return; // Do not mutate state.
  }

  // --- Build Transaction object ---
  const transaction = {
    id:        generateUUID(),
    name:      nameValue.trim(),
    amount:    parseFloat(amountValue),
    category:  categoryValue,
    createdAt: Date.now(),
  };

  // --- Mutate AppState ---
  AppState.transactions.push(transaction);

  // --- Persist ---
  StorageService.save(StorageService.KEYS.TRANSACTIONS, AppState.transactions);

  // --- Update UI (each renderer isolated so one failure doesn't block others) ---
  try { renderTransactionList(); } catch (err) { console.error('handleAddTransaction: renderTransactionList error:', err); }
  try { renderBalanceDisplay(); } catch (err) { console.error('handleAddTransaction: renderBalanceDisplay error:', err); }
  try { renderPieChart(); } catch (err) { console.error('handleAddTransaction: renderPieChart error:', err); }
  try { renderSpendingLimitIndicators(); } catch (err) { console.error('handleAddTransaction: renderSpendingLimitIndicators error:', err); }

  // --- Reset form fields ---
  if (nameInput)     nameInput.value     = '';
  if (amountInput)   amountInput.value   = '';
  if (categoryInput) {
    // Reset to the default placeholder (first option with empty value).
    categoryInput.value = '';
    // If the browser did not honour the empty-value reset, select index 0.
    if (categoryInput.selectedIndex !== 0) {
      categoryInput.selectedIndex = 0;
    }
  }

  // --- Clear validation error messages ---
  if (nameError)     nameError.textContent     = '';
  if (amountError)   amountError.textContent   = '';
  if (categoryError) categoryError.textContent = '';
}

// ---------------------------------------------------------------------------
// handleSortChange — Controller
// ---------------------------------------------------------------------------

/**
 * Handles the #sort-select change event.
 *
 * Reads the newly selected sort option, updates AppState.sortOrder, and
 * re-renders the transaction list so the new order is reflected immediately.
 *
 * @param {Event} event
 */
function handleSortChange(event) {
  const select = document.getElementById('sort-select');
  if (select) {
    AppState.sortOrder = select.value;
  }
  try { renderTransactionList(); } catch (err) { console.error('handleSortChange: renderTransactionList error:', err); }
}

// ---------------------------------------------------------------------------
// init — Application bootstrap
// ---------------------------------------------------------------------------

/**
 * Main initialisation function.
 *
 * Called once from the DOMContentLoaded listener. Loads persisted data,
 * renders all UI sections, and registers all event listeners.
 *
 * Steps:
 *  1. Load all data from localStorage via initAppState().
 *  2. If transaction data was corrupt, show the #error-banner.
 *  3. Populate both category <select> elements.
 *  4. Render the transaction list.
 *  5. Render the balance display.
 *  6. Render the pie chart.
 *  7. Apply spending-limit over-limit highlights.
 *  8. Register all event listeners.
 */
function init() {
  // --- 1. Load persisted state ---
  initAppState();

  // --- 2. Show error banner if transaction data was corrupt ---
  if (transactionDataCorrupt) {
    const banner = document.getElementById('error-banner');
    if (banner) {
      banner.textContent = 'Saved transaction data could not be loaded.';
      banner.removeAttribute('hidden');
    }
  }

  // --- 3. Populate category selectors ---
  try {
    renderCategorySelector();
  } catch (err) {
    console.error('init: renderCategorySelector error:', err);
  }

  // --- 4. Render transaction list ---
  try {
    renderTransactionList();
  } catch (err) {
    console.error('init: renderTransactionList error:', err);
  }

  // --- 5. Render balance display ---
  try {
    renderBalanceDisplay();
  } catch (err) {
    console.error('init: renderBalanceDisplay error:', err);
  }

  // --- 6. Render pie chart ---
  try {
    renderPieChart();
  } catch (err) {
    console.error('init: renderPieChart error:', err);
  }

  // --- 7. Apply spending-limit indicators ---
  try {
    renderSpendingLimitIndicators();
  } catch (err) {
    console.error('init: renderSpendingLimitIndicators error:', err);
  }

  // --- 8. Register event listeners ---

  // Add Transaction form
  const transactionForm = document.getElementById('transaction-form');
  if (transactionForm) {
    transactionForm.addEventListener('submit', handleAddTransaction);
  }

  // Add Category form
  const addCategoryForm = document.getElementById('add-category-form');
  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', handleAddCategory);
  }

  // Spending Limit form
  const limitForm = document.getElementById('limit-form');
  if (limitForm) {
    limitForm.addEventListener('submit', handleSetSpendingLimit);
  }

  // Sort Control
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', handleSortChange);
  }

  // Transaction list — delegated delete (handled inside renderTransactionList,
  // but we also attach here so the delegation is in place even before the first
  // render populates any <li> elements).
  const transactionList = document.getElementById('transaction-list');
  if (transactionList && !transactionList._delegatedDeleteHandler) {
    transactionList._delegatedDeleteHandler = function (event) {
      const btn = event.target.closest('.delete-btn');
      if (btn && btn.dataset.id) {
        handleDeleteTransaction(btn.dataset.id);
      }
    };
    transactionList.addEventListener('click', transactionList._delegatedDeleteHandler);
  }
}

// ---------------------------------------------------------------------------
// DOMContentLoaded — entry point
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);
