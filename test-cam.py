import cv2, time

rtsp = "rtsp://galaxymoto:Yulia909090$@192.168.1.49:554/stream1"
cap = cv2.VideoCapture(rtsp)

if not cap.isOpened():
    print("❌ Не могу подключиться к камере!")
    input("Нажми Enter...")
else:
    print("✅ Камера подключена! Делаю снимок...")
    time.sleep(2)
    ret, frame = cap.read()
    if ret:
        path = r"C:\Users\1\Desktop\test-cam.jpg"
        cv2.imwrite(path, frame)
        print(f"✅ Фото сохранено: {path}")
    else:
        print("❌ Не могу получить кадр")
    input("Нажми Enter для выхода...")
