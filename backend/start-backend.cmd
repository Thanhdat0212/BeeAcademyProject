@echo off
title Bee Academy Backend
echo ============================================
echo   Bee Academy Backend - Spring Boot 3.2
echo ============================================
echo.

cd /d "%~dp0"

echo Starting backend on http://localhost:8080 ...
echo Press Ctrl+C to stop.
echo.

where mvn.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: Maven was not found in PATH.
  echo Install Maven or add its bin directory to PATH, then try again.
  pause
  exit /b 1
)

call mvn.cmd spring-boot:run

pause
