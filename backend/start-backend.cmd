@echo off
title Bee Academy Backend
echo ============================================
echo   Bee Academy Backend - Spring Boot 3.2
echo ============================================
echo.

cd /d "%~dp0"

set "JAVA_EXE=java"
if not "%JAVA_HOME%"=="" set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"

set "WRAPPER_JAR=%~dp0.mvn\wrapper\maven-wrapper.jar"

echo Starting backend on http://localhost:8080 ...
echo Press Ctrl+C to stop.
echo.

"%JAVA_EXE%" ^
  -classpath "%WRAPPER_JAR%" ^
  "-Dmaven.multiModuleProjectDirectory=%~dp0" ^
  org.apache.maven.wrapper.MavenWrapperMain ^
  spring-boot:run

pause
