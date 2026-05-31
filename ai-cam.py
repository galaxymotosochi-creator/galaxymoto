#!/usr/bin/env python3
# AI CamSentry — YOLOv8 через OpenCV + Telegram
# Бесплатно, без подписок, нейросеть от Microsoft/Ultralytics
#
# Установка:
#   pip install opencv-python-headless requests numpy
#
# Запуск:
#   python ai-cam.py rtsp://логин:пароль@IP:554/stream1

import cv2
import numpy as np
import requests
import sys
import time
import os
from datetime import datetime

# ─── Telegram ───
BOT_TOKEN = "7471473926:AAE_kyz1Qtb1J8Dddqk1aaxzBGfMQ73lSMM"
CHAT_IDS = [5368408796, 321245864]
MODEL_PATH = "yolov8n.onnx"

# ─── Классы YOLO, которые нас интересуют ───
PERSON_ID = 0
MOTORCYCLE_ID = 3
CAR_ID = 2
TARGET_CLASSES = {PERSON_ID: "Человек", MOTORCYCLE_ID: "Скутер", CAR_ID: "Машина"}

# ─── Настройки детекции ───
CONF_THRESHOLD = 0.4     # уверенность (0-1), меньше = больше срабатываний
NO_MOTION_TIMEOUT = 8    # секунд без объекта = вышел
COOLDOWN = 10            # секунд между уведомлениями
FRAME_SKIP = 5           # каждый N-й кадр обрабатываем
INPUT_SIZE = 640         # размер для нейросети

def send_tg(text):
    for cid in CHAT_IDS:
        try:
            requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": cid, "text": text}, timeout=5)
        except:
            pass

def download_yolo():
    """Скачивает YOLOv8n ONNX модель (6 МБ)"""
    url = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.onnx"
    if not os.path.exists(MODEL_PATH) or os.path.getsize(MODEL_PATH) < 1000000:
        print("📥 Скачиваю YOLO модель...")
        import urllib.request
        urllib.request.urlretrieve(url, MODEL_PATH)
        print("✅ Модель скачана!")

def load_classes():
    """COCO классы для YOLO"""
    return [
        "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat",
        "traffic light","fire hydrant","stop sign","parking meter","bench","bird","cat",
        "dog","horse","sheep","cow","elephant","bear","zebra","giraffe","backpack",
        "umbrella","handbag","tie","suitcase","frisbee","skis","snowboard","sports ball",
        "kite","baseball bat","baseball glove","skateboard","surfboard","tennis racket",
        "bottle","wine glass","cup","fork","knife","spoon","bowl","banana","apple",
        "sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair",
        "couch","potted plant","bed","dining table","toilet","tv","laptop","mouse",
        "remote","keyboard","cell phone","microwave","oven","toaster","sink",
        "refrigerator","book","clock","vase","scissors","teddy bear","hair drier",
        "toothbrush"
    ]

def detect_objects(net, frame):
    """Запускает YOLO на кадре, возвращает список найденных объектов"""
    h, w = frame.shape[:2]
    
    # Подготовка кадра для нейросети
    blob = cv2.dnn.blobFromImage(frame, 1/255.0, (INPUT_SIZE, INPUT_SIZE), 
                                  swapRB=True, crop=False)
    net.setInput(blob)
    
    outputs = net.forward()[0]
    
    objects = []
    for detection in outputs:
        scores = detection[4:]
        class_id = np.argmax(scores)
        confidence = scores[class_id]
        
        if confidence > CONF_THRESHOLD and class_id in TARGET_CLASSES:
            cx, cy, bw, bh = detection[:4] * np.array([w, h, w, h])
            x1 = int(cx - bw/2)
            y1 = int(cy - bh/2)
            x2 = int(cx + bw/2)
            y2 = int(cy + bh/2)
            objects.append({
                "class": class_id,
                "name": TARGET_CLASSES[class_id],
                "confidence": float(confidence),
                "box": (x1, y1, x2, y2)
            })
    
    return objects

def main():
    if len(sys.argv) < 2:
        print("Использование: python ai-cam.py rtsp://логин:пароль@IP:554/stream1")
        print("\nПример:")
        print("  python ai-cam.py rtsp://admin:galaxy2026@192.168.1.49:554/stream1")
        input("\nНажми Enter для выхода...")
        return

    rtsp = sys.argv[1]
    print(f"📷 Подключаюсь к {rtsp}...")
    send_tg("🤖 AI CamSentry запущен! (YOLOv8)")

    # Скачиваем модель если нет
    download_yolo()

    # Загружаем нейросеть
    print("🧠 Загружаю YOLOv8...")
    net = cv2.dnn.readNetFromONNX(MODEL_PATH)
    net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
    net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    
    classes = load_classes()
    print("✅ Нейросеть готова!")

    # Подключаемся к RTSP
    cap = cv2.VideoCapture(rtsp)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
    
    if not cap.isOpened():
        print("❌ Не могу подключиться к камере!")
        send_tg("❌ Ошибка: RTSP не доступен")
        input("Нажми Enter...")
        return

    person_present = False
    last_seen_time = 0
    last_notify_time = 0
    frame_count = 0

    send_tg("✅ Камера подключена. Наблюдаю...")
    print("✅ Наблюдаю. Нажми Ctrl+C для остановки.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("⚠️ Потеря кадра, переподключаюсь...")
            time.sleep(2)
            cap.open(rtsp)
            continue

        frame_count += 1
        now = time.time()

        # Обрабатываем каждый N-й кадр
        if frame_count % (FRAME_SKIP + 1) == 0:
            objects = detect_objects(net, frame)
            
            # Ищем людей и скутеры
            has_target = any(
                o["class"] in TARGET_CLASSES 
                for o in objects
            )

            if has_target:
                last_seen_time = now
                # Называем что именно нашли
                found = [o["name"] for o in objects if o["class"] in TARGET_CLASSES]
                found_uniq = list(set(found))
                
                if not person_present and (now - last_notify_time) > COOLDOWN:
                    person_present = True
                    last_notify_time = now
                    t = datetime.now().strftime("%H:%M:%S")
                    msg = f"🚶 Обнаружен: {', '.join(found_uniq)} в {t}"
                    print(f"✅ {msg}")
                    send_tg(msg)
            else:
                if person_present and (now - last_seen_time) > NO_MOTION_TIMEOUT \
                   and (now - last_notify_time) > COOLDOWN:
                    person_present = False
                    last_notify_time = now
                    t = datetime.now().strftime("%H:%M:%S")
                    msg = f"🚶 Никого нет в {t}"
                    print(f"✅ {msg}")
                    send_tg(msg)

        # Небольшая пауза
        time.sleep(0.01)

    cap.release()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏹ Остановлено.")
        send_tg("⏹ AI CamSentry остановлен.")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        send_tg(f"❌ Ошибка AI CamSentry: {e}")
        input("Нажми Enter...")
