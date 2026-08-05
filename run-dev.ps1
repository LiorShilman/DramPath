# DrumPath — הפעלת סביבת הפיתוח המלאה לתכונת שליטת-הטלפון-מרחוק (ADR 0007):
# שרת ה-Vite (עם --host, כדי שהטלפון יוכל להגיע אליו) + שרת ה-relay
# (server/remote-drum-relay), כל אחד בחלון PowerShell נפרד. שירות ייבוא
# האודיו (server/drum-import-service) נפרד לגמרי ולא קשור לתכונה הזו — לא
# מופעל כאן.
$root = $PSScriptRoot
$relayDir = "$root\server\remote-drum-relay"

if (-not (Test-Path "$root\node_modules")) {
    Write-Host "מתקין תלויות frontend (פעם ראשונה)..." -ForegroundColor Cyan
    npm install
}

if (-not (Test-Path "$relayDir\.venv\Scripts\python.exe")) {
    Write-Host "יוצר סביבה וירטואלית ומתקין תלויות ל-relay (פעם ראשונה)..." -ForegroundColor Cyan
    python -m venv "$relayDir\.venv"
    & "$relayDir\.venv\Scripts\pip.exe" install -r "$relayDir\requirements.txt"
}

Write-Host ""
Write-Host "כתובות IP מקומיות של המחשב הזה (בטלפון תזין את זו שמתאימה לרשת הביתית שלך, ולא כתובת וירטואלית):" -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } |
    ForEach-Object { Write-Host "  $($_.IPAddress)  ($($_.InterfaceAlias))" }
Write-Host ""

Write-Host "מפעיל relay (ws://<IP>:8001) ו-Vite (http://<IP>:5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "& '$relayDir\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --app-dir '$relayDir'"
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root'; npm run dev -- --host"

Start-Sleep 3
Start-Process "http://localhost:5173"
