#!/usr/bin/env python3
# AI CamSentry PRO — трекинг скутеров + учёт мастеров
# Бесплатно, YOLOv8 + OpenCV
# Запуск: python ai-cam-pro.py rtsp://логин:пароль@IP:554/stream1

import cv2
import numpy as np
import requests
import sys
import time
import os
from datetime import datetime, timedelta

# ─── Telegram ───
BOT_TOKEN = "7471473926:AAE_kyz1Qtb1J8Dddqk1aaxzBGfMQ73lSMM"
CHAT_IDS = [5368408796, 321245864]
MODEL_URL = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.onnx"
MODEL_PATH = "yolov8n.onnx"

# ─── Настройки ───
CONF_THRESHOLD = 0.25
NO_MOTION_TIMEOUT = 30      # сек без объекта = выехал/вышел
COOLDOWN = 10
FRAME_SKIP = 5
INPUT_SIZE = 640
OVERLAP_THRESHOLD = 0.3     # насколько человек должен пересекаться со скутером (0-1)

# ─── Состояние сервиса ───
scooters = {}       # {id: {name, enter_time, photo, last_seen, pos}}
masters = {}        # {master_id: {name, at_scooter_id, since, total_work, total_idle}}
next_id = 1
last_report = time.time()

PERSON_ID = 0
MOTORCYCLE_ID = 3
CAR_ID = 2
TARGET_CLASSES = {PERSON_ID: "Человек", MOTORCYCLE_ID: "Скутер"}

def send_tg(text):
    for cid in CHAT_IDS:
        try:
            requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={"chat_id": cid, "text": text}, timeout=5)
        except:
            pass

def download_yolo():
    if not os.path.exists(MODEL_PATH) or os.path.getsize(MODEL_PATH) < 1000000:
        print("📥 Скачиваю YOLO модель...")
        import urllib.request
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("✅ Модель скачана!")

def box_overlap(box1, box2):
    """Проверяет пересечение двух рамок (человек и скутер)"""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    
    if x2 < x1 or y2 < y1:
        return 0
    
    overlap = (x2 - x1) * (y2 - y1)
    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    return overlap / min(box1_area, box2_area) if min(box1_area, box2_area) > 0 else 0

def track_scooters(objects, now):
    """Трекинг скутеров с присвоением ID"""
    global next_id
    
    current_scooters = [o for o in objects if o["class"] == MOTORCYCLE_ID]
    
    # Сопоставляем текущие скутеры с существующими
    matched = set()
    for sco in current_scooters:
        best_match = None
        best_overlap = 0.3
        
        for sid, sdata in scooters.items():
            if sid in matched:
                continue
            # Если скутер недалеко от предыдущей позиции — это тот же
            dist = np.sqrt((sco["cx"] - sdata.get("last_cx", 0))**2 + 
                          (sco["cy"] - sdata.get("last_cy", 0))**2)
            if dist < 200:  # пикселей — допустимое смещение
                best_match = sid
                break
        
        if best_match:
            # Обновляем существующий
            scooters[best_match]["last_seen"] = now
            scooters[best_match]["last_cx"] = sco["cx"]
            scooters[best_match]["last_cy"] = sco["cy"]
            scooters[best_match]["pos"] = sco["box"]
            sco["id"] = best_match
            matched.add(best_match)
        else:
            # Новый скутер
            sid = f"Скутер-{next_id}"
            next_id += 1
            scooters[sid] = {
                "name": sid,
                "enter_time": now,
                "last_seen": now,
                "last_cx": sco["cx"],
                "last_cy": sco["cy"],
                "pos": sco["box"]
            }
            sco["id"] = sid
            matched.add(sid)
            print(f"  🟢 {sid} заехал!")
            send_tg(f"🛵 {sid} заехал в {datetime.now().strftime('%H:%M')}")
    
    # Проверяем, кто из скутеров пропал (выехал)
    to_remove = []
    for sid, sdata in scooters.items():
        if sid not in matched and (now - sdata["last_seen"]) > NO_MOTION_TIMEOUT:
            duration = now - sdata["enter_time"]
            mins = int(duration.total_seconds() / 60)
            print(f"  🔴 {sid} выехал! (был {mins} мин)")
            send_tg(f"🛵 {sid} выехал в {datetime.now().strftime('%H:%M')} (был {mins} мин)")
            to_remove.append(sid)
    
    for sid in to_remove:
        del scooters[sid]

def track_masters(objects, now):
    """Учёт времени мастеров у скутеров"""
    persons = [o for o in objects if o["class"] == PERSON_ID]
    scooter_boxes = [s["pos"] for s in scooters.values()]
    
    current_at_scooter = set()
    
    for p in persons:
        # Проверяем, стоит ли человек рядом со скутером
        at_scooter = False
        for sbox in scooter_boxes:
            if box_overlap(p["box"], sbox) > OVERLAP_THRESHOLD:
                at_scooter = True
                break
        
        # ID мастера — по позиции в кадре
        mid = f"Мастер-{int(p['cx']/50)}"  # упрощённо
        
        if mid not in masters:
            masters[mid] = {
                "name": mid,
                "at_scooter": False,
                "since": now,
                "total_work": timedelta(0),
                "total_idle": timedelta(0),
                "last_switch": now,
                "current_pos": p["box"]
            }
        
        m = masters[mid]
        m["current_pos"] = p["box"]
        
        if at_scooter and not m["at_scooter"]:
            # Мастер подошёл к скутеру
            m["at_scooter"] = True
            m["since"] = now
            m["total_idle"] += now - m["last_switch"]
            print(f"  🔧 {mid} работает у скутера")
            
        elif not at_scooter and m["at_scooter"]:
            # Мастер отошёл от скутера
            m["at_scooter"] = False
            m["total_work"] += now - m["since"]
            m["last_switch"] = now
            print(f"  ☕ {mid} отошёл от скутера")

def report_stats(now):
    """Отчёт по статистике в Telegram"""
    global last_report
    
    if now - last_report < 300:  # каждые 5 минут
        return
    last_report = now
    
    msg = "📊 **Статистика сервиса**\n\n"
    msg += f"🛵 Сейчас в сервисе: {len(scooters)}\n"
    
    for sid, sdata in scooters.items():
        duration = now - sdata["enter_time"]
        mins = int(duration.total_seconds() / 60)
        msg += f"   {sid} — {mins} мин\n"
    
    msg += f"\n👨‍🔧 Мастера:\n"
    for mid, mdata in masters.items():
        status = "🔧 работает" if mdata["at_scooter"] else "☕ отдыхает"
        work_min = int(mdata["total_work"].total_seconds() / 60)
        idle_min = int(mdata["total_idle"].total_seconds() / 60)
        msg += f"   {mid}: {status} (работа: {work_min}мин, отдых: {idle_min}мин)\n"
    
    send_tg(msg)

def detect_objects(net, frame):
    """Запускает YOLO на кадре"""
    h, w = frame.shape[:2]
    
    blob = cv2.dnn.blobFromImage(frame, 1/255.0, (INPUT_SIZE, INPUT_SIZE), 
                                  swapRB=True, crop=False)
    net.setInput(blob)
    outputs = net.forward()
    
    dets = outputs[0].T
    objects = []
    
    for det in dets:
        scores = det[4:]
        class_id = np.argmax(scores)
        conf = float(scores[class_id])
        
        if conf > CONF_THRESHOLD and class_id in TARGET_CLASSES:
            cx, cy, bw, bh = det[:4]
            x1 = int((cx - bw/2) * w / INPUT_SIZE)
            y1 = int((cy - bh/2) * h / INPUT_SIZE)
            x2 = int((cx + bw/2) * w / INPUT_SIZE)
            y2 = int((cy + bh/2) * h / INPUT_SIZE)
            objects.append({
                "class": class_id,
                "name": TARGET_CLASSES[class_id],
                "confidence": conf,
                "box": (x1, y1, x2, y2),
                "cx": cx,
                "cy": cy
            })
    
    return objects

def main():
    if len(sys.argv) < 2:
        print("Запуск: python ai-cam-pro.py rtsp://логин:пароль@IP:554/stream1")
        input("\nНажми Enter...")
        return

    rtsp = sys.argv[1]
    print(f"📷 Подключаюсь к {rtsp}...")
    send_tg("🤖 AI CamSentry PRO запущен!")

    download_yolo()
    
    print("🧠 Загружаю YOLOv8...")
    net = cv2.dnn.readNetFromONNX(MODEL_PATH)
    net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
    net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    print("✅ Нейросеть готова!")

    cap = cv2.VideoCapture(rtsp)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
    
    if not cap.isOpened():
        print("❌ Не могу подключиться к камере!")
        send_tg("❌ Ошибка: RTSP не доступен")
        return

    send_tg("✅ Камера подключена. Начинаю наблюдение...")
    print("✅ Наблюдаю. Статистика в Telegram каждые 5 мин. Ctrl+C для остановки.")

    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(2)
            cap.open(rtsp)
            continue

        frame_count += 1
        now = datetime.now()

        if frame_count % (FRAME_SKIP + 1) == 0:
            objects = detect_objects(net, frame)
            
            # Трекинг скутеров
            track_scooters(objects, now)
            
            # Учёт мастеров
            track_masters(objects, now)
            
            # Отчёт
            report_stats(now)
            
            # Статусная строка
            scooter_count = len(scooters)
            at_work = sum(1 for m in masters.values() if m["at_scooter"])
            total_masters = len(masters)
            extra = ""
            if scooter_count > 0:
                names = ", ".join(list(scooters.keys()))
                extra = f" | {names}"
            if total_masters > 0:
                extra += f" | 👨‍🔧 {at_work}/{total_masters} у скутеров"
            print(f"👀 {now.strftime('%H:%M:%S')} | 🛵 {scooter_count}{extra}")

        time.sleep(0.03)

    cap.release()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏹ Остановлено.")
        send_tg("⏹ AI CamSentry PRO остановлен.")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        send_tg(f"❌ Ошибка: {e}")
        input("Нажми Enter...")
