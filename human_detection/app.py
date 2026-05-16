import cv2
import numpy as np
import requests
import base64
from flask import Flask, request, jsonify
from ultralytics import YOLO

app = Flask(__name__)

# --- KONFIGURASI TELEGRAM ---
BOT_TOKEN = "7910361449:AAFMjzZxkDQAg1y6oeIJ0gVapBXbd2e11DU"
CHAT_ID = "1275988890"

print("\n[INFO] Memuat model NCNN ke RAM...")
model = YOLO('yolov8n_ncnn_model', task='detect')
print("[INFO] Model siap menerima request POST!\n")

def kirim_ke_telegram(image_path, caption):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    try:
        with open(image_path, 'rb') as foto:
            payload = {'chat_id': CHAT_ID, 'caption': caption}
            files = {'photo': foto}
            response = requests.post(url, data=payload, files=files)
            if response.status_code == 200:
                print("\n[TELEGRAM] ✅ Berhasil mengirim alert ke HP kamu!")
            else:
                print(f"\n[TELEGRAM] ❌ Gagal mengirim: {response.text}")
    except Exception as e:
        print(f"\n[TELEGRAM] ⚠️ Error sistem: {e}")

@app.route('/', methods=['GET'])
def home():
    return "Gateway AI ESP32-CAM Menyala dan Siap Menerima POST Request!"

@app.route('/checkPerson', methods=['POST'])
def check_person():
    if 'image' not in request.files:
        return jsonify({"status": "error", "message": "Key 'image' tidak ditemukan di request"}), 400
    
    file = request.files['image']
    img_bytes = file.read()
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return jsonify({"status": "error", "message": "File gambar korup"}), 400

    results = model.predict(source=img, classes=[0], conf=0.5, imgsz=320, verbose=False)
    
    ada_orang = False
    jumlah_orang = 0
    koordinat_kotak = []
    
    r = results[0]
    boxes = r.boxes
    jumlah_orang = len(boxes)
    
    img_hasil = r.plot()
    
    # Encode gambar ke Base64 untuk JSON
    _, buffer = cv2.imencode('.jpg', img_hasil)
    gambar_base64 = base64.b64encode(buffer).decode('utf-8')
    
    if jumlah_orang > 0:
        ada_orang = True
        file_hasil = "alert_terbaru.jpg"
        
        cv2.imwrite(file_hasil, img_hasil)
        
        pesan_alert = f"🚨 AWAS! Terdeteksi {jumlah_orang} orang mencurigakan pada kamera pengawas."
        kirim_ke_telegram(file_hasil, pesan_alert)
        
        for box in boxes:
            koordinat_kotak.append({
                "confidence": round(float(box.conf[0]), 2),
                "posisi": [round(val) for val in box.xyxy[0].tolist()]
            })

    return jsonify({
        "status": "success",
        "pesan": "AWAS: Orang terdeteksi!" if ada_orang else "Aman, tidak ada orang.",
        "ada_orang": ada_orang,
        "jumlah_orang": jumlah_orang,
        "koordinat_kotak": koordinat_kotak,
        "gambar_outline": gambar_base64 
    })

if __name__ == '__main__':
    # host='0.0.0.0' Wajib agar bisa diakses ESP32 di jaringan yang sama
    app.run(host='0.0.0.0', port=5000, debug=True)