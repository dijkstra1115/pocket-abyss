@echo off
rem Pocket Abyss ONLINE launcher (Edge app window, default profile = same save as browser tab)
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=https://dijkstra1115.github.io/pocket-abyss/
) else (
  start "" https://dijkstra1115.github.io/pocket-abyss/
)
