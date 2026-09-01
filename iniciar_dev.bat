@echo off
title CASA DA LANTERNA - MODO DESENVOLVIMENTO
set PATH=C:\Program Files\nodejs;%PATH%

echo =================================================================
echo   INICIANDO MODO DESENVOLVIMENTO (LIVE RELOAD CONCORRENTE)
echo =================================================================
echo.

echo Abrindo o navegador em http://localhost:3000 ...
start http://localhost:3000

cd /d "%~dp0"
npm run dev

pause
