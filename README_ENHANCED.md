# Finance Application - AI-Powered Invoice Management & Query System

A sophisticated finance application with bulk invoice processing, AI-powered financial querying, and advanced analytics. Built with Next.js, Supabase, and Google Gemini AI.

## 🎯 Key Features

### 1. **AI-Powered Financial Querying (Primary Focus)**
- Natural language financial questions → SQL queries → Natural language answers
- Advanced prompt engineering for accurate financial data interpretation
- Query validation and safety checks to prevent hallucination
- Financial metric calculations (ROI, profit margins, cash flow analysis)
- Period comparisons and trend analysis
- Built-in error handling with helpful suggestions

**Example Queries:**
- "What were total sales in Q1 2024?"
- "Compare sales vs purchases for the last 30 days"
- "Which customer had the highest invoices?"
- "Show me all overdue invoices with details"
- "Calculate our profit margin for the current year"

### 2. **Bulk Invoice Upload & Processing**
- Support for CSV and Excel formats
- Intelligent column mapping with flexible alias detection
- Automatic format normalization
- Duplicate detection with fuzzy matching
- Comprehensive validation and error reporting
- Background processing via Supabase Edge Functions
- Audit trail and processing logs

### 3. **Database Architecture**
```
Customers <---> Invoices <---> Suppliers
                   ↓
            Invoice Line Items
                   ↓
               Products
                   ↓
            Transactions
```

## 🚀 Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (Supabase)
- **AI**: Google Gemini Pro API
- **Authentication**: Supabase Auth
- **File Processing**: CSV & Excel parsing
- **Edge Functions**: Deno-based serverless functions

## 📋 Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier available)
- Google Gemini API key

### 1. Environment Setup

```bash
# Clone repository
git clone <repo-url>
cd finance-app

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
```

### 2. Configure `.env.local`

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Gemini AI
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

**How to get these values:**

- **Supabase**: Create project at [app.supabase.com](https://app.supabase.com) → Settings → API
- **Gemini API Key**: Get from [ai.google.dev](https://ai.google.dev)

### 3. Database Migrations

Run migrations to set up the database schema:

```bash
# In Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Create new query
# 3. Copy and run: supabase/migrations/001_initial_schema.sql
# 4. Copy and run: supabase/migrations/002_rpc_and_sample.sql
```

Or use CLI:
```bash
supabase migration up
```

### 4. Deploy Edge Functions

```bash
# Deploy AI query processor
supabase functions deploy ai-query-processor

# Deploy invoice processor
supabase functions deploy process-invoices
```

### 5. Run Development Server

```bash
npm run dev
# Server starts at http://localhost:3000
```

## 🏗️ Architecture Overview

### AI Query Flow

```
User Question
    ↓
Validation (length, financial relevance)
    ↓
Enhanced Prompt Engineering
    ├─ Schema description
    ├─ Financial query patterns
    ├─ Safety constraints
    └─ Example formats
    ↓
Google Gemini Pro
    ↓
JSON Response (SQL + Explanation)
    ↓
Safety Checks
    ├─ Only SELECT queries
    ├─ No dangerous keywords
    └─ Pattern validation
    ↓
PostgreSQL Query Execution
    ↓
Results Formatting
    ├─ Currency formatting
    ├─ Date parsing
    └─ Data type inference
    ↓
Natural Language Answer Generation
    ├─ Context-aware summaries
    ├─ Accuracy validation
    └─ Financial metric highlighting
    ↓
User Response
```

### Invoice Processing Flow

```
Uploaded File (CSV/Excel)
    ↓
Column Mapping
    ├─ Flexible alias detection
    ├─ Multi-format support
    └─ Header normalization
    ↓
Data Parsing & Validation
    ├─ Date parsing
    ├─ Amount parsing
    ├─ Type inference
    └─ Field validation
    ↓
Duplicate Detection
    ├─ Exact match check
    ├─ Fuzzy matching
    └─ Confidence scoring
    ↓
Normalized Invoice Object
    ↓
Batch Processing
    ├─ Customer/Supplier creation
    ├─ Invoice creation
    └─ Line items insertion
    ↓
Audit Trail & Logging
    ↓
Database Storage
```

## 📊 API Endpoints

### AI Query Endpoint
```
POST /api/ai-query

Request:
{
  "question": "What were total sales this year?"
}

Response:
{
  "question": "What were total sales this year?",
  "sql": "SELECT ROUND(SUM(total_amount), 2) as total_sales FROM invoices WHERE invoice_type = 'sales' AND EXTRACT(YEAR FROM invoice_date) = 2024",
  "explanation": "Calculates the sum of all sales invoices for 2024",
  "answer": "Total sales for 2024 were $125,450.50",
  "results": [{ "total_sales": 125450.50 }],
  "rowCount": 1
}
```

### Upload Endpoint
```
POST /api/upload

Accepts multipart file upload (CSV/Excel)
Returns processing log with success/error counts
```

## 🔐 Security Features

- Row Level Security (RLS) in PostgreSQL
- SQL injection prevention via parameterized queries
- AI safety checks on generated SQL
- Dangerous keyword detection
- Query type validation (SELECT only)
- Service role for sensitive operations
- User authentication required
- Audit logging for all queries

## 📈 Financial Metrics Supported

### Basic Metrics
- Total Sales / Purchases
- Outstanding Balance
- Overdue Invoices
- Cash Flow Analysis

### Advanced Metrics
- Profit Margin Calculation
- ROI Analysis
- Customer Lifetime Value
- Tax Burden Analysis
- Breakeven Analysis
- Trend Analysis

### Comparisons
- Period-over-period analysis
- Customer comparison
- Supplier performance
- Product-level metrics

## 🎓 Example Queries

### Sales Analysis
```
"Show me the top 5 customers by total sales value"
"What is our average invoice value for Q1?"
"How much revenue did we generate from customer 'Acme Corp'?"
```

### Payment Analysis
```
"Which invoices are overdue by more than 30 days?"
"What is our total outstanding receivable?"
"Compare paid vs pending invoices this month"
```

### Trend Analysis
```
"Show sales trend for the last 6 months"
"Which month had the highest sales this year?"
"Compare January sales to February"
```

### Financial Health
```
"Calculate our current profit margin"
"What is our cash flow for this quarter?"
"Show suppliers with highest payment amounts"
```

## 🛠️ Development

### Project Structure
```
app/
  ├── api/
  │   ├── ai-query/       # AI query endpoint
  │   └── upload/         # Invoice upload endpoint
  ├── ai-query/          # AI chat interface
  ├── dashboard/         # Financial dashboard
  ├── upload/            # Upload interface
  └── (auth)/            # Auth pages
lib/
  ├── ai-query.ts        # AI prompt engineering & safety
  ├── financial-analytics.ts  # Financial calculations
  ├── invoice-normalizer.ts   # Invoice parsing & validation
  └── supabase/          # Database clients
supabase/
  ├── functions/         # Edge functions
  └── migrations/        # Database schema
```

### Adding New Financial Queries

1. Extend financial patterns in `lib/ai-query.ts`
2. Add validation rules in `validateFinancialQuery()`
3. Update schema description if needed
4. Test with diverse date formats and amounts

### Extending Analytics

Use the `financial-analytics.ts` utilities:

```typescript
import { calculateMetrics, analyzingCustomer, identifyRiskyInvoices } from '@/lib/financial-analytics'

const metrics = calculateMetrics(invoices)
const customer = analyzeCustomer(invoices, customerId, customerName)
const risky = identifyRiskyInvoices(invoices, 30) // 30 days threshold
```

## 🧪 Testing AI Queries

Test the AI query system with different financial questions to ensure accuracy:

```bash
# Start dev server
npm run dev

# Visit http://localhost:3000/ai-query
# Try example questions provided in the UI
```

## 📝 Database Schema Highlights

### Key Tables
- `invoices` - Core invoice data with status tracking
- `invoice_line_items` - Itemized details for each invoice
- `customers` - Customer information and contact details
- `suppliers` - Vendor information
- `transactions` - Payment tracking and history
- `products` - Product/service catalog
- `upload_logs` - Audit trail for all uploads

### Indexes
Optimized for common queries:
- Invoice number lookup
- Date-based filtering
- Customer/supplier lookups
- Status filtering

## 🚨 Troubleshooting

### "API key not valid" error
- Verify Gemini API key is correct and enabled
- Check `.env.local` is loaded (restart dev server)

### "run_safe_query RPC function not found"
- Ensure migrations are run
- Check Supabase project connection

### Invoice upload failures
- Verify column headers match aliases
- Check date and amount formats
- Review error log for specific failures

### AI returns "no data found"
- Ensure test data is uploaded
- Check date ranges in query
- Verify table names in schema

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Google Gemini API](https://ai.google.dev)
- [PostgreSQL Financial Functions](https://www.postgresql.org/docs/current/functions-math.html)
- [Next.js Documentation](https://nextjs.org/docs)

## 🤝 Contributing

Contributions welcome! Areas for enhancement:
- Additional financial metrics
- More AI safety checks
- Performance optimizations
- Additional file format support
- Advanced reporting features

## 📄 License

MIT License

## 📧 Support

For issues or questions:
1. Check Troubleshooting section
2. Review database migrations
3. Verify environment variables
4. Check Supabase logs

---

**Built with focus on AI-powered financial intelligence and accuracy** ✨
