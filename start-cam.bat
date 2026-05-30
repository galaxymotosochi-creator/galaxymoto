@echo off
chcp 1251 >nul
echo.
echo ===== CamSentry — Установка и запуск =====
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Python не найден. Скачиваю...
    curl -o %temp%\python-installer.exe https://www.python.org/ftp/python/3.12.3/python-3.12.3-amd64.exe
    start /wait %temp%\python-installer.exe /quiet InstallAllUsers=1 PrependPath=1
    echo Python установлен!
)

echo Устанавливаю opencv...
pip install opencv-python-headless --quiet

echo Запускаю скрипт...
python cam.py
pause
