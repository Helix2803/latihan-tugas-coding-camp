# Requirements Document

## Introduction

The Expense & Budget Visualizer is a single-page web application that allows users to track personal expenses, manage budget categories, and visualize spending distribution through an interactive pie chart. All data is stored client-side using the browser's Local Storage API. The application requires no backend server, no build tools, and no complex setup — it runs as a standalone HTML file or browser extension in any modern browser.

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single expense entry consisting of an item name, amount, and category.
- **Category**: A label grouping transactions (e.g., Food, Transport, Fun, or a user-defined custom category).
- **Transaction_List**: The scrollable UI component displaying all recorded transactions.
- **Input_Form**: The UI form component used to add new transactions.
- **Balance_Display**: The UI component at the top of the page showing the total sum of all transaction amounts.
- **Pie_Chart**: The visual chart component showing spending distribution by category.
- **Spending_Limit**: A user-defined monetary threshold per category above which spending is highlighted.
- **Local_Storage**: The browser's built-in Local Storage API used for client-side data persistence.
- **Validator**: The client-side logic responsible for validating Input_Form fields before submission.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for item name (maximum 100 characters), a numeric field for amount (positive values up to two decimal places), and a category selector.
2. THE Input_Form SHALL include the default categories: Food, Transport, and Fun.
3. WHEN the user submits the Input_Form, THE Validator SHALL verify that the item name field is not empty, the amount field contains a positive numeric value greater than zero, and a category is selected.
4. IF the Validator detects any empty or invalid field, THEN THE Input_Form SHALL display an inline error message identifying the invalid field and SHALL NOT submit the transaction.
5. WHEN all fields pass validation, THE App SHALL add the transaction to the Transaction_List and persist it to Local_Storage.
6. WHEN a transaction is successfully added, THE Input_Form SHALL reset the item name field to empty, the amount field to empty, and the category selector to its default placeholder state.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see a scrollable list of all my recorded transactions so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored transactions, each showing the item name, amount formatted to two decimal places with a currency symbol, and category.
2. THE Transaction_List SHALL be scrollable when the number of transactions exceeds the visible area.
3. WHEN a new transaction is added, THE Transaction_List SHALL update to include the new entry within 100 milliseconds without requiring a page reload.
4. WHEN the user activates the delete control on a transaction entry, THE App SHALL immediately remove that transaction from the Transaction_List and from Local_Storage without requiring a confirmation step.
5. WHEN a transaction is deleted, THE Transaction_List SHALL update to reflect the removal within 100 milliseconds.
6. WHEN no transactions exist, THE Transaction_List SHALL display a visible empty-state message (e.g., "No transactions yet") in place of the list.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts formatted to two decimal places (e.g., "0.00").
2. WHEN a transaction is added, THE Balance_Display SHALL update automatically to reflect the new total.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update automatically to reflect the revised total.
4. WHEN no transactions exist, THE Balance_Display SHALL show "0.00".
5. WHEN all transaction amounts sum to zero, THE Balance_Display SHALL show "0.00".

---

### Requirement 4: Pie Chart Visualization

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display each category as a distinct segment with a unique color and label, sized proportionally to the total amount spent in that category relative to all spending.
2. WHEN a transaction is added, deleted, or edited, THE Pie_Chart SHALL update to reflect the current spending distribution within 1 second.
3. WHEN only one category has transactions, THE Pie_Chart SHALL display a single full-circle segment for that category.
4. WHEN the last transaction in the only active category is deleted, THE Pie_Chart SHALL immediately switch to the empty or placeholder state.
5. WHEN no transactions exist or all transactions have no valid categories, THE Pie_Chart SHALL display a visible placeholder message (e.g., "No data to display") in place of the chart.
6. THE Pie_Chart SHALL render using Chart.js version 3.x or later loaded from a CDN, requiring no local installation.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions so that I do not lose my data when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL write the updated transaction list to Local_Storage.
2. WHEN a transaction is deleted, THE App SHALL write the updated transaction list to Local_Storage.
3. WHEN the App initializes, THE App SHALL read all transactions from Local_Storage and render them in the Transaction_List, Balance_Display, and Pie_Chart.
4. IF Local_Storage contains no data on initialization, THEN THE App SHALL initialize with an empty transaction list.
5. IF reading from Local_Storage succeeds but a UI component fails to render, THEN THE App SHALL continue running with the remaining components displaying their data and accepting user interactions normally.
6. IF Local_Storage contains corrupt or malformed transaction data on initialization, THEN THE App SHALL discard the invalid data, initialize with an empty transaction list, and display an error message indicating that saved data could not be loaded.

---

### Requirement 6: Custom Categories

**User Story:** As a user, I want to add my own spending categories so that I can track expenses beyond the default set.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text input (1–50 characters) and a submit control that allows the user to define and add a new custom category name.
2. WHEN the user adds a custom category, THE App SHALL append it to the category selector in the Input_Form.
3. WHEN the user adds a custom category, THE App SHALL persist the custom category list to Local_Storage.
4. WHEN the App initializes, THE App SHALL restore all previously saved custom categories into the category selector.
5. IF the user submits a custom category name that is empty or duplicates an existing category name (comparison is case-insensitive, covering both default and custom categories currently in the selector), THEN THE App SHALL display an error message and SHALL NOT add the duplicate or empty category.
6. IF Local_Storage contains corrupt or missing custom category data on initialization, THEN THE App SHALL discard the invalid data, initialize with only the default categories, and continue running normally.

---

### Requirement 7: Transaction Sorting

**User Story:** As a user, I want to sort my transaction list by amount or category so that I can find and analyze my expenses more easily.

#### Acceptance Criteria

1. THE Transaction_List SHALL provide a sort control with options to sort by amount ascending, amount descending, and by category alphabetically A–Z.
2. WHEN the user selects a sort option, THE Transaction_List SHALL reorder the displayed transactions according to the selected criterion within 100 milliseconds.
3. WHEN a new transaction is added while a sort option is active, THE Transaction_List SHALL display the new transaction in the correct sorted position within 100 milliseconds.
4. THE sort control SHALL default to insertion order (most recently added last) on startup and whenever the active sort option is explicitly cleared by the user.
5. WHEN two transactions have equal values for the active sort criterion, THE Transaction_List SHALL break the tie by displaying the more recently added transaction last.

---

### Requirement 8: Spending Limit Highlighting

**User Story:** As a user, I want to set a spending limit per category so that I can be visually alerted when I exceed my budget for that category.

#### Acceptance Criteria

1. THE App SHALL provide a control for the user to set a numeric Spending_Limit for any category, where the valid range is 0.01 to 999,999,999.99.
2. WHEN the total amount of transactions in a category exceeds the Spending_Limit for that category, THE Transaction_List SHALL visually highlight all transactions belonging to that category using a distinct visual indicator (such as a colored background, border, or warning icon) that is visually different from the appearance of transactions in within-limit categories.
3. WHEN the total amount of transactions in a category exceeds the Spending_Limit for that category, THE Pie_Chart SHALL visually distinguish the over-limit segment from within-limit segments using a distinct visual indicator (such as a different fill pattern, border, or warning marker).
4. WHEN a transaction is deleted and the category total falls at or below the Spending_Limit, THE App SHALL remove the over-limit visual indicator from that category's transactions in the Transaction_List and from the corresponding Pie_Chart segment.
5. WHEN the App initializes, THE App SHALL restore all previously saved Spending_Limits from Local_Storage; IF restoration fails due to missing or corrupted data, THEN THE App SHALL initialize with no Spending_Limits and continue running normally.
6. IF the user sets a Spending_Limit value that is not a number in the range 0.01 to 999,999,999.99, THEN THE App SHALL display an error message indicating the valid range and SHALL NOT save the invalid limit.
7. WHEN the user updates an existing Spending_Limit for a category, THE App SHALL immediately re-evaluate the category total against the new Spending_Limit and update the visual indicators in the Transaction_List and Pie_Chart accordingly.

---

### Requirement 9: Technology and Compatibility

**User Story:** As a developer, I want the app to use only HTML, CSS, and Vanilla JavaScript so that it runs without any build tools, frameworks, or backend server.

#### Acceptance Criteria

1. THE App SHALL be implemented using only HTML, CSS, and Vanilla JavaScript with no frontend frameworks (such as React, Vue, or Angular) and no build tools (such as webpack, Vite, or npm scripts).
2. THE App SHALL use exactly one CSS file located in the `css/` directory and exactly one JavaScript file located in the `js/` directory.
3. THE App SHALL load Chart.js version 3.x or later from a public CDN and SHALL NOT require any local package installation.
4. THE App SHALL function correctly in Chrome 109+, Firefox 109+, Edge 109+, and Safari 16+.
5. WHEN the App's `index.html` is opened directly from the file system (using a `file://` URL) without a local server, THE App SHALL load and operate all features without errors.
