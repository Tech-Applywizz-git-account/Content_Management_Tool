# Run priority enum migration via Supabase REST API

Write-Host "Running priority enum migration..." -ForegroundColor Cyan

# Read .env file
$envContent = Get-Content .env
$serviceKey = ($envContent | Where-Object { $_ -like "VITE_SUPABASE_SERVICE_ROLE_KEY=*" }) -replace "VITE_SUPABASE_SERVICE_ROLE_KEY=", ""

if (-not $serviceKey) {
    Write-Host "Error: VITE_SUPABASE_SERVICE_ROLE_KEY not found in .env file" -ForegroundColor Red
    Write-Host "Please add your service role key to .env" -ForegroundColor Yellow
    exit 1
}

$url = "https://zxnevoulicmapqmniaos.supabase.co/rest/v1/rpc/exec_sql"

$sql = @"
-- Update any 'MEDIUM' values to 'NORMAL' to align with TypeScript types
UPDATE public.projects 
SET priority = 'NORMAL' 
WHERE priority = 'MEDIUM';

-- Then alter the table to update the CHECK constraint
ALTER TABLE public.projects 
DROP CONSTRAINT IF EXISTS projects_priority_check;

ALTER TABLE public.projects 
ADD CONSTRAINT projects_priority_check 
CHECK (priority IN ('HIGH', 'NORMAL', 'LOW'));
"@

$headers = @{
    "apikey"        = $serviceKey
    "Authorization" = "Bearer $serviceKey"
    "Content-Type"  = "application/json"
}

$body = @{ query = $sql } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    Write-Host "Priority enum migration successful!" -ForegroundColor Green
    Write-Host "Priority column now supports HIGH, MEDIUM, and LOW values." -ForegroundColor Green
}
catch {
    Write-Host "API method not available" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run this SQL manually in Supabase SQL Editor:" -ForegroundColor Yellow
    Write-Host $sql -ForegroundColor White
    Write-Host ""
    Write-Host "1. Go to: https://supabase.com/dashboard/project/zxnevoulicmapqmniaos/sql/new" -ForegroundColor Cyan
    Write-Host "2. Paste the SQL above" -ForegroundColor Cyan
    Write-Host "3. Click Run" -ForegroundColor Cyan
}