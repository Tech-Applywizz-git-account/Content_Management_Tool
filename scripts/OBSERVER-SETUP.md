# 🗄️ Add job_title Column to Users Table

## Issue
The `job_title` column doesn't exist in your Supabase `users` table yet. We need to add it before OBSERVER users can work properly.

## Solution - Run SQL Migration

### **Step 1: Open Supabase SQL Editor**
1. Go to https://supabase.com/dashboard
2. Select your project: **zxnevoulicmapqmniaos**
3. Click **SQL Editor** in the left sidebar

### **Step 2: Run This SQL**

Copy and paste this SQL into the editor:

```sql
-- Add job_title column to users table for OBSERVER role
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Add comment to column
COMMENT ON COLUMN users.job_title IS 'Job title for OBSERVER role users (COO, CRO, CTO, CFO, etc.)';

-- Create index for faster queries on observers
CREATE INDEX IF NOT EXISTS idx_users_role_job_title ON users(role, job_title) WHERE role = 'OBSERVER';
```

### **Step 3: Click "Run"**

You should see: `Success. No rows returned`

---

## After Migration - Re-create Observer Users

Once the column is added, run this command again:

```powershell
$env:SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4bmV2b3VsaWNtYXBxbW5pYW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYwMjM1NiwiZXhwIjoyMDgwMTc4MzU2fQ.drPYqcrPuCAsijag-gZIFcr5MDU7wAPYCRuSzhylCAY"

node scripts/create-observers.js
```

---

## Test Observer Logins

After creating the users, login with:

| Job Title | Email | Password |
|-----------|-------|----------|
| **COO** | coo@applywizz.com | `coo123` |
| **CRO** | cro@applywizz.com | `cro123` |
| **CTO** | cto@applywizz.com | `cto123` |

Each will show a personalized dashboard! 👔💰💻

---

## What You'll See

### COO Login:
```
👔 COO - Executive Dashboard
Welcome back, John Smith (Chief Operating Officer) 👋
Track operational efficiency across all content workflows
```

### CRO Login:
```
💰 CRO - Executive Dashboard  
Welcome back, Sarah Johnson (Chief Revenue Officer) 👋
Monitor content impact on revenue and lead generation
```

### CTO Login:
```
💻 CTO - Executive Dashboard
Welcome back, Mike Chen (Chief Technology Officer) 👋
Review technical content and product announcements
```

---

## Quick Steps Summary:

1. ✅ Open Supabase SQL Editor
2. ✅ Run the SQL migration (adds job_title column)
3. ✅ Re-run `node scripts/create-observers.js`
4. ✅ Login as COO, CRO, or CTO to test!

That's it! 🎉
