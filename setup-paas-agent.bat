@echo off
echo.
echo ========================================
echo   SkyPanel PaaS Agent - Quick Setup
echo ========================================
echo.

cd Paas-Agent

echo [1/3] Installing agent dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Agent dependencies installed successfully!
echo.
echo [3/3] Agent is ready to run!
echo.
echo ========================================
echo   Next Steps:
echo ========================================
echo.
echo 1. Run the database migration:
echo    psql -U your_user -d your_database -f ..\migrations\003_paas_integration.sql
echo.
echo 2. Start the system:
echo    npm run dev
echo.
echo 3. Create a node in the admin panel and get the registration token
echo.
echo 4. On first run, set the registration token:
echo    set REGISTRATION_TOKEN=your-token
echo    npm run dev
echo.
echo 5. After registration, just run:
echo    npm run dev
echo.
echo ========================================
echo   Documentation
echo ========================================
echo.
echo See: .kiro\specs\paas-integration\FINAL_SETUP.md
echo.

cd ..
pause
