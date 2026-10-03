@echo off
REM KMU Pick AI - Local Crawler 실행 배치
REM 이 배치 파일은 mobile-android\local-crawler 폴더에서 실행한다.
cd /d "%~dp0"
node server.mjs --port 8000
