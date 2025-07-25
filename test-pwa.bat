@echo off
echo.
echo ================================
echo   PWA Test & Build Script
echo ================================
echo.

echo [1/4] Installing dependencies...
call npm install

echo.
echo [2/4] Building PWA...
call npm run build

echo.
echo [3/4] Starting preview server...
echo.
echo PWA will be available at:
echo  - Local:   http://localhost:4173
echo  - Network: Check console for IP address
echo.
echo 📱 To test PWA features:
echo  1. Open in Chrome/Edge
echo  2. Go to Developer Tools ^> Application ^> Service Workers
echo  3. Check "Offline" to test offline mode
echo  4. Install PWA using address bar install button
echo.
echo Press Ctrl+C to stop the server
echo.

start "" "http://localhost:4173"
call npm run preview

echo.
echo PWA testing completed!
pause
