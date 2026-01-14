# PowerShell script to run the sub-editor migration
Write-Host "🚀 Starting Sub-Editor Migration..." -ForegroundColor Green

# Check if Node.js is available
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if the JavaScript migration file exists
$migrationFile = ".\run-subeditor-migration.mjs"
if (!(Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Running migration script..." -ForegroundColor Yellow

# Run the migration
try {
    $env:VITE_SUPABASE_URL = $env:VITE_SUPABASE_URL
    $env:SUPABASE_SERVICE_ROLE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY
    
    # Execute the migration script
    node $migrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n🎉 Sub-Editor Migration completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "❌ An error occurred during migration: $_" -ForegroundColor Red
    exit 1
}