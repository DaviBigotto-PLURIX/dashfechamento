@echo off
title Plurix Procurement Dashboard
color 0B
cls
echo =====================================================================
echo    PLURIX PROCUREMENT - DASHBOARD EXECUTIVO 2026
echo =====================================================================
echo.
echo [1/2] Verificando dependencias do Node.js...
if not exist node_modules (
    echo Instalando pacotes necessarios (Express, Multer, SheetJS)...
    call npm.cmd install
)
echo.
echo [2/2] Iniciando servidor do Dashboard...
start http://localhost:3333
node server.js
pause
