# 🎯 Finance App - Quick Reference

## 🚀 Start Here

**Live Server**: http://localhost:3002  
**AI Query Interface**: http://localhost:3002/ai-query  
**Upload Page**: http://localhost:3002/upload  
**Dashboard**: http://localhost:3002/dashboard  

---

## 📖 Documentation Quick Links

| Document | Purpose | Key Info |
|----------|---------|----------|
| **README_ENHANCED.md** | Complete setup & architecture | 🔧 Setup, 🏗️ Architecture,📚 Examples |
| **TESTING_GUIDE.md** | Test cases & validation | ✅ 30+ tests, 🔍 Edge cases |
| **ENHANCEMENTS.md** | What was added | 📋 Features, 🎯 Focus areas |
| **FINAL_SUMMARY.md** | High-level overview | 📊 Stats, 🌟 Highlights |

---

## 🤖 AI Query Examples

### Quick Test Questions
```
"What were total sales this year?"
"Which customer had the highest invoices?"
"Show me overdue invoices"
"Calculate our profit margin"
"Compare sales vs purchases for last month"
```

### What It Does
1. Converts natural language → PostgreSQL query
2. Executes safely on your database
3. Formats results beautifully
4. Generates natural language answer
5. Shows you the SQL if you want

---

## 📁 Key Files

### AI System
- `lib/ai-query.ts` - Prompt engineering & safety
- `app/api/ai-query/route.ts` - API endpoint
- `supabase/functions/ai-query-processor/` - Edge function

### Analytics
- `lib/financial-analytics.ts` - 8+ metric calculations

### Invoice Processing
- `lib/invoice-normalizer.ts` - CSV/Excel parsing
- `supabase/functions/process-invoices/` - Batch processor

### Frontend
- `app/ai-query/page.tsx` - Chat interface
- `app/dashboard/page.tsx` - Dashboard view
- `app/upload/page.tsx` - Upload interface

### Config
- `.env.local` - API keys (Supabase, Gemini)
- `supabase.json` - Edge function config
- `package.json` - Dependencies

---

## 🔧 Configuration

### Gemini API Key
```
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here
```
Get from: https://ai.google.dev

### Supabase Keys
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```
Get from: Supabase project → Settings → API

---

## 📊 Financial Metrics Available

```
Profit Margin          =  (Sales - Purchases) / Sales × 100
Cash Flow              =  Payments - Purchases
ROI                    =  (Revenue - Cost) / Cost × 100
Breakeven              =  Fixed Costs / (Price - Variable Cost)
Outstanding Receivable =  Total - Paid Amount
Overdue Amount         =  Unpaid + Late Invoices
Tax Burden             =  Total Tax / Total Revenue × 100
Customer Health        =  Active/At-Risk/Inactive Status
```

---

## ✅ Setup Checklist

- [ ] Install: `npm install`
- [ ] Environment: Create `.env.local` with keys
- [ ] Database: Run migrations in Supabase
- [ ] Functions: Deploy edge functions
- [ ] Server: `npm run dev`
- [ ] Test: Visit http://localhost:3002/ai-query
- [ ] Upload: Add test invoice data
- [ ] Query: Ask a financial question

---

## 🧪 Test the AI System

1. Visit http://localhost:3002/ai-query
2. Click example question button
3. Watch SQL generation happen
4. See natural language answer
5. Click "View SQL Query" to see query

**Example**: "What were total sales this year?"
- AI generates: `SELECT ROUND(SUM(total_amount), 2) ...`
- Database returns: `[{ total_sales: 125450.50 }]`
- AI answers: "Total sales for 2024 were $125,450.50"

---

## 🔐 Security Features

✅ SQL injection prevention  
✅ SELECT-only enforcement  
✅ Query type validation  
✅ User authentication required  
✅ Audit logging all queries  
✅ Result limiting (100 rows)  
✅ Input validation  
✅ Dangerous function blocking  

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "API key not valid" | Check `.env.local`, restart server |
| "No data found" | Upload test invoices first |
| "run_safe_query not found" | Run database migrations |
| Port 3000 taken | Server uses 3001 or 3002 instead |
| Timeout errors | Query too complex, try simpler question |

---

## 📚 Financial Query Patterns

### Sales Queries
```
"Total sales by customer"
"Top 5 customers by revenue"
"Sales this month vs last month"
"Sales trend for Q1"
```

### Payment Queries
```
"Overdue invoices"
"Total outstanding"
"Paid invoices this month"
"Payment history"
```

### Analytics Queries
```
"Profit margin"
"Cash flow"
"ROI analysis"
"Tax burden"
```

### Complex Queries
```
"Compare sales vs purchases and show margin"
"Customers with overdue > $5000"
"30-day sales trend by customer"
```

---

## 🎯 AI System Highlights

**Smart Prompting**
- Schema auto-documentation
- Financial pattern templates
- Safety constraint enforcement
- Error guidance

**Result Quality**
- Accurate SQL generation
- Safe query execution
- Natural language answers
- Result formatting

**User Experience**
- Clean UI
- SQL transparency
- Query suggestions
- Error handling

---

## 📞 Need Help?

1. **Setup Issues** → See README_ENHANCED.md
2. **Testing** → See TESTING_GUIDE.md
3. **What's New** → See ENHANCEMENTS.md
4. **Overview** → See FINAL_SUMMARY.md
5. **Errors** → Check terminal output

---

## 🚀 Next Steps

1. **Test AI Queries** - Visit /ai-query page
2. **Upload Data** - Try invoice upload
3. **View Dashboard** - See financial data
4. **Deploy Functions** - `supabase functions deploy`
5. **Customize Queries** - Extend AI patterns

---

## 📞 Support

**Server Running?** ✅ http://localhost:3002  
**Database Connected?** ✅ Supabase configured  
**AI Ready?** ✅ Gemini API key set  
**All Set!** 🎉 Start querying!

---

**Questions?** Check the documentation files or review the code comments.

*Last updated: May 26, 2026*
