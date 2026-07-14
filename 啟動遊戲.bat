@echo off
rem Pocket Abyss launcher (Edge app window)
set "GAME=file:///C:/Users/style/code/game/index.html"
set "PROFILE=%LOCALAPPDATA%\PocketAbyss"

set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --app="%GAME%" --window-size=436,736 --user-data-dir="%PROFILE%"
) else (
  start "" "%~dp0index.html"
)
