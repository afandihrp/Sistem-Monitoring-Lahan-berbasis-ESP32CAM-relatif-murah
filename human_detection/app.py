import cv2
import numpy as np
import json
import gc
import threading
from flask import Flask, request, jsonify, Response

app = Flask(__name__)

# === OPTIMASI PI 3: Kunci proses agar tidak ada request bersamaan (mencegah OOM Crash) ===
process_lock = threading.Lock()

# Tentukan path ke file model TFLite Anda
MODEL_PATH = "yolov8n_float32.tflite" 

def run_tflite_inference(img_bgr):
    try:
        import tflite_runtime.interpreter as tflite
        print("[INFO] Menggunakan library: tflite_runtime (Mode Raspberry Pi)")
    except ImportError:
        from tensorflow import lite as tflite
        print("[INFO] Menggunakan library: tensorflow.lite (Mode PC Desktop)")

    interpreter = tflite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()

    input_details  = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    input_shape  = input_details[0]['shape']
    input_height = input_shape[1]
    input_width  = input_shape[2]
    input_dtype  = input_details[0]['dtype']

    # Preprocessing
    img_rgb     = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (input_width, input_height), interpolation=cv2.INTER_LINEAR)
    img_input   = np.expand_dims(img_resized, axis=0)

    if input_dtype == np.float32:
        img_input = img_input.astype(np.float32) / 255.0
    else:
        img_input = img_input.astype(input_dtype)

    # Inferensi
    interpreter.set_tensor(input_details[0]['index'], img_input)
    interpreter.invoke()

    output_data = interpreter.get_tensor(output_details[0]['index'])
    output_data = np.squeeze(output_data)

    # Transpose: (84, 8400) → (8400, 84)
    if output_data.shape[0] < output_data.shape[1]:
        output_data = output_data.T

    boxes       = []
    confidences = []

    orig_h, orig_w = img_bgr.shape[:2]
    CONF_THRESHOLD = 0.25
    max_score_seen = 0.0

    for row in output_data:
        # ✅ FIX BUG #1: Class scores ada di index 4 ke atas
        class_scores = row[4:]
        class_id     = int(np.argmax(class_scores))
        class_conf   = float(class_scores[class_id])

        if class_conf > max_score_seen:
            max_score_seen = class_conf

        # Hanya deteksi class 0 = 'person'
        if class_id == 0 and class_conf > CONF_THRESHOLD:
            xc, yc, w, h = float(row[0]), float(row[1]), float(row[2]), float(row[3])

            # ✅ FIX BUG #2: Koordinat normalized (0–1) langsung ke pixel asli
            x1 = int((xc - w / 2) * orig_w)
            y1 = int((yc - h / 2) * orig_h)
            x2 = int((xc + w / 2) * orig_w)
            y2 = int((yc + h / 2) * orig_h)

            boxes.append([x1, y1, x2, y2])
            confidences.append(class_conf)

    print(f"[DEBUG] Skor tertinggi: {round(max_score_seen, 4)}")

    # NMS
    final_boxes = []
    if len(boxes) > 0:
        indices = cv2.dnn.NMSBoxes(
            boxes, confidences,
            score_threshold=CONF_THRESHOLD,
            nms_threshold=0.45
        )
        if len(indices) > 0:
            for i in indices.flatten():
                final_boxes.append({
                    "confidence": round(confidences[i], 2),
                    "posisi": boxes[i]
                })

    print(f"[DEBUG] Mentah: {len(boxes)} → Pasca NMS: {len(final_boxes)}")

    del interpreter, img_rgb, img_resized, img_input, output_data
    return final_boxes


@app.route('/checkPerson', methods=['POST'])
def check_person():
    with process_lock:
        from datetime import datetime
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Incoming request received at /checkPerson")
        
        if 'image' not in request.files:
            return jsonify({"status": "error", "message": "Key 'image' tidak ditemukan di request"}), 400
        
        file = request.files['image']
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"status": "error", "message": "File gambar korup"}), 400

        # === OPTIMASI PI 3: Downscale gambar jika terlalu besar ===
        height, width = img.shape[:2]
        max_dim = 640
        if max(height, width) > max_dim:
            scale = max_dim / max(height, width)
            img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_LINEAR)
            # Update data dimensi setelah dikecilkan
            height, width = img.shape[:2]

        # Jalankan proses TFLite secara on-demand
        print("[INFO] Menjalankan inferensi TFLite...")
        koordinat_kotak = run_tflite_inference(img)
        
        jumlah_orang = len(koordinat_kotak)
        ada_orang = jumlah_orang > 0
        
        # === ENGINE OUTLINE HIGH-VISIBILITY (Menggantikan r.plot() Ultralytics) ===
        img_hasil = img.copy()
        for box in koordinat_kotak:
            x1, y1, x2, y2 = box["posisi"]
            conf = box["confidence"]
            
            # Clamp koordinat agar tidak offset keluar dari batas piksel gambar asli
            x1 = max(0, min(x1, width - 1))
            y1 = max(0, min(y1, height - 1))
            x2 = max(0, min(x2, width - 1))
            y2 = max(0, min(y2, height - 1))
            
            # 1. Gambar Bounding Box Merah (Ketebalan = 3 piksel)
            cv2.rectangle(img_hasil, (x1, y1), (x2, y2), (0, 0, 255), 3)
            
            # 2. Hitung ukuran text label secara dinamis
            label = f"Orang: {int(conf * 100)}%"
            (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            
            # Amankan posisi Y banner agar tidak offset ke atas jika objek berada mepet di tepi atas layar
            y_banner_top = max(y1 - text_h - 10, 0)
            y_banner_bottom = max(y1, text_h + 10)
            
            # 3. Gambar Background Banner Merah Solid untuk Text Label
            cv2.rectangle(img_hasil, (x1, y_banner_top), (x1 + text_w + 4, y_banner_bottom), (0, 0, 255), cv2.FILLED)
            
            # 4. Tulis Teks Putih di atas Banner Merah
            cv2.putText(img_hasil, label, (x1 + 2, y_banner_bottom - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)
        # ===========================================================================

        # Encode gambar hasil outlining (JPEG format)
        _, buffer = cv2.imencode('.jpg', img_hasil)
        img_bytes_out = buffer.tobytes()
        
        json_data = {
            "status": "success",
            "pesan": "AWAS: Orang terdeteksi!" if ada_orang else "Aman, tidak ada orang.",
            "ada_orang": ada_orang,
            "jumlah_orang": jumlah_orang,
            "koordinat_kotak": koordinat_kotak
        }

        # === Bersihkan Sisa Memori RAM ===
        del img_bytes, nparr, img, img_hasil, buffer
        gc.collect()
        print("[INFO] RAM dibersihkan.\n")

        # Mengembalikan response sebagai multipart/form-data
        boundary = 'Response-Boundary-123456789'
        
        def generate():
            yield (f'--{boundary}\r\n'
                   f'Content-Disposition: form-data; name="details"\r\n'
                   f'Content-Type: application/json\r\n\r\n').encode('utf-8')
            yield json.dumps(json_data).encode('utf-8')
            yield b'\r\n'
            
            yield (f'--{boundary}\r\n'
                   f'Content-Disposition: form-data; name="image"; filename="output.jpg"\r\n'
                   f'Content-Type: image/jpeg\r\n\r\n').encode('utf-8')
            yield img_bytes_out
            yield b'\r\n'
            
            yield (f'--{boundary}--\r\n').encode('utf-8')
            
        return Response(generate(), mimetype=f'multipart/form-data; boundary={boundary}')

if __name__ == '__main__':
    from waitress import serve
    print("\n[INFO] Menjalankan server menggunakan Waitress di port 5000...")
    serve(app, host='0.0.0.0', port=5000, threads=4)