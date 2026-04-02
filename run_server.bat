@echo off
echo Starting Auto Race Roulette Local Server...
echo Note: This allows high-quality sounds to load (blocked by file:// protocol).
echo.
powershell -ExecutionPolicy Bypass -Command "Write-Host 'Checking for http-server...'; npx http-server ./ -p 8080 -o"
pause
