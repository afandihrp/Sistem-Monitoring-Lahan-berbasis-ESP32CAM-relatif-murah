import asyncio
import websockets
import json
import cv2
import numpy as np
import gc

import config
from detector import PersonDetector
from annotator import annotate_image

# Inisialisasi detector secara global (dimuat sekali saat server start)
detector = PersonDetector()

async def handle_client(websocket, path=None):
    print(f"[INFO] Client connected: {websocket.remote_address}")
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # Binary request (high-performance stream)
                try:
                    # Bytes 0-3: request_id (UInt32BE)
                    # Byte 4: annotate (UInt8)
                    # Bytes 5+: raw binary JPEG image
                    req_id = int.from_bytes(message[0:4], byteorder='big')
                    annotate = message[4] == 1
                    img_bytes = message[5:]

                    nparr = np.frombuffer(img_bytes, np.uint8)
                    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                    if img is None:
                        await websocket.send(json.dumps({
                            "requestId": req_id,
                            "status": "error",
                            "message": "File gambar korup"
                        }))
                        continue

                    # Downscale gambar jika terlalu besar (maksimal 640px pada sisi terpanjang)
                    height, width = img.shape[:2]
                    max_dim = 640
                    if max(height, width) > max_dim:
                        scale = max_dim / max(height, width)
                        img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_LINEAR)
                        height, width = img.shape[:2]

                    # Deteksi orang menggunakan subsystem detector
                    koordinat_kotak = detector.run_inference(img)
                    jumlah_orang = len(koordinat_kotak)
                    ada_orang = jumlah_orang > 0

                    if annotate:
                        # Anotasi bounding box menggunakan subsystem annotator
                        img_hasil = annotate_image(img, koordinat_kotak)

                        # Encode gambar hasil outlining ke JPEG
                        _, buffer = cv2.imencode('.jpg', img_hasil)
                        img_bytes_out = buffer.tobytes()

                        # Konstruksi binary response
                        metadata = {
                            "status": "success",
                            "pesan": "AWAS: Orang terdeteksi!" if ada_orang else "Aman, tidak ada orang.",
                            "ada_orang": ada_orang,
                            "jumlah_orang": jumlah_orang,
                            "koordinat_kotak": koordinat_kotak
                        }
                        metadata_bytes = json.dumps(metadata).encode('utf-8')
                        json_len = len(metadata_bytes)

                        # Header: req_id (4 bytes) + json_len (4 bytes)
                        header = req_id.to_bytes(4, byteorder='big') + json_len.to_bytes(4, byteorder='big')
                        response_bytes = header + metadata_bytes + img_bytes_out
                        await websocket.send(response_bytes)

                        del img_hasil, buffer
                    else:
                        # Non-annotated: kirim standard JSON response string
                        response = {
                            "requestId": req_id,
                            "status": "success",
                            "pesan": "AWAS: Orang terdeteksi!" if ada_orang else "Aman, tidak ada orang.",
                            "ada_orang": ada_orang,
                            "jumlah_orang": jumlah_orang,
                            "koordinat_kotak": koordinat_kotak
                        }
                        await websocket.send(json.dumps(response))

                    # Bersihkan sisa memori RAM untuk performa optimal di Raspberry Pi
                    del img_bytes, nparr, img
                    gc.collect()

                except Exception as e:
                    print(f"[ERROR] Gagal memproses binary request: {e}")
                    try:
                        await websocket.send(json.dumps({
                            "requestId": req_id if 'req_id' in locals() else None,
                            "status": "error",
                            "message": f"Server error: {str(e)}"
                        }))
                    except:
                        pass
            else:
                # Text requests are rejected since the system uses raw binary frames
                print("[WARNING] Menerima pesan teks tidak terduga, menolak request.")
                await websocket.send(json.dumps({
                    "status": "error",
                    "message": "AI Server strictly operates on high-performance raw binary frames."
                }))

    except websockets.exceptions.ConnectionClosed:
        print(f"[INFO] Client disconnected: {websocket.remote_address}")

async def main():
    print(f"\n[INFO] Menjalankan server WebSockets di {config.HOST}:{config.PORT}...")
    async with websockets.serve(
        handle_client, 
        config.HOST, 
        config.PORT, 
        max_size=config.MAX_WS_SIZE
    ):
        await asyncio.Future()  # Jalankan selamanya

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[INFO] Server dihentikan.")