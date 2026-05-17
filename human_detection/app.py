import cv2
import numpy as np
import json
import gc
import threading
from flask import Flask, request, jsonify, Response
from ultralytics import YOLO

app = Flask(__name__)

# === OPTIMASI PI 3: Kunci proses agar tidak ada request bersamaan (mencegah OOM Crash) ===
process_lock = threading.Lock()

print("\n[INFO] Memuat model NCNN ke RAM...")
model = YOLO('yolov8n_ncnn_model', task='detect')
print("[INFO] Model siap menerima request POST!\n")

@app.route('/checkPerson', methods=['POST'])
def check_person():
    # Mencegah eksekusi paralel yang memakan RAM
    with process_lock:
        if 'image' not in request.files:
            return jsonify({"status": "error", "message": "Key 'image' tidak ditemukan di request"}), 400
        
        file = request.files['image']
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"status": "error", "message": "File gambar korup"}), 400

        # === OPTIMASI PI 3: Downscale gambar jika terlalu besar ===
        # Agar r.plot() dan imencode() tidak memakan banyak RAM/CPU
        height, width = img.shape[:2]
        max_dim = 640
        if max(height, width) > max_dim:
            scale = max_dim / max(height, width)
            img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_LINEAR)

        results = model.predict(source=img, classes=[0], conf=0.5, imgsz=320, verbose=False)
        
        ada_orang = False
        jumlah_orang = 0
        koordinat_kotak = []
        
        r = results[0]
        boxes = r.boxes
        jumlah_orang = len(boxes)
        
        img_hasil = r.plot()
        
        # Encode gambar hasil outlining (JPEG format)
        _, buffer = cv2.imencode('.jpg', img_hasil)
        img_bytes_out = buffer.tobytes()
        
        if jumlah_orang > 0:
            ada_orang = True
            for box in boxes:
                koordinat_kotak.append({
                    "confidence": round(float(box.conf[0]), 2),
                    "posisi": [round(val) for val in box.xyxy[0].tolist()]
                })

        json_data = {
            "status": "success",
            "pesan": "AWAS: Orang terdeteksi!" if ada_orang else "Aman, tidak ada orang.",
            "ada_orang": ada_orang,
            "jumlah_orang": jumlah_orang,
            "koordinat_kotak": koordinat_kotak
        }

        # === Bersihkan Memori RAM ===
        del img_bytes, nparr, img, results, r, boxes, img_hasil, buffer
        gc.collect()

        # Mengembalikan response sebagai multipart/form-data
        boundary = 'Response-Boundary-123456789'
        
        def generate():
            # Bagian JSON Data
            yield (f'--{boundary}\r\n'
                   f'Content-Disposition: form-data; name="details"\r\n'
                   f'Content-Type: application/json\r\n\r\n').encode('utf-8')
            yield json.dumps(json_data).encode('utf-8')
            yield b'\r\n'
            
            # Bagian Gambar Outlining
            yield (f'--{boundary}\r\n'
                   f'Content-Disposition: form-data; name="image"; filename="output.jpg"\r\n'
                   f'Content-Type: image/jpeg\r\n\r\n').encode('utf-8')
            yield img_bytes_out
            yield b'\r\n'
            
            # Penutup multipart
            yield (f'--{boundary}--\r\n').encode('utf-8')
            
        return Response(generate(), mimetype=f'multipart/form-data; boundary={boundary}')

if __name__ == '__main__':
    from waitress import serve
    print("\n[INFO] Menjalankan server menggunakan Waitress di port 5000...")
    serve(app, host='0.0.0.0', port=5000, threads=4)