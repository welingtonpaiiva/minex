@echo off
chcp 65001 >nul
title CASA DA LANTERNA - CONTROLE INDUSTRIAL
set PATH=C:\Program Files\nodejs;%PATH%

echo =================================================================
echo   INICIANDO SISTEMA CASA DA LANTERNA (CONTROLE DE MATERIAIS)
echo =================================================================
echo.
echo Abrindo o navegador em http://localhost:3000 ...
start http://localhost:3000

cd /d "%~dp0backend"
npm run dev

pause
