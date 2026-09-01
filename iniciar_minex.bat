@echo off
chcp 65001 >nul
title MineX - Servidor de Portaria e Mina
echo ======================================================
echo    INICIANDO SERVIDOR MINEX (CONTROLE INDUSTRIAL)
echo ======================================================
echo.
echo Abrindo o navegador em http://localhost:3000 ...
start http://localhost:3000

"C:\Users\v-welingtonpaiva\.gemini\antigravity-ide\bin\node.exe" server.js
pause
