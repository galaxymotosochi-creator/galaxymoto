#!/usr/bin/env python3
# CamSentry — детекция входа/выхода для TP-Link C210
# Запуск: python cam.py rtsp://логин:пароль@IP:554/stream1

import cv2, numpy as np, time, requests, sys, os, json, uuid
from datetime import datetime

# ─── Telegram ───
BOT_TOKEN = "7471473926:AAE_kyz1Qtb1J8Dddqk1aaxzBGfMQ73lSMM"
CHAT_IDS = [5368408796, 321245864]

# ─── Настройки ───
MOTION_PIXELS = 3000      # порог движения (меньше = чувствительнее)
NO_MOTION_TIMEOUT = 8     # секунд без движения = человек вышел
COOLDOWN = 8              # секунд между уведомлениями
FRAME_SKIP = 2            # каждый N-й кадр
RESIZE_WIDTH = 480        # меньше = быстрее

def send_tg(text):
    for cid in CHAT_IDS:
        try:
            requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": cid, "text": text}, timeout=5)
        except: pass

def main():
    if len(sys.argv) < 2:
        print("Использование: python cam.py rtsp://логин:пароль@IP:554/stream1")
        print("\nПример: python cam.py rtsp://admin:galaxy2026@192.168.1.49:554/stream1")
        input("Нажми Enter для выхода...")
        return

    rtsp = sys.argv[1]
    print(f"Подключаюсь к {rtsp}...")
    send_tg("🔍 CamSentry запущен!")

    cap = cv2.VideoCapture(rtsp)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
    if not cap.isOpened():
        print("❌ Не могу подключиться! Проверь RTSP-ссылку.")
        send_tg("❌ Ошибка: не могу подключиться к камере")
        input("Нажми Enter для выхода...")
        return

    backSub = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50)
    person = False
    last_motion = 0
    last_notify = 0
    frame_n = 0

    send_tg("✅ Камера работает. Жду движения...")
    print("✅ Подключено! Жду движения...")
    print("Нажми Ctrl+C в этом окне чтобы остановить.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("⚠️ Потеря кадра, переподключаюсь...")
            time.sleep(2)
            cap.open(rtsp)
            continue

        frame_n += 1
        if frame_n % (FRAME_SKIP + 1) != 0:
            continue

        h, w = frame.shape[:2]
        scale = RESIZE_WIDTH / w
        small = cv2.resize(frame, (int(w*scale), int(h*scale)))
        fgmask = backSub.apply(small)
        _, fgmask = cv2.threshold(fgmask, 200, 255, cv2.THRESH_BINARY)
        motion = cv2.countNonZero(fgmask)
        now = time.time()

        if motion > MOTION_PIXELS:
            last_motion = now
            if not person and (now - last_notify) > COOLDOWN:
                person = True
                last_notify = now
                t = datetime.now().strftime("%H:%M")
                print(f"🚶 Вход в {t} (пикселей: {motion})")
                send_tg(f"🚶 Человек вошёл в {t}")
        else:
            if person and (now - last_motion) > NO_MOTION_TIMEOUT and (now - last_notify) > COOLDOWN:
                person = False
                last_notify = now
                t = datetime.now().strftime("%H:%M")
                print(f"🚶 Выход в {t}")
                send_tg(f"🚶 Человек вышел в {t}")

        time.sleep(0.03)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏹ Остановлено.")
        send_tg("⏹ CamSentry остановлен.")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        send_tg(f"❌ Ошибка: {e}")
        input("Нажми Enter для выхода...")
