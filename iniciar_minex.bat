@echo off
title CASA DA LANTERNA - CONTROLE INDUSTRIAL
set PATH=C:\Program Files\nodejs;%PATH%

echo =================================================================
echo   INICIANDO SISTEMA CASA DA LANTERNA (CONTROLE DE MATERIAIS)
echo =================================================================
echo.

echo [1/2] Compilando arquivos do Frontend e Backend...
cd /d "%~dp0frontend"
call npm run build >nul 2>&1

cd /d "%~dp0backend"
call npm run build >nul 2>&1

echo.
echo [2/2] Iniciando Servidor na Porta 5000...
start "Servidor Minex" /b npm start

echo.
echo Aguardando inicializacao do servidor (3 segundos)...
ping -n 4 127.0.0.1 >nul

echo Abrindo o sistema no navegador em http://localhost:5000 ...
start http://localhost:5000

echo.
echo =================================================================
echo   SISTEMA MINEX OPERACIONAL EM HTTP://LOCALHOST:5000
echo   Mantenha esta janela aberta para manter o servidor ativo.
echo =================================================================
echo.
