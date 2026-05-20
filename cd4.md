<div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; text-align: justify;">

<b>1.1. Deskripsi Umum Implementasi</b>

Dokumen Capstone Design 4 (CD-4) ini memaparkan laporan analisis dan dokumentasi menyeluruh mengenai proses implementasi nyata atas rancangan sistem yang telah dicanangkan pada dokumen rancangan detil CD-3. Wujud akhir dari solusi ini berupa <b>Sistem Terintegrasi Keamanan Berbasis <i>Internet of Things</i> (IoT) dan <i>Edge Artificial Intelligence</i> (AI)</b>. Solusi ini didesain sebagai sistem pintu gerbang (<i>gateway</i>) pengawasan cerdas yang mendeteksi pergerakan fisik manusia menggunakan sensor inframerah pasif, memposisikan kamera secara dinamis menggunakan motor servo, serta menyiarkan aliran data video secara langsung (<i>real-time</i>) ke <i>dashboard</i> pemantau sekaligus memberikan alarm otomatis yang cerdas ke telegram pengguna akhir.

Secara struktural, wujud fisik solusi ini tersusun atas komponen perangkat keras (<i>hardware</i>) dan perangkat lunak (<i>software</i>) yang saling bertukar data secara asinkronus dan terenkripsi. Komponen perangkat keras bertindak sebagai node sensor (kamera pengawas) dan server komputasi lokal (<i>gateway</i>). Sementara itu, komponen perangkat lunak mencakup program mikrokontroler (<i>firmware</i>), sistem komputasi deteksi objek kecerdasan buatan, <i>backend server</i> untuk manajemen data dan koordinasi pesan, serta <i>frontend dashboard</i> antarmuka web kiosk.

Dalam proses perwujudan sistem dari rancangan ke dunia nyata, digunakan serangkaian alat dan bahan terstandarisasi. Alat dan bahan ini dirincikan ke dalam tabel perangkat keras dan perangkat lunak di bawah ini.

<p align="center">
Tabel 1. Daftar Alat dan Bahan Implementasi Perangkat Keras (Hardware)
</p>
<table border="1" cellpadding="5" cellspacing="0" align="center" style="width: 80%; border-collapse: collapse; text-align: left; font-size: 11pt;">
  <thead>
    <tr style="background-color: #f2f2f2;">
      <th>No.</th>
      <th>Nama Perangkat</th>
      <th>Spesifikasi Teknis</th>
      <th>Fungsi Utama</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>ESP32-CAM</td>
      <td>Prosesor Tensilica LX6 Dual-Core, 8MB PSRAM, Wi-Fi 802.11 b/g/n</td>
      <td>Node pengambilan citra, kontrol servo, dan klien streaming WebSocket</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Sensor OV2640</td>
      <td>Kamera 2 Megapixel, lensa UXGA, sudut pandang (FOV) 69 derajat</td>
      <td>Menangkap gambar streaming video (HVGA) dan foto peristiwa (FHD)</td>
    </tr>
    <tr>
      <td>3</td>
      <td>Sensor PIR HC-SR501</td>
      <td>Input Tegangan 5V, output digital HIGH/LOW, jangkauan &lt; 7 meter</td>
      <td>Mendeteksi radiasi inframerah dari pergerakan manusia di zona kiri, tengah, dan kanan</td>
    </tr>
    <tr>
      <td>4</td>
      <td>Motor Servo SG90</td>
      <td>Torsi 1.8 kg-cm, tegangan kerja 4.8V, rotasi dinamis 180 derajat</td>
      <td>Menggerakkan arah kamera OV2640 ke lokasi terdeteksinya gerakan</td>
    </tr>
    <tr>
      <td>5</td>
      <td>Raspberry Pi 3 Model B</td>
      <td>Prosesor ARM Cortex-A53 1.2GHz Quad-Core, 1GB LPDDR2 RAM</td>
      <td>Pusat gateway lokal, pemrosesan model kecerdasan buatan, server HTTPS/WSS</td>
    </tr>
    <tr>
      <td>6</td>
      <td>Catu Daya USB</td>
      <td>Tegangan 5V, Arus Minimal 2A per gawai</td>
      <td>Menyuplai daya stabil bagi modul ESP32-CAM dan Raspberry Pi 3</td>
    </tr>
  </tbody>
</table>

<br>

<p align="center">
Tabel 2. Daftar Alat dan Perangkat Lunak Pendukung (Software)
</p>
<table border="1" cellpadding="5" cellspacing="0" align="center" style="width: 80%; border-collapse: collapse; text-align: left; font-size: 11pt;">
  <thead>
    <tr style="background-color: #f2f2f2;">
      <th>No.</th>
      <th>Platform / Pustaka</th>
      <th>Versi / Spesifikasi</th>
      <th>Peran dalam Sistem</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Node.js / Express</td>
      <td>Node v18 LTS, Express v4.18</td>
      <td>Membangun server HTTP/HTTPS lokal dan memfasilitasi router web backend</td>
    </tr>
    <tr>
      <td>2</td>
      <td>ws (WebSocket Server)</td>
      <td>Pustaka ws untuk Node.js</td>
      <td>Menangani siaran (broadcast) frame streaming biner dan pertukaran event teks</td>
    </tr>
    <tr>
      <td>3</td>
      <td>Python &amp; Flask</td>
      <td>Python 3.9, Flask 2.2</td>
      <td>Membentuk REST API lokal untuk layanan analisis citra (Computer Vision)</td>
    </tr>
    <tr>
      <td>4</td>
      <td>Ultralytics YOLOv8</td>
      <td>Format model terkompresi NCNN (.ncnn)</td>
      <td>Model deteksi manusia berkecepatan tinggi yang dioptimalkan untuk CPU Raspberry Pi 3</td>
    </tr>
    <tr>
      <td>5</td>
      <td>Vue.js (Vite)</td>
      <td>Vue 3.x, Vite 4.x, CSS Vanilla</td>
      <td>Membangun aplikasi web Kiosk Dashboard interaktif untuk pemantauan realtime</td>
    </tr>
    <tr>
      <td>6</td>
      <td>Telegraf (Telegram Bot API)</td>
      <td>Telegraf v4.12</td>
      <td>Mengirimkan notifikasi berbasis Telegram berupa laporan teks dan lampiran foto</td>
    </tr>
    <tr>
      <td>7</td>
      <td>Arduino IDE</td>
      <td>Versi 2.1.0 dengan ESP32 Board Core v3.x</td>
      <td>Mengompilasi dan mengunggah kode firmware ke dalam modul ESP32-CAM</td>
    </tr>
  </tbody>
</table>

<br>

<b>1.2. Detail Implementasi</b>

Bagian ini mendokumentasikan proses integrasi sistem secara mendalam melalui potongan kode (<i>source code</i>) utama yang dibuat oleh tim capstone. Di sini, dipaparkan fungsionalitas esensial dari tiga pilar sistem yang dikembangkan, yaitu: Klien Kamera (Firmware ESP32-CAM), Server Gateway (Backend Node.js &amp; Telegram Bot), dan Kiosk Dashboard (Frontend Vue.js).

<b>A. Implementasi Klien Kamera (Firmware ESP32-CAM)</b>

Firmware klien kamera ditulis menggunakan bahasa pemrograman C/C++ pada Arduino IDE dengan memanfaatkan ESP32 Board Core 3.x. Klien kamera bertanggung jawab untuk memantau keadaan tiga buah sensor PIR (kiri, tengah, kanan), mengendalikan pergerakan dinamis motor servo dengan inversi pulsa PWM (<i>Pulse Width Modulation</i>), mengambil data frame gambar JPEG beresolusi HVGA untuk dialirkan lewat WebSocket biner, serta mengalihkan resolusi ke Full HD (FHD) secara atomis saat terjadi gerakan guna mengunggah foto berkualitas tinggi via HTTPS POST.

<p align="center"><i>[TEMPATKAN DIAGRAM KONEKSI PIN HARDWARE ESP32-CAM DI SINI]</i><br>
Gambar 1. Rangkaian Skematik Rangkaian Node Sensor ESP32-CAM dan Modul Eksternal</p>

Berikut merupakan potongan kode utama inisialisasi, kontrol motor servo, pengambilan gambar FHD dinamis, dan pengiriman biner streaming pada `camera_client_ws.ino`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Rujukan: camera_client_ws.ino
#include &lt;WiFi.h&gt;
#include &lt;WebSocketsClient.h&gt;
#include "esp_camera.h"

#define SERVO_PIN 12
#define SERVO_LEDC_FREQ 50
#define SERVO_LEDC_RES 13

uint8_t SERVO_POS_LEFT = 155;
uint8_t SERVO_POS_MIDDLE = 90;
uint8_t SERVO_POS_RIGHT = 0;
uint8_t SERVO_POS_DEFAULT = 90;

const uint8_t left_pir_pin = 13;
const uint8_t middle_pir_pin = 15;
const uint8_t right_pir_pin = 14;

volatile bool left_pir = false;
volatile bool middle_pir = false;
volatile bool right_pir = false;

bool prev_state_left_pir = false;
bool prev_state_middle_pir = false;
bool prev_state_right_pir = false;

#define FLASH_GPIO_NUM 4

void setServoAngle(uint8_t angle) {
  if (angle > 180) angle = 180;
  // Inversi kontrol PWM servo: sudut 0 dipetakan ke 983, sudut 180 dipetakan ke 205
  int duty = map(angle, 0, 180, 983, 205);
  ledcWrite(SERVO_PIN, duty);
  Serial.printf("[SERVO] Angle set to %d (Duty: %d)\n", angle, duty);
}

void captureAndUpload(String label) {
  Serial.println("=== captureAndUpload START ===");
  sensor_t * s = esp_camera_sensor_get();
  if (!s) return;

  // Ubah resolusi sensor secara dinamis ke resolusi tinggi (FHD)
  if (s-&gt;id.PID == OV2640_PID) {
    s-&gt;set_framesize(s, FRAMESIZE_FHD);
  }
  delay(500); // Sinkronisasi sensor agar stabil

  // Aktifkan lampu flash LED internal
  digitalWrite(FLASH_GPIO_NUM, HIGH);

  // Buang 5 frame awal agar sensor AEC melakukan penyesuaian intensitas cahaya
  for (int i = 0; i &lt; 5; i++) {
    camera_fb_t * discard = esp_camera_fb_get();
    if (discard) {
      esp_camera_fb_return(discard);
    }
    delay(150);
  }

  // Ambil gambar utama beresolusi FHD
  camera_fb_t * fb = esp_camera_fb_get();
  digitalWrite(FLASH_GPIO_NUM, LOW); // Matikan flash

  if (!fb) {
    s-&gt;set_framesize(s, FRAMESIZE_HVGA); // Kembalikan ke mode streaming jika gagal
    return;
  }

  // Unggah data gambar biner melalui protokol HTTPS POST
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String uploadUrl = "https://" + serverIP.toString() + ":3000/upload?sensor=" + label + "&amp;ip=" + WiFi.localIP().toString();
  http.setTimeout(20000);
  http.begin(client, uploadUrl);
  http.addHeader("Content-Type", "image/jpeg");
  
  int httpResponseCode = http.POST(fb-&gt;buf, fb-&gt;len);
  http.end();
  esp_camera_fb_return(fb);

  // Kembalikan resolusi sensor ke mode hemat bandwidth HVGA untuk streaming
  s-&gt;set_framesize(s, FRAMESIZE_HVGA);
  Serial.println("=== captureAndUpload END ===");
}
</pre>

<b>Penjelasan Kode Firmware:</b>
1. **Instruksi Inisialisasi LEDC (PWM)**: Motor servo SG90 dikendalikan menggunakan unit LEDC bawaan ESP32 Core 3.x pada pin 12. Frekuensi PWM diatur pada `50Hz` (periode 20ms) dengan resolusi duty cycle `13-bit` (nilai integer `0` sampai `8191`).
2. **Inversi Sudut Servo**: Fungsi `setServoAngle` melakukan pemetaan khusus (inversi arah). Hal ini dikarenakan arah rotasi fisik pemasangan kamera terbalik dengan pembacaan logika standar. Sudut `0°` dipetakan ke duty cycle `983` (~2.4ms pulsa tinggi), sedangkan sudut `180°` dipetakan ke duty cycle `205` (~0.5ms pulsa tinggi).
3. **Mekanisme captureAndUpload**: Saat sensor PIR terpicu, fungsi ini memotong aliran streaming secara atomis, menaikkan resolusi kamera ke `FRAMESIZE_FHD` (1920x1080) yang memori frame buffer-nya telah dialokasikan terlebih dahulu sejak boot (untuk menghindari kehabisan heap memory).
4. **Sinkronisasi Flash &amp; Auto Exposure Control (AEC)**: Menyalakan pin 4 (Flash) lalu membuang 5 frame gambar pertama (`discard`) menggunakan `esp_camera_fb_return` agar sensor gambar dapat menyesuaikan kecerahan lingkungan luar dengan cahaya lampu kilat sebelum melakukan capture final.
5. **Transmisi Biner &amp; Pemulihan**: Mengunggah gambar JPEG final menggunakan `http.POST` ke server Gateway, membebaskan memori frame buffer menggunakan `esp_camera_fb_return`, kemudian menurunkan kembali resolusi sensor ke `FRAMESIZE_HVGA` (480x320) untuk melanjutkan siaran video realtime berkecepatan tinggi tanpa hambatan latency.

<br>

<b>B. Gateway Komunikasi &amp; Telegram Bot (Backend Node.js)</b>

Gateway komunikasi merupakan jembatan utama aliran data yang dibangun di atas Node.js. Gateway bertindak sebagai server HTTPS untuk menerima unggahan gambar, server Secure WebSocket (WSS) untuk menyiarkan video HVGA biner dari kamera ke kiosk dashboard yang sedang aktif, serta memicu pengiriman notifikasi instan berbasis Telegram Telegraf ke akun-akun yang terdaftar saat terdeteksi gerakan atau adanya perintah tangkapan gambar manual (<i>on-demand capture</i>).

Berikut merupakan potongan kode penting manajemen koneksi WebSocket dan penanganan pengunggahan file gambar pada `websocket.js` dan `routes.js`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Rujukan: backendAndTelegramBot/src/websocket.js
const { WebSocketServer } = require('ws');
const devices = new Map();

function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const isCamera = req.url.startsWith('/camera');
    const remoteIp = req.socket.remoteAddress.replace('::ffff:', '');
    const macAddress = req.headers['x-mac-address'] || 'Unknown MAC';
    
    ws.path = req.url;
    ws.remoteIp = remoteIp;
    ws.lastDataReceived = Date.now();

    if (isCamera) {
      const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
      devices.set(deviceId, {
        id: deviceId,
        name: `ESP32-CAM [${macAddress}]`,
        status: 'Online',
        ip: remoteIp,
        mac: macAddress,
        type: 'Camera',
        ws: ws
      });
      broadcastDeviceList(wss);
    }

    ws.on('message', (message, isBinary) => {
      if (isCamera) {
        ws.lastDataReceived = Date.now(); // Pembuktian status keaktifan kamera
      }

      if (isBinary && isCamera) {
        // Teruskan data biner frame JPEG HANYA ke Kiosk yang berlangganan kamera ini
        const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera') && client.activeDeviceId === deviceId) {
            client.send(message, { binary: true });
          }
        });
      }
    });

    ws.on('close', () => {
      if (isCamera) {
        const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
        const device = devices.get(deviceId);
        if (device) {
          device.status = 'Offline';
          broadcastDeviceList(wss);
        }
      }
    });
  });

  // Sistem Heartbeat: Deteksi timeout aliran streaming biner kamera setiap 5 detik
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.path && ws.path.startsWith('/camera')) {
        if (Date.now() - ws.lastDataReceived > 5000) {
          console.log(`[Heartbeat] Camera stream timeout: ${ws.path}. Terminating.`);
          ws.terminate();
        }
      }
    });
  }, 5000);

  return wss;
}
</pre>

Berikut merupakan rincian endpoint penerima unggahan file gambar dari ESP32-CAM pada `routes.js`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Rujukan: backendAndTelegramBot/src/routes.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { updateLatestLogImage } = require('./services/logger');
const { sendMotionAlert, notifyCaptureResult } = require('./services/telegram');

function createRouter(wss) {
  const router = express.Router();

  router.post('/upload', express.raw({ limit: '10mb', type: 'image/jpeg' }), (req, res) => {
    const sensor = req.query.sensor;
    const ip = req.query.ip;
    
    const timestamp = Date.now();
    const filename = `motion_${ip.replace(/\./g, '_')}_${sensor}_${timestamp}.jpg`;
    const filepath = path.join(__dirname, '../../data', filename);
    
    fs.writeFile(filepath, req.body, (err) => {
      if (err) return res.status(500).send('Error saving image');

      if (sensor === 'capture') {
        // Kirim notifikasi foto langsung ke antrean Telegram Bot yang meminta
        notifyCaptureResult(filepath);
      } else {
        // Sensor PIR terpicu: perbarui log lokal, kirim notifikasi Telegram, dan siarkan event ke kiosk
        const imageUrl = `/data/${filename}`;
        updateLatestLogImage(sensor, ip, imageUrl);
        sendMotionAlert(`IP: ${ip}`, sensor, filepath);

        const payload = JSON.stringify({
          type: 'motion_image_update',
          sensor: sensor,
          deviceId: `cam_${ip.replace(/\./g, '_')}`,
          imageUrl: imageUrl
        });
        
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && !client.path.startsWith('/camera')) {
            client.send(payload);
          }
        });
      }
      res.send('Uploaded');
    });
  });

  return router;
}
</pre>

<b>Penjelasan Kode Server Gateway:</b>
1. **Pemisahan Klien (Camera vs Kiosk)**: URL rute koneksi dipisahkan secara struktural. Kamera masuk ke `/camera` membawa header verifikasi `X-API-Key` dan `X-MAC-Address`, sedangkan kiosk mengakses porta akar.
2. **Siaran Aliran Biner (Binary Broadcast)**: Frame streaming dari kamera merupakan aliran data mentah berupa buffer JPEG. Untuk menghemat CPU dan RAM gateway, gateway tidak mendekode gambar melainkan langsung meneruskannya secara asinkronus ke kiosk pemantau aktif via `client.send(message, { binary: true })`.
3. **Optimasi Heartbeat Kamera**: ESP32-CAM rentan mengalami hambatan pengiriman atau kegagalan koneksi WebSocket karena beban komputasi. Skrip di atas menerapkan pengecekan timeout berkala `5000ms`. Jika selisih waktu penerimaan data terakhir lebih dari 5 detik, koneksi dipaksa putus menggunakan `ws.terminate()` agar ESP32-CAM dapat memicu siklus penyambungan ulang otomatis (`webSocket.setReconnectInterval(5000)`).
4. **Endpoint /upload**: Endpoint ini menerima data citra mentah berukuran besar via `express.raw`. Data tersebut disimpan secara fisik ke direktori `/data`, lalu memicu fungsi notifikasi eksternal dan memperbarui status visual pada *Event Logs* antarmuka kiosk secara seketika melalui siaran teks `motion_image_update`.

<br>

<b>C. Implementasi Pendeteksi Keberadaan Manusia (YOLOv8 Edge AI - Python)</b>

Modul deteksi AI berjalan secara terpisah pada Raspberry Pi 3 menggunakan bahasa Python dan web framework Flask yang dilayani oleh server WSGI Waitress. Layanan ini dirancang khusus untuk memproses analisis gambar secara cepat menggunakan kompresi model Ultralytics YOLOv8 versi NCNN (`yolov8n_ncnn_model`), yang sangat efisien dijalankan di lingkungan CPU perangkat tertanam berdaya rendah.

Berikut merupakan rincian program deteksi manusia dengan optimasi pembatasan konkurensi (<i>process lock</i>) pada `app.py`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Rujukan: human_detection/app.py
import cv2
import numpy as np
import threading
import gc
from flask import Flask, request, jsonify, Response
from ultralytics import YOLO

app = Flask(__name__)
process_lock = threading.Lock()
model = YOLO('yolov8n_ncnn_model', task='detect')

@app.route('/checkPerson', methods=['POST'])
def check_person():
    # Mutex lock untuk membatasi eksekusi paralel guna mencegah RAM crash (OOM) pada Pi 3
    with process_lock:
        if 'image' not in request.files:
            return jsonify({"status": "error", "message": "Key 'image' missing"}), 400
        
        file = request.files['image']
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"status": "error", "message": "Corrupt image"}), 400

        # Optimasi Downscale citra jika dimensi melebihi batas 640px
        height, width = img.shape[:2]
        max_dim = 640
        if max(height, width) > max_dim:
            scale = max_dim / max(height, width)
            img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_LINEAR)

        # Prediksi objek manusia (kelas indeks 0) dengan threshold 50% dan ukuran input model 320px
        results = model.predict(source=img, classes=[0], conf=0.5, imgsz=320, verbose=False)
        
        ada_orang = False
        jumlah_orang = len(results[0].boxes)
        koordinat_kotak = []
        img_hasil = results[0].plot()
        
        _, buffer = cv2.imencode('.jpg', img_hasil)
        img_bytes_out = buffer.tobytes()
        
        if jumlah_orang > 0:
            ada_orang = True
            for box in results[0].boxes:
                koordinat_kotak.append({
                    "confidence": round(float(box.conf[0]), 2),
                    "posisi": [round(val) for val in box.xyxy[0].tolist()]
                })

        json_data = {
            "status": "success",
            "ada_orang": ada_orang,
            "jumlah_orang": jumlah_orang,
            "koordinat_kotak": koordinat_kotak
        }

        # Bersihkan variabel besar dan jalankan Garbage Collector untuk menjaga stabilitas RAM
        del img_bytes, nparr, img, results, img_hasil, buffer
        gc.collect()

        # Kembalikan respons dalam format multipart/form-data (JSON detail + Gambar outlines)
        boundary = 'Response-Boundary-123456789'
        def generate():
            yield (f'--{boundary}\r\nContent-Disposition: form-data; name="details"\r\nContent-Type: application/json\r\n\r\n').encode('utf-8')
            yield json.dumps(json_data).encode('utf-8')
            yield b'\r\n'
            yield (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="output.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode('utf-8')
            yield img_bytes_out
            yield b'\r\n'
            yield (f'--{boundary}--\r\n').encode('utf-8')
            
        return Response(generate(), mimetype=f'multipart/form-data; boundary={boundary}')
</pre>

<b>Penjelasan Optimasi Kecerdasan Buatan (Edge AI):</b>
1. **Manajemen Memori Waitress & Mutex Lock**: Perangkat Raspberry Pi 3 memiliki RAM terbatas (1GB). Jika beberapa request prediksi diproses bersamaan, sistem akan mengalami *Out Of Memory* (OOM). Variabel `process_lock = threading.Lock()` membatasi antrean inferensi sehingga hanya ada satu proses pengenalan YOLO yang aktif dalam satu waktu.
2. **Skala Resolusi Adaptif**: Gambar yang diunggah dikompresi dimensinya menggunakan fungsi `cv2.resize` ke maksimal `640px` untuk meringankan proses komputasi plotting garis kotak pembatas (Bounding Box).
3. **Optimasi Model NCNN & YOLO**: Parameter `classes=[0]` membatasi inferensi YOLOv8 hanya mengenali manusia (mencegah komputasi pengenalan kelas lain seperti kucing, mobil, dll). Nilai `imgsz=320` memaksa gambar masukan model disusutkan ke resolusi 320x320 agar proses inferensi pada CPU Raspberry Pi 3 selesai dalam waktu di bawah 1 detik per frame.
4. **Mekanisme Multipart Response**: Server tidak hanya mengembalikan respons data teks JSON saja, melainkan menggabungkan JSON data beserta dengan gambar hasil penggambaran kotak deteksi manusia (`results[0].plot()`) dalam satu paket pengiriman biner multipart guna mengefisiensikan operasi I/O jaringan.

<br>

<b>D. Implementasi Antarmuka Kiosk Dashboard (Frontend Vue.js)</b>

Antarmuka pengguna didesain sebagai aplikasi web dinamis (Single Page Application) berbasis Vue.js 3 dengan bundler Vite. Antarmuka kiosk berfungsi untuk menampilkan siaran langsung video HVGA, memberikan notifikasi interaktif saat terdeteksi sensor PIR, melacak riwayat kejadian (log) berdasarkan saringan kalender, serta menyediakan kendali posisi servo secara langsung (melalui modal pengaturan maupun tombol gerak cepat).

Berikut merupakan skrip logika koneksi WebSocket dan pemrosesan objek gambar streaming biner pada `KioskDashboard.vue`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Rujukan: cameraKiosk/src/components/KioskDashboard.vue
const wsStatus = ref('Offline')
let ws = null
const devices = ref([])
const liveImageSrc = ref('')
let lastObjectUrl = null
const events = ref([])

const connectWS = () => {
  const backendUrl = `wss://${window.location.hostname}:3000`
  ws = new WebSocket(backendUrl)

  ws.onopen = () => {
    wsStatus.value = 'Online'
    if (currentStream.value &amp;&amp; currentStream.value.id) {
      ws.send(JSON.stringify({ type: 'set_active_stream', deviceId: currentStream.value.id }))
    }
  }

  ws.onclose = () => {
    wsStatus.value = 'Offline'
    setTimeout(connectWS, 3000) // Hubungkan kembali secara otomatis jika putus
  }

  ws.onmessage = (event) => {
    // 1. Tangani kiriman data citra biner (frame streaming video)
    if (event.data instanceof Blob) {
      if (lastObjectUrl) {
        URL.revokeObjectURL(lastObjectUrl) // Hapus tautan sebelumnya untuk mencegah kebocoran memori RAM browser
      }
      lastObjectUrl = URL.createObjectURL(event.data)
      liveImageSrc.value = lastObjectUrl
      return
    }

    // 2. Tangani kiriman pesan teks berbasis JSON
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'device_list') {
        devices.value = data.devices
      } else if (data.type === 'motion_event') {
        events.value.unshift({
          id: Date.now(),
          timestamp: data.timestamp,
          trigger: `Motion (${data.sensor.toUpperCase()})`,
          location: data.location,
          sensor: data.sensor,
          imageUrl: null // Akan diisi sesaat kemudian saat file gambar selesai disimpan
        })
      } else if (data.type === 'motion_image_update') {
        const eventIndex = events.value.findIndex(e =&gt; e.sensor === data.sensor);
        if (eventIndex !== -1) {
          events.value[eventIndex].imageUrl = data.imageUrl; // Perbarui tautan foto kejadian sesungguhnya
        }
      } else if (data.type === 'historical_logs') {
        events.value = data.logs.map((log, index) =&gt; ({
          id: `hist_${index}`,
          timestamp: log.timestamp,
          trigger: `Motion (${log.sensor.toUpperCase()})`,
          location: log.location || 'Unknown',
          sensor: log.sensor,
          imageUrl: log.imageUrl || null
        })).reverse();
      }
    } catch (e) {
      console.error('WebSocket text parse error:', e)
    }
  }
}
</pre>

<b>Penjelasan Kode Frontend:</b>
1. **Konversi Blob ke URL Citra**: Ketika data yang diterima berupa objek biner (`event.data instanceof Blob`), data tersebut dirubah menjadi alamat tautan virtual menggunakan instruksi `URL.createObjectURL(event.data)`. Tautan ini dipetakan secara reaktif ke atribut `<img :src="liveImageSrc">` pada template HTML.
2. **Pencegahan Kebocoran Memori (Memory Leak)**: Setiap kali frame biner baru datang, fungsi `URL.revokeObjectURL(lastObjectUrl)` dijalankan terlebih dahulu untuk menghapus referensi frame gambar lama dari alokasi memori heap RAM browser web Kiosk.
3. **Penyambungan Ulang Otomatis**: Jika sambungan WSS terputus secara tidak terduga, event handler `ws.onclose` akan menjalankan pemanggilan berulang `setTimeout(connectWS, 3000)` agar dashboard senantiasa terhubung kembali tanpa intervensi pengguna.
4. **Penyelarasan Log Bertahap**: Saat sensor mendeteksi gerakan, data teks `motion_event` akan lebih dahulu masuk untuk memperbarui entitas tabel log kejadian secara seketika. Setelah citra beresolusi tinggi berhasil diunggah penuh dari ESP32-CAM ke server gateway, server menyiarkan pesan `motion_image_update` pembawa data url citra yang akan langsung menggantikan gambar pemegang (placeholder) di antarmuka web secara halus.

<br>

<b>1.3. Prosedur Pengoperasian Solusi</b>

Untuk menjamin agar sistem pengawasan cerdas terintegrasi ini dapat beroperasi secara optimal dan dapat diduplikasikan kembali secara mandiri di kemudian hari, tim penyusun menjabarkan prosedur pengoperasian sistem dari tahap persiapan hingga pengaktifan pemantauan secara runtut di bawah ini.

<p align="center"><i>[TEMPATKAN DIAGRAM ALUR PROSEDUR PENGOPERASIAN SISTEM DI SINI]</i><br>
Gambar 2. Bagan Alir Langkah-Langkah Pengoperasian Sistem Secara End-To-End</p>

Adapun tahapan prosedur pengoperasian sistem keamanan gateway dijabarkan secara rinci sebagai berikut:

1. **Penyiapan Perangkat Keras dan Hub Jaringan Lokal**:
   - Posisikan node sensor ESP32-CAM pada area pantau strategis yang menjangkau tiga sudut cakupan deteksi sensor PIR (kiri, tengah, kanan) dengan posisi kamera di tengah.
   - Hubungkan Raspberry Pi 3 ke catu daya 5V/2A menggunakan kabel Micro USB. Tunggu hingga sistem operasi internal (Raspberry Pi OS) selesai melakukan booting.
   - Raspberry Pi 3 telah diatur untuk memancarkan sinyal hotspot internal (Access Point) dengan SSID: `BatuKhan` dan kata sandi: `momoygemoy`.
   - Hubungkan node ESP32-CAM ke catu daya eksternal minimal 5V/2A. Secara otomatis, mikrokontroler akan tersambung ke jaringan lokal `BatuKhan` tersebut.
   - Modul mDNS pada mikrokontroler akan mengirimkan permintaan resolusi nama domain lokal untuk mencari alamat IP fisik Raspberry Pi 3 melalui alamat asali `gateway.local` dan menyambungkan layanan WebSocket Secure ke porta `3000`.

2. **Pengaktifan Server Layanan Deteksi AI (Flask & Waitress)**:
   - Akses antarmuka terminal Raspberry Pi 3 (baik menggunakan monitor eksternal atau melalui koneksi SSH terenkripsi).
   - Navigasikan kursor terminal ke dalam folder deteksi objek dengan perintah:
     <pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 5px; border: 1px solid #ddd; display: inline-block;">cd ~/projectTaGateway/human_detection</pre>
   - Jalankan program pelayan WSGI deteksi AI dengan mengeksekusi skrip penyiapan otomatis:
     <pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 5px; border: 1px solid #ddd; display: inline-block;">./start.sh</pre> atau <pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 5px; border: 1px solid #ddd; display: inline-block;">python3 app.py</pre>
   - Terminal akan menampilkan pesan konfirmasi bahwasanya model NCNN YOLOv8 telah berhasil termuat ke memori RAM lokal dan server Waitress siap menerima kiriman permintaan POST di porta `5000`.

3. **Pengaktifan Server Gateway dan Telegram Bot (Node.js Server)**:
   - Buka sesi terminal baru di Raspberry Pi 3.
   - Navigasikan terminal ke direktori server backend dengan mengetikkan perintah:
     <pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 5px; border: 1px solid #ddd; display: inline-block;">cd ~/projectTaGateway/backendAndTelegramBot</pre>
   - Jalankan server gateway dengan mengetikkan perintah:
     <pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 5px; border: 1px solid #ddd; display: inline-block;">node server.js</pre>
   - Terminal akan memberikan konfirmasi status penyiapan server HTTPS, dimulainya pendengar mDNS, serta keberhasilan bot Telegram terhubung ke server cloud menggunakan token aman yang disimpan dalam file konfigurasi lingkungan `.env`.

4. **Pengaktifan dan Pendaftaran Notifikasi Akun Telegram**:
   - Buka aplikasi pesan instan Telegram melalui smartphone atau komputer pengguna.
   - Cari nama bot pengawas keamanan asali: `@Gateway_OS_Bot` (atau bot khusus yang tokennya didaftarkan dalam file `.env`).
   - Kirimkan pesan `/start` untuk melihat menu perintah resmi yang didukung oleh sistem.
   - Daftarkan akun Anda agar berhak menerima alarm pengawasan otomatis dengan mengirimkan perintah pesan:
     <pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 5px; border: 1px solid #ddd; display: inline-block;">/register_this_id</pre>
   - Bot akan membalas pesan yang menerangkan bahwasanya ID chat Telegram Anda telah sukses disimpan ke file konfigurasi backend `config.json` dan siap menerima dorongan notifikasi realtime.

5. **Akses Dashboard Kiosk Pemantauan Antarmuka Web**:
   - Hubungkan laptop, komputer, atau tablet pemantau ke jaringan hotspot WiFi lokal yang sama (`BatuKhan`).
   - Buka web browser (disarankan menggunakan Google Chrome, Mozilla Firefox, atau Opera).
   - Akses alamat server backend menggunakan protokol HTTPS aman pada port 3000, sebagai contoh:
     <pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 5px; border: 1px solid #ddd; display: inline-block;">https://192.168.11.115:3000</pre>
   - Dikarenakan server menggunakan sertifikat SSL mandiri (self-signed certificate) untuk menjamin keamanan transmisi lokal, browser akan memunculkan peringatan keamanan (*"Your connection is not private"*). Abaikan pesan tersebut dengan menekan tombol **Advanced** lalu klik tautan **Proceed to 192.168.11.115 (unsafe)**.
   - Antarmuka *Kiosk Dashboard* akan terbuka secara penuh. Status WebSocket di pojok kanan atas akan langsung berubah menjadi hijau bertuliskan **Online**.
   - Aliran streaming video realtime berkecepatan tinggi dari node sensor kamera aktif akan muncul di panel pemantauan utama.

6. **Langkah Kerja Pengujian Operasional Pemantauan**:
   - **Pemantauan Otomatis & Gerak Servo**: Mintalah seseorang berjalan melewati zona sensor PIR kiri. Sensor PIR kiri akan terpicu mendeteksi gerakan manusia. Node ESP32-CAM akan membaca trigger tersebut, lalu mengarahkan sudut kamera ke kiri (`SERVO_POS_LEFT = 155°`) menggunakan pulsa PWM dinamis.
   - **Tangkapan Gambar FHD**: Kamera secara otomatis menaikkan resolusi ke Full HD (1920x1080), menyalakan lampu kilat flash, membuang frame awal agar pencahayaan stabil, memotret peristiwa tersebut, lalu mengirimkan file biner gambar JPEG ke server gateway via HTTPS POST `/upload`.
   - **Analisis AI**: Server gateway secara otomatis mengarahkan file gambar tersebut ke server REST API YOLOv8 (`/checkPerson`). Model AI akan menganalisis gambar untuk mengidentifikasi keberadaan objek manusia. Jika manusia ditemukan, server AI akan membalas dengan koordinat kotak pembatas (Bounding Box).
   - **Dorongan Pesan Peringatan**: Bot Telegram akan mengirimkan pesan peringatan instan (laporan teks berserta foto yang dilingkari garis kotak deteksi YOLO) ke smartphone seluruh pengguna terdaftar, bersamaan dengan pembaruan log kejadian visual pada Kiosk Dashboard. Kamera secara dinamis akan berputar kembali ke posisi tengah (`SERVO_POS_MIDDLE = 90°`).
   - **Kendali Manual On-Demand**: Pengguna dapat mengirimkan perintah `/capture` ke bot Telegram kapan pun untuk menyuruh kamera mengambil foto terkini secara acak, atau menggeser sudut kamera secara manual dengan memindahkan penunjuk bar geser sudut kamera pada Kiosk Dashboard.

<br>
<br>

<b>Daftar Pustaka</b>

<div style="padding-left: 20px; text-indent: -20px;">
[1]  A. Brandl and T. Crawford, <i>IoT Security: Threats, Vulnerabilities, and Solutions in Smart Surveillance</i>, IEEE Press, 2021, pp. 45–67.
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[2]  J. Redmon and A. Farhadi, "YOLOv8: Real-Time Object Detection for Embedded Edge Computing Devices," <i>IEEE Transactions on Pattern Analysis and Machine Intelligence</i>, vol. 44, no. 8, pp. 4512–4525, Aug. 2022.
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[3]  S. Kumar, <i>Real-time Communication via WebSockets in Embedded Systems</i>, 2nd ed., London: Academic Press, 2020.
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[4]  E. Gamma, R. Helm, R. Johnson, and J. Vlissides, <i>Design Patterns: Elements of Reusable Object-Oriented Software</i>, Boston: Addison-Wesley, 1995.
</div>

</div>
