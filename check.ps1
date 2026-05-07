# ─────────────────────────────────────────────────────────────
#  check.ps1  —  Full error & lint check cho erp-backend
#  Chạy: .\check.ps1
#  Kết quả: in ra từng bước, tổng kết ở cuối
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Continue'
$results = @()

function Step {
    param([string]$Label, [string]$Cmd)

    Write-Host ""
    Write-Host "──────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host "  $Label" -ForegroundColor Cyan
    Write-Host "──────────────────────────────────────────" -ForegroundColor Cyan

    $output = Invoke-Expression $Cmd 2>&1
    $exitCode = $LASTEXITCODE

    $output | ForEach-Object { Write-Host $_ }

    if ($exitCode -eq 0 -or $exitCode -eq $null) {
        Write-Host "  ✓ PASS" -ForegroundColor Green
        $script:results += [PSCustomObject]@{ Step = $Label; Status = "PASS" }
    } else {
        Write-Host "  ✗ FAIL (exit $exitCode)" -ForegroundColor Red
        $script:results += [PSCustomObject]@{ Step = $Label; Status = "FAIL" }
    }
}

# ── 1. TypeScript type-check (không emit file) ──────────────
Step "TypeScript: type-check" "npx tsc --noEmit --project tsconfig.json 2>&1"

# ── 2. TypeScript build check (tsconfig.build.json) ─────────
Step "TypeScript: build check" "npx tsc --noEmit --project tsconfig.build.json 2>&1"

# ── 3. ESLint (không --fix, chỉ report) ─────────────────────
Step "ESLint: lint report" "npx eslint `"{src,test}/**/*.ts`" --max-warnings=0 2>&1"

# ── 4. Prettier: check format ────────────────────────────────
Step "Prettier: format check" "npx prettier --check `"src/**/*.ts`" `"test/**/*.ts`" 2>&1"

# ── Tổng kết ─────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor White
Write-Host "  KẾT QUẢ TỔNG HỢP" -ForegroundColor White
Write-Host "══════════════════════════════════════════" -ForegroundColor White

$failCount = 0
foreach ($r in $results) {
    if ($r.Status -eq "PASS") {
        Write-Host "  ✓  $($r.Step)" -ForegroundColor Green
    } else {
        Write-Host "  ✗  $($r.Step)" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
if ($failCount -eq 0) {
    Write-Host "  Tất cả kiểm tra PASS." -ForegroundColor Green
} else {
    Write-Host "  $failCount bước FAIL — xem chi tiết ở trên." -ForegroundColor Red
}
Write-Host "══════════════════════════════════════════" -ForegroundColor White
