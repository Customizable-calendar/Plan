@echo off
REM Double-click: start the dev server with latest stage code (scripts/stage.mjs)
cd /d "%~dp0"
call pnpm stage %*
pause
