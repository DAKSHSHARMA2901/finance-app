# Finance App - AI Query Testing Guide

This guide helps you test and validate the AI-powered financial querying system.

## Test Categories

### 1. Basic Sales/Purchase Queries

#### Test: Total Sales
**Query:** "What were total sales this year?"
**Expected:** Single row with total sales amount in USD
**Validation:** 
- Result should be a positive number
- Filtered to current year (2024 or 2025)
- Currency formatted correctly

#### Test: Total Purchases
**Query:** "What were our total purchases?"
**Expected:** Single row with total amount
**Validation:** Amount matches invoice_type='purchase' sum

#### Test: Sales vs Purchases
**Query:** "Compare our total sales to total purchases"
**Expected:** Two rows or comparison statement
**Validation:** Both figures returned with difference

### 2. Customer Analysis

#### Test: Top Customers
**Query:** "Which customers had the most invoices?"
**Expected:** List of customers with invoice counts/totals
**Validation:** 
- Customers sorted by amount/count
- Only sales invoices included
- Results limited to top 10

#### Test: Customer Revenue
**Query:** "How much did customer 'Acme Corp' spend?"
**Expected:** Single customer revenue figure
**Validation:** Correct customer, sales-only, accurate sum

#### Test: Overdue Customer
**Query:** "Which customers have overdue invoices?"
**Expected:** List of customers with overdue amounts
**Validation:** 
- Only overdue status included
- due_date < today
- Customers with sales invoices

### 3. Payment Status Analysis

#### Test: Outstanding Amount
**Query:** "What is our total outstanding receivable?"
**Expected:** Single number for unpaid amount
**Validation:** 
- Includes pending + overdue
- Sales invoices only
- Positive amount

#### Test: Overdue Invoices
**Query:** "Show me overdue invoices"
**Expected:** List with details
**Validation:** 
- status = 'overdue'
- Includes amount, customer, due date
- Limited to 100 rows

#### Test: Paid Invoices
**Query:** "How many invoices were paid this month?"
**Expected:** Count and/or total
**Validation:** status = 'paid', current month date range

### 4. Date Range Queries

#### Test: Specific Month
**Query:** "Show sales for January 2024"
**Expected:** Invoices between 2024-01-01 and 2024-01-31
**Validation:** All dates within range

#### Test: Quarter Analysis
**Query:** "What were Q1 sales?"
**Expected:** Invoices for Jan-Mar 2024
**Validation:** Correct quarter dates

#### Test: Last N Days
**Query:** "Sales from the last 30 days"
**Expected:** Invoices from last 30 days
**Validation:** invoice_date >= today - 30 days

#### Test: Date Comparison
**Query:** "Compare last month to this month"
**Expected:** Two figures showing comparison
**Validation:** Accurate date ranges, percentage change

### 5. Financial Metrics

#### Test: Profit Margin
**Query:** "What is our profit margin?"
**Expected:** Percentage value
**Validation:** 
- (Sales - Purchases) / Sales * 100
- Between 0-100%
- Properly formatted

#### Test: Tax Analysis
**Query:** "How much tax did we pay?"
**Expected:** Total tax amount
**Validation:** Sum of tax_amount field

#### Test: Average Invoice
**Query:** "What is the average invoice value?"
**Expected:** Single number
**Validation:** Total / count, currency formatted

### 6. Filtering and Conditions

#### Test: Multiple Filters
**Query:** "Show overdue sales invoices for Acme Corp in Q1"
**Expected:** Filtered list
**Validation:** All criteria applied (status, type, customer, date)

#### Test: Amount Threshold
**Query:** "Show invoices over $1000"
**Expected:** Invoices where total_amount > 1000
**Validation:** All results >= 1000

#### Test: Currency Handling
**Query:** "Show me sales in USD"
**Expected:** Filtered by currency
**Validation:** currency = 'USD'

### 7. Sorting and Ordering

#### Test: Top/Bottom Results
**Query:** "Top 5 invoices by amount"
**Expected:** Sorted descending
**Validation:** Largest amounts first

#### Test: Time-based Sorting
**Query:** "Latest invoices"
**Expected:** Sorted by date descending
**Validation:** Most recent first

### 8. Aggregation Queries

#### Test: Grouping
**Query:** "Sales by customer"
**Expected:** Grouped totals
**Validation:** One row per customer, correct sums

#### Test: Multiple Aggregations
**Query:** "Customer, invoice count, and total"
**Expected:** Multiple columns
**Validation:** GROUP BY works, all aggregates accurate

### 9. Error Handling & Edge Cases

#### Test: Empty Result Set
**Query:** "Sales in year 2050"
**Expected:** "No data found" message
**Validation:** Graceful handling, no error

#### Test: Invalid Column Reference
**Query:** "Show me the blah field"
**Expected:** Error message or "no matching field"
**Validation:** Handled without SQL error

#### Test: Ambiguous Query
**Query:** "Show me invoices"
**Expected:** Clarification or default behavior
**Validation:** Returns results or asks for clarification

#### Test: Very Large Result Set
**Query:** "Show me all invoices"
**Expected:** Limited to 100 rows
**Validation:** Row count shown, pagination suggested

### 10. Complex Real-world Scenarios

#### Test: Vendor Performance
**Query:** "Which supplier do we spend the most with?"
**Expected:** Supplier with highest purchase amount
**Validation:** Purchase invoices only

#### Test: Cash Flow
**Query:** "What was our cash flow last quarter?"
**Expected:** Payments - Purchases
**Validation:** Transaction analysis

#### Test: Seasonal Analysis
**Query:** "Compare Q1 to Q4"
**Expected:** Quarter-over-quarter comparison
**Validation:** Percentage change accurate

#### Test: Invoice Status Breakdown
**Query:** "Break down our invoices by status"
**Expected:** Count by status (pending, paid, overdue, cancelled)
**Validation:** Sums to total invoice count

## Performance Tests

### Test: Query Execution Time
- Should return in < 2 seconds
- Large result sets (1000+ rows) < 5 seconds

### Test: Concurrent Queries
- Multiple users querying simultaneously
- No timeouts or connection errors

## Data Validation Tests

### Test: Decimal Precision
- All monetary values show 2 decimal places
- No floating point errors

### Test: Date Formatting
- Consistent date format throughout
- No timezone issues
- Proper date parsing from CSV

### Test: Null Handling
- NULLs properly displayed as "N/A" or "—"
- Calculations skip nulls appropriately

## SQL Safety Tests

### Test: SQL Injection Prevention
**Malicious Input:** `'; DROP TABLE invoices; --`
**Expected:** Error or sanitization
**Validation:** No dangerous SQL executed

### Test: Update/Delete Prevention
**Query:** "Update all invoices to paid"
**Expected:** Error - only SELECT allowed
**Validation:** No data modified

### Test: Administrative Functions
**Query:** "Create new table or grant permissions"
**Expected:** Error - not allowed
**Validation:** Function execution blocked

## Running Tests

### Manual Testing
1. Visit http://localhost:3000/ai-query
2. Try each test query from "Test Categories" above
3. Verify results match expectations
4. Check console for errors

### Automated Testing (Future)
```bash
npm test -- ai-query
```

### Load Testing
```bash
# Using Apache Bench or similar
ab -n 100 -c 10 http://localhost:3000/api/ai-query
```

## Test Data

The app comes with sample data:
- 3 Customers (Acme Corp, TechStart Ltd, Global Traders)
- 2 Suppliers (Office Supplies Co, Cloud Services Inc)
- 3 Products (Software License, Consulting, Printer Paper)

Add your own test data:
1. Go to Upload page
2. Create CSV with test invoices
3. Upload and verify processing

## Reporting Issues

If tests fail:
1. Check error message in response
2. Verify database has test data
3. Check Supabase connection
4. Review Gemini API quota
5. Check `.env.local` configuration

## Success Criteria

- ✅ All sales/purchase queries return accurate amounts
- ✅ Customer analysis filters correctly
- ✅ Date ranges respected
- ✅ Financial metrics calculated properly
- ✅ No SQL errors or timeouts
- ✅ Results formatted consistently
- ✅ Edge cases handled gracefully
- ✅ Performance acceptable

## Notes

- Test data timestamps reflect current date
- Queries are case-insensitive
- Date formats automatically detected
- Currency symbols optional in results
