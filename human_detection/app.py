import asyncio
import websockets
import json
import cv2
import numpy as np
import gc
import base64
from datetime import datetime

# Tentukan path ke file model TFLite Anda
MODEL_PATH = "yolov8n_int8.tflite"

import ai_edge_litert.interpreter as tflite
print("[INFO] Menggunakan library: ai_edge_litert")

interpreter = tflite.Interpreter(model_path=MODEL_PATH, num_threads=4)
interpreter.allocate_tensors()

input_details  = interpreter.get_input_details()
output_details = interpreter.get_output_details()

input_shape  = input_details[0]['shape']
input_height = input_shape[1]
input_width  = input_shape[2]
input_dtype  = input_details[0]['dtype']

def run_tflite_inference(img_bgr):
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

    orig_h, orig_w = img_bgr.shape[:2]
    CONF_THRESHOLD = 0.25

    # 1. Ambil class scores (kolom index 4 ke atas)
    class_scores = output_data[:, 4:]
    
    # 2. Cari class dengan score tertinggi untuk setiap bounding box
    class_ids = np.argmax(class_scores, axis=1)
    class_confs = class_scores[np.arange(len(class_scores)), class_ids]

    max_score_seen = float(np.max(class_scores)) if class_scores.size > 0 else 0.0
    print(f"[DEBUG] Skor tertinggi: {round(max_score_seen, 4)}")

    # 3. Filter hanya untuk class 0 (person) dan confidence > CONF_THRESHOLD
    mask = (class_ids == 0) & (class_confs > CONF_THRESHOLD)
    
    boxes = []
    confidences = []

    if np.any(mask):
        matching_rows = output_data[mask]
        matching_confs = class_confs[mask]
        
        xc = matching_rows[:, 0]
        yc = matching_rows[:, 1]
        w  = matching_rows[:, 2]
        h  = matching_rows[:, 3]
        
        x1 = ((xc - w / 2) * orig_w).astype(np.int32)
        y1 = ((yc - h / 2) * orig_h).astype(np.int32)
        x2 = ((xc + w / 2) * orig_w).astype(np.int32)
        y2 = ((yc + h / 2) * orig_h).astype(np.int32)
        
        boxes = np.column_stack((x1, y1, x2, y2)).tolist()
        confidences = matching_confs.tolist()

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

    del img_rgb, img_resized, img_input, output_data
    return final_boxes

async def handle_client(websocket, path=None):
    print(f"[INFO] Client connected: {websocket.remote_address}")
    try:
        async for message in websocket:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Incoming request received over WebSocket")
            try:
                data = json.loads(message)
                req_id = data.get("requestId")
                img_b64 = data.get("image")
                annotate = data.get("annotate", False)

                if not img_b64:
                    await websocket.send(json.dumps({
                        "requestId": req_id,
                        "status": "error",
                        "message": "Key 'image' tidak ditemukan di request"
                    }))
                    continue

                # Decode gambar dari base64
                img_bytes = base64.b64decode(img_b64)
                nparr = np.frombuffer(img_bytes, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if img is None:
                    await websocket.send(json.dumps({
                        "requestId": req_id,
                        "status": "error",
                        "message": "File gambar korup"
                    }))
                    continue

                # Downscale gambar jika terlalu besar
                height, width = img.shape[:2]
                max_dim = 640
                if max(height, width) > max_dim:
                    scale = max_dim / max(height, width)
                    img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_LINEAR)
                    height, width = img.shape[:2]

                print("[INFO] Menjalankan inferensi TFLite...")
                koordinat_kotak = run_tflite_inference(img)
                jumlah_orang = len(koordinat_kotak)
                ada_orang = jumlah_orang > 0

                response = {
                    "requestId": req_id,
                    "status": "success",
                    "pesan": "AWAS: Orang terdeteksi!" if ada_orang else "Aman, tidak ada orang.",
                    "ada_orang": ada_orang,
                    "jumlah_orang": jumlah_orang,
                    "koordinat_kotak": koordinat_kotak
                }

                # Jika diminta untuk menggambar bounding box (checkPerson)
                if annotate:
                    img_hasil = img.copy()
                    for box in koordinat_kotak:
                        x1, y1, x2, y2 = box["posisi"]
                        conf = box["confidence"]

                        x1 = max(0, min(x1, width - 1))
                        y1 = max(0, min(y1, height - 1))
                        x2 = max(0, min(x2, width - 1))
                        y2 = max(0, min(y2, height - 1))

                        # Bounding Box merah
                        cv2.rectangle(img_hasil, (x1, y1), (x2, y2), (0, 0, 255), 3)

                        # Banner teks label
                        label = f"Orang: {int(conf * 100)}%"
                        (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
                        y_banner_top = max(y1 - text_h - 10, 0)
                        y_banner_bottom = max(y1, text_h + 10)

                        cv2.rectangle(img_hasil, (x1, y_banner_top), (x1 + text_w + 4, y_banner_bottom), (0, 0, 255), cv2.FILLED)
                        cv2.putText(img_hasil, label, (x1 + 2, y_banner_bottom - 4),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)

                    # Encode gambar hasil outlining ke JPEG
                    _, buffer = cv2.imencode('.jpg', img_hasil)
                    img_bytes_out = buffer.tobytes()
                    
                    # Convert to base64
                    response["annotated_image"] = base64.b64encode(img_bytes_out).decode('utf-8')
                    del img_hasil, buffer

                await websocket.send(json.dumps(response))

                # Bersihkan sisa memori RAM
                del img_bytes, nparr, img
                gc.collect()
                print("[INFO] RAM dibersihkan.\n")

            except Exception as e:
                print(f"[ERROR] Gagal memproses request: {e}")
                try:
                    await websocket.send(json.dumps({
                        "requestId": req_id if 'req_id' in locals() else None,
                        "status": "error",
                        "message": f"Server error: {str(e)}"
                    }))
                except:
                    pass

    except websockets.exceptions.ConnectionClosed:
        print(f"[INFO] Client disconnected: {websocket.remote_address}")

async def main():
    print("\n[INFO] Menjalankan server WebSockets di port 5000...")
    async with websockets.serve(handle_client, "0.0.0.0", 5000, max_size=20 * 1024 * 1024):
        await asyncio.Future()  # Jalankan selamanya

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[INFO] Server dihentikan.")