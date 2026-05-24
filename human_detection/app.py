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
    """
    Memuat interpreter TFLite secara on-demand berbasis arsitektur sistem (PC/Pi),
    melakukan preprocessing gambar, menjalankan inferensi, dan mengembalikan koordinat 'orang'.
    """
    # === DETEKSI OTOMATIS ARSITEKTUR SYSTEM ===
    try:
        # Digunakan di Raspberry Pi (Ringan & Hemat RAM)
        import tflite_runtime.interpreter as tflite
        print("[INFO] Menggunakan library: tflite_runtime (Mode Raspberry Pi)")
    except ImportError:
        # Digunakan di Laptop / PC Desktop (Karena tflite_runtime tidak mendukung x86_64 secara default)
        from tensorflow import lite as tflite
        print("[INFO] Menggunakan library: tensorflow.lite (Mode PC Desktop)")
    # ==========================================

    # 1. Load Model On-Demand
    interpreter = tflite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()

    # 2. Ambil detail input & output tensor
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # Ambil ukuran input yang diminta model (biasanya [1, 640, 640, 3] atau [1, 320, 320, 3])
    input_shape = input_details[0]['shape']
    input_height, input_width = input_shape[1], input_shape[2]

    # 3. Preprocessing Gambar (Resize & Normalisasi sesuai kebutuhan YOLOv8)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (input_width, input_height), interpolation=cv2.INTER_LINEAR)
    img_input = np.expand_dims(img_resized, axis=0).astype(np.float32) / 255.0

    # 4. Jalankan Inferensi
    interpreter.set_tensor(input_details[0]['index'], img_input)
    interpreter.invoke()
    
    # 5. Ambil Output
    output_data = interpreter.get_tensor(output_details[0]['index'])
    output_data = np.squeeze(output_data)
    
    # Transpose format output YOLOv8 TFLite dari (84, 8400) menjadi (8400, 84)
    if output_data.shape[0] < output_data.shape[1]:
        output_data = output_data.T

    boxes = []
    confidences = []
    
    # Faktor skala untuk mengembalikan koordinat ke ukuran asli gambar BGR
    orig_h, orig_w = img_bgr.shape[:2]
    x_scale = orig_w / input_width
    y_scale = orig_h / input_height

    # 6. Parsing Output (Mencari Class 0 = Person)
    # Diturunkan ke 0.25 agar TFLite lebih sensitif mendeteksi orang di Pi/PC
    CONF_THRESHOLD = 0.25  
    
    for row in output_data:
        class_conf = float(row[4]) # Index 4 adalah kelas 'person' di COCO dataset
        if class_conf > CONF_THRESHOLD:
            xc, yc, w, h = row[0], row[1], row[2], row[3]
            
            # Ubah dari Center-XYWH ke XYXY (Top-Left, Bottom-Right)
            x1 = int((xc - w / 2) * x_scale)
            y1 = int((yc - h / 2) * y_scale)
            x2 = int((xc + w / 2) * x_scale)
            y2 = int((yc + h / 2) * y_scale)
            
            boxes.append([x1, y1, x2, y2])
            confidences.append(class_conf)

    # 7. NMS (Non-Maximum Suppression) untuk menghapus kotak bertumpuk
    final_boxes = []
    if len(boxes) > 0:
        indices = cv2.dnn.NMSBoxes(boxes, confidences, score_threshold=CONF_THRESHOLD, nms_threshold=0.4)
        if len(indices) > 0:
            for i in indices.flatten():
                final_boxes.append({
                    "confidence": round(confidences[i], 2),
                    "posisi": boxes[i]
                })

    print(f"[DEBUG TFLITE] Mentah ditemukan: {len(boxes)} baris -> Pasca NMS: {len(final_boxes)}")

    # Bersihkan memori interpreter secara paksa
    del interpreter, input_details, output_details, img_rgb, img_resized, img_input, output_data
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
            
            # Clamp koordinat agar tidak offset keluar dari resolusi gambar asli
            x1 = max(0, min(x1, width - 1))
            y1 = max(0, min(y1, height - 1))
            x2 = max(0, min(x2, width - 1))
            y2 = max(0, min(y2, height - 1))
            
            # 1. Gambar Bounding Box Merah (Ketebalan dinaikkan ke 3 agar mencolok)
            cv2.rectangle(img_hasil, (x1, y1), (x2, y2), (0, 0, 255), 3)
            
            # 2. Gambar Background Banner Merah Solid untuk Text Label
            label = f"Orang: {int(conf * 100)}%"
            (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            cv2.rectangle(img_hasil, (x1, y1 - text_h - 10), (x1 + text_w, y1), (0, 0, 255), cv2.FILLED)
            
            # 3. Tulis Teks Putih di atas Banner Merah
            cv2.putText(img_hasil, label, (x1, y1 - 5),
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