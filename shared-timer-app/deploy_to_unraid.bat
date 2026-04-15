@echo off
echo ===================================================
echo   Deploying CollabTimer to Unraid
echo ===================================================

echo [1/4] Building production frontend with Vite...
call npm run build
if %errorlevel% neq 0 (
    echo Error during build.
    exit /b %errorlevel%
)

echo [2/4] Building Docker image...
docker build -t shared-timer-app:latest .
if %errorlevel% neq 0 (
    echo Error during Docker build.
    exit /b %errorlevel%
)

echo [3/4] Exporting Docker image to deploy folder...
if not exist deploy mkdir deploy
docker save shared-timer-app:latest -o deploy\shared-timer-app.tar
if %errorlevel% neq 0 (
    echo Error during Docker save.
    exit /b %errorlevel%
)

echo [4/4] Copying Dockerfile to Unraid (\\unraidbox\appdata\CollabTimer)...
copy /Y deploy\shared-timer-app.tar \\unraidbox\appdata\CollabTimer\shared-timer-app.tar
if %errorlevel% neq 0 (
    echo Error copying files to Unraid. Please check the network path \\unraidbox\appdata\CollabTimer.
    exit /b %errorlevel%
)

echo.
echo ===================================================
echo   Deployment files copied successfully!
echo.
echo   To apply changes on Unraid, run the following
echo   commands in your Unraid terminal:
echo.
echo   cd /mnt/user/appdata/CollabTimer
echo   docker compose down
echo   docker load -i shared-timer-app.tar
echo   docker compose up -d
echo ===================================================
pause
