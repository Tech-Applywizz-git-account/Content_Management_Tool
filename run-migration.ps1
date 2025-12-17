# Run OBSERVER role migration via Supabase REST API

Write-Host "Running OBSERVER role migration..." -ForegroundColor Cyan

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
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('ADMIN', 'WRITER', 'CINE', 'EDITOR', 'DESIGNER', 'CMO', 'CEO', 'OPS', 'OBSERVER'));
"@

$headers = @{
    "apikey"        = $serviceKey
    "Authorization" = "Bearer $serviceKey"
    "Content-Type"  = "application/json"
}

$body = @{ query = $sql } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    Write-Host "Migration successful!" -ForegroundColor Green
    Write-Host "OBSERVER role is now available for user creation." -ForegroundColor Green
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
