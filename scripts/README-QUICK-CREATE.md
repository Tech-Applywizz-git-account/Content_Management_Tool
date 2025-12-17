# Quick User Creation Script

## Problem
Chrome extensions are blocking the web UI from creating users.

## Solution
Use this Node.js script to create users directly via the Supabase API, bypassing the browser entirely.

## How to Use

1. **Open PowerShell** in this directory: `Content-Final`

2. **Set the service key**:
```powershell
$env:SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4bmV2b3VsaWNtYXBxbW5pYW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDYwMjM1NiwiZXhwIjoyMDgwMTc4MzU2fQ.drPYqcrPuCAsijag-gZIFcr5MDU7wAPYCRuSzhylCAY"
```

3. **Run the script**:
```powershell
node scripts/quick-create-user.js
```

4. **Follow the prompts** to enter:
   - Full name
   - Email
   - Role (WRITER/DESIGNER/EDITOR/CINE/CMO/CEO/OPS/ADMIN)
   - Phone (optional)

The user will be created in BOTH:
- ✅ Authentication table (`auth.users`)
- ✅ Database table (`public.users`)

And they will receive an invitation email.

## Permanent Fix for Web UI

To fix the Chrome extension interference:
1. **Disable Chrome extensions** (especially LinkedIn/job search extensions)
2. **OR use Incognito mode** when accessing the admin panel
3. **OR use a different browser** (Firefox, Edge)
