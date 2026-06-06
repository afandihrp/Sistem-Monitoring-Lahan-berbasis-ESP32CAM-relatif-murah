# Sistem Monitoring Keamanan & Bounding Box AI Berbasis ESP32-CAM

Sistem monitoring keamanan pintar berbasis IoT yang mengintegrasikan kamera **ESP32-CAM**, sensor gerak PIR multi-arah, motor servo pemutar kamera otomatis, kecerdasan buatan (AI) untuk deteksi manusia, serta bot Telegram untuk notifikasi instan berupa foto dan rekaman video kejadian secara *real-time*.

---

## Daftar Isi
1. [Fitur Utama](#fitur-utama)
2. [Arsitektur Sistem](#arsitektur-sistem)
3. [Alur Kerja Deteksi Keamanan](#alur-kerja-deteksi-keamanan)
4. [Setup Hardware & Perkabelan ESP32-CAM](#setup-hardware--perkabelan-esp32-cam)
5. [Panduan Instalasi Aplikasi (Server-Side)](#panduan-instalasi-aplikasi-server-side)
6. [Panduan Pengoperasian Aplikasi](#panduan-pengoperasian-aplikasi)
7. [Konfigurasi Sensor & Kamera](#konfigurasi-sensor--kamera)
8. [Demo Aplikasi](#demo-aplikasi)

---

## Fitur Utama

### 1. Pelacakan Gerakan Otomatis (PIR-Triggered Servo Rotation)
* Menggunakan 3 sensor PIR (Kiri, Tengah, Kanan) untuk mendeteksi pergerakan di area sekitar kamera.
* Kamera akan secara otomatis berputar (menggunakan Motor Servo) mengarah ke lokasi PIR yang mendeteksi gerakan secara presisi.
* Sudut putaran servo untuk masing-masing arah sensor dapat diatur secara kustom melalui panel kontrol.

### 2. Live Streaming Video Real-Time
* Streaming video format MJPEG dari ESP32-CAM yang dikirim langsung melalui protokol WebSocket dengan latensi sangat rendah.
* Mendukung mode tampilan **Single View** (fokus pada satu kamera aktif) dan **Multiple View** (monitoring banyak kamera sekaligus di satu layar).

### 3. Deteksi Manusia Berbasis AI (Python Object Detection)
* Backend Node.js mengirimkan frame video secara asinkron ke server AI berbasis Python.
* Menampilkan *bounding box* (kotak pelacak) berwarna hijau di sekitar tubuh manusia secara *real-time* pada Kiosk UI.
* Perekaman video kejadian (durasi maksimal 10 detik per event) otomatis aktif ketika ada orang terdeteksi, dengan masa tenggang (*grace period*) 3 detik setelah orang meninggalkan area untuk memastikan rekaman selesai secara utuh.

### 4. Skala Resolusi & Kualitas Dinamis (Dynamic Resolution Scaling)
* Kamera memantau kekuatan sinyal Wi-Fi dalam satuan dBm secara berkala (setiap 8 detik).
* **Mode Dinamis**: Sistem secara otomatis menaikkan atau menurunkan resolusi/kualitas gambar ESP32-CAM berdasarkan kekuatan sinyal (Level 5 s.d. Level 1) untuk mencegah lag dan frame dropping saat bandwidth tidak stabil.
* Mendukung resolusi dari **UXGA (1600x1200)** hingga **96x96** (sangat optimal untuk Machine Learning/TinyML).
* **Mode Statis**: Kamera beroperasi dengan satu resolusi tetap.
* Tombol **Reset** cepat untuk mengembalikan semua konfigurasi resolusi/kualitas ke standar optimal: **HVGA (480x320)** dengan tingkat kualitas gambar **22**.

### 5. Panel Kontrol Kamera & Tuning Gambar (Kiosk UI)
* Pengaturan sensor kamera OV2640/OV3660 secara asinkron dari jarak jauh: Kecerahan (*Brightness*), Kontras (*Contrast*), Saturasi (*Saturation*), AWB (*Auto White Balance*), AEC (*Auto Exposure Control*), AGC (*Auto Gain Control*), efek khusus (Sepia, Grayscale, dll), H-Mirror, V-Flip, serta frekuensi XCLK.
* Kontrol sudut Servo manual melalui slider interaktif.
* Pengaturan intensitas lampu Flash LED kamera pada saat pengambilan foto resolusi tinggi.

### 6. Integrasi Bot Telegram & Alert Log
* Mengirimkan notifikasi peringatan pergerakan instan ke grup/kontak Telegram.
* Notifikasi dikirimkan di akhir kejadian berupa:
  1. **Foto Snapshot Resolusi Tinggi (FHD)** dengan *bounding box* AI teranotasi.
  2. **Rekaman Video MP4** dari kejadian gerakan tersebut.
* Log kejadian tersimpan secara lokal dan dapat diakses langsung pada halaman dashboard.

---

## Arsitektur Sistem

Sistem ini terbagi menjadi 3 komponen utama yang saling terhubung:

```
+-------------------+             WebSocket (Frames)            +--------------------+
|                   |------------------------------------------>|                    |
|     ESP32-CAM     |                                           |   Node.js Server   |
|   (C++ / Sketch)  |<------------------------------------------| (backendAndBot/src)|
|                   |            Config & Commands              +--------------------+
+-------------------+                                               |    ^          |
    ^           |                                     TCP Socket    |    |          | WebSocket
    |           v                                     for AI        v    |          | & HTTP
+-------------------+                                           +------------+      | (Live Stream)
| PIR Sensors (3x)  |                                           | Python AI  |      v
| & Motor Servo     |                                           | (Detector) |  +--------------------+
+-------------------+                                           +------------+  |  Vue Kiosk Frontend|
                                                                                |  (cameraKiosk/src) |
                                                                                +--------------------+
```

1. **ESP32-CAM Client (C++/Arduino)**: Mengambil data stream gambar, membaca sensor PIR, mengendalikan servo, dan mengirimkan stream gambar via WebSocket biner ke backend.
2. **Backend Server (Node.js & Express)**: Bertindak sebagai gateway utama, menangani koneksi WebSocket, mengelola konfigurasi, mengompilasi video MP4 menggunakan FFmpeg, mengirim log, serta mengintegrasikan bot Telegram.
3. **AI Detector (Python & OpenCV)**: Memproses gambar mentah untuk melakukan deteksi manusia berbasis AI dan mengembalikan koordinat kotak (*bounding box*).
4. **Vue Kiosk UI (Vue 3 & Bootstrap)**: Dashboard antarmuka pengguna bergaya modern dengan tema gelap premium untuk monitoring langsung dan konfigurasi jarak jauh.

---

## Alur Kerja Deteksi Keamanan

[tambahkan gambar alur_deteksi_keamanan disini]

1. Sensor PIR mendeteksi adanya gerakan di salah satu sisi (Kiri/Tengah/Kanan).
2. Servo memutar kamera ESP32-CAM secara instan ke arah gerakan tersebut.
3. ESP32-CAM mengirimkan notifikasi gerakan biner ke backend.
4. Server Node.js mulai mengumpulkan frame video dan memulai antrean pemrosesan frame ke server Python AI.
5. Jika AI mendeteksi keberadaan manusia:
   * Backend menandai status event sedang merekam dan membuat placeholder entri baru di log.
   * Server Python AI merender gambar teranotasi (*bounding box*) untuk disimpan sebagai snapshot utama.
6. Saat manusia meninggalkan jangkauan kamera (selama minimal 3 detik grace period):
   * Backend menghentikan proses pengumpulan frame video.
   * Render video MP4 dijalankan secara asinkron menggunakan FFmpeg.
   * Bot Telegram mengirim pesan peringatan yang berisi **Foto Teranotasi** diikuti dengan **Video MP4**.
   * Log dashboard diperbarui dengan tautan video hasil rekaman.

---

## Setup Hardware & Perkabelan ESP32-CAM

[tambahkan gambar skema_perkabelan disini]

Berikut adalah konfigurasi pinout antara ESP32-CAM AI-Thinker dengan modul sensor PIR dan motor servo:

### 1. Skema Pinout
| Komponen | Pin Komponen | Pin ESP32-CAM | Deskripsi |
| :--- | :--- | :--- | :--- |
| **PIR Sensor (Kiri)** | OUT / Data | GPIO 13 | Input sinyal gerakan kiri |
| **PIR Sensor (Tengah)** | OUT / Data | GPIO 15 | Input sinyal gerakan tengah |
| **PIR Sensor (Kanan)** | OUT / Data | GPIO 14 | Input sinyal gerakan kanan |
| **Motor Servo** | PWM / Control (Orange) | GPIO 12 | Kontrol sudut servo pemutar |
| **Flash LED** | Onboard | GPIO 4 | Lampu sorot flash (Built-in) |

### 2. Sumber Daya (Powering)
* **VCC & GND**: Hubungkan semua kaki VCC komponen PIR ke 5V, dan GND ke GND.
* **Servo MG90S/SG90**: Motor servo menarik arus besar ketika berputar. Sangat direkomendasikan menggunakan **Power Supply Eksternal 5V 2A** untuk mensuplai servo secara terpisah. Pastikan untuk menghubungkan **GND Power Supply Eksternal** dengan **GND ESP32-CAM** (Common Ground) agar sinyal PWM dapat terbaca dengan benar.

### 3. Konfigurasi Arduino IDE
1. Buka Arduino IDE dan buka file `camera_client_ws/camera_client_ws.ino`.
2. Pasang library berikut melalui Library Manager:
   * `WebSockets` oleh Markus Sattler
3. Konfigurasi pada menu Tools:
   * Board: **AI Thinker ESP32-CAM**
   * PSRAM: **Enabled** (Wajib aktif untuk buffer streaming)
   * Partition Scheme: **Huge APP (3MB No OTA/1MB SPIFFS)**
4. Ubah kredensial Wi-Fi Anda pada baris 45-46:
   ```cpp
   const char* ssid = "SSID_WIFI_ANDA";
   const char* password = "PASSWORD_WIFI_ANDA";
   ```
5. Unggah/Upload sketch ke board ESP32-CAM Anda menggunakan USB-to-TTL UART Adapter.

---

## Panduan Instalasi Aplikasi (Server-Side)

### 1. Prasyarat Sistem & Spesifikasi Komputer Server
Untuk menjalankan AI inference (deteksi manusia) serta menghosting web server dan WebSocket dengan lancar, komputer server Anda harus memenuhi spesifikasi minimum berikut:

* **Perangkat Keras (Hardware)**:
  * **Single Board Computer**: Raspberry Pi 3, 4, atau 5 (atau SBC sejenis seperti Orange Pi / Odroid).
  * **Komputer/PC/Laptop**: Intel Core i5 Generasi ke-3 (atau prosesor AMD/Intel lain dengan CPU setara).
  * **RAM**: Minimal **1 GB s.d. 2 GB RAM** (RAM lebih besar direkomendasikan untuk performa deteksi AI yang lebih responsif dan lancar).
* **Sistem Operasi**:
  * **Linux OS**: Ubuntu Server (versi LTS direkomendasikan), Debian, Raspberry Pi OS, atau distro Linux pilihan Anda lainnya.
* **Perangkat Lunak Pendukung**:
  * **Node.js** (v16 atau lebih baru)
  * **Python** (v3.8 atau lebih baru)
  * **FFmpeg** (terdaftar di environment path sistem operasi Anda untuk rendering video)

### 2. Instalasi & Setup Langkah demi Langkah

#### Langkah Awal: Kloning Repositori
Kloning repositori proyek ini ke komputer server lokal Anda terlebih dahulu:
```bash
git clone https://github.com/username/projectTaGateway.git
cd projectTaGateway
```

#### Langkah A: Setup Server Node.js (Backend)
1. Masuk ke folder backend:
   ```bash
   cd backendAndTelegramBot
   ```
2. Pasang pustaka dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi berkas lingkungan (.env):
   * Buat/edit file `.env` di dalam folder ini dan isi dengan Token Bot Telegram Anda:
     ```env
     TELEGRAM_BOT_TOKEN=TOKEN_BOT_TELEGRAM_ANDA
     TELEGRAM_AUTH_PASSWORD=PASSWORD_UNTUK_AUTENTIKASI_USER
     ```
4. Jalankan server backend (development mode):
   ```bash
   npm run dev
   ```
   *Server akan berjalan di port `3000` dan mengaktifkan fitur HTTPS otomatis dengan mDNS `gateway.local`.*

#### Langkah B: Setup AI Detector (Python)
1. Masuk ke folder detektor:
   ```bash
   cd human_detection
   ```
2. Buat virtual environment Python baru dan aktifkan:
   ```bash
   python3 -m venv pc_env
   source pc_env/bin/activate
   ```
3. Pasang semua paket dependensi yang dibutuhkan:
   ```bash
   pip install -r requirements.txt
   ```
4. Pastikan file model pre-trained `yolo11n_int8.tflite` sudah tersedia di dalam folder.
5. Jalankan server deteksi Python:
   ```bash
   ./start.sh
   ```
   *Server AI Python akan berjalan secara lokal dan mendengarkan request frame gambar dari server Node.js.*

#### Langkah C: Setup Kiosk UI (Frontend)
1. Masuk ke folder dashboard:
   ```bash
   cd cameraKiosk
   ```
2. Pasang pustaka dependensi:
   ```bash
   npm install
   ```
3. Jalankan server Kiosk:
   ```bash
   npm run dev
   ```
   *Dashboard akan dapat diakses di peramban web pada alamat `http://localhost:5173`.*

---

## Panduan Pengoperasian Aplikasi

### 1. Menghubungkan Kamera
* Nyalakan ESP32-CAM Anda. Kamera akan mencari koneksi Wi-Fi dan secara otomatis meresolve alamat server menggunakan mDNS `gateway.local`.
* Setelah terhubung, status kamera di Kiosk UI akan berubah menjadi **Online (🟢)** dan streaming video *real-time* akan langsung muncul.

### 2. Registrasi Penerima Notifikasi Telegram
* Buka aplikasi Telegram dan cari bot Anda menggunakan username bot yang sesuai.
* Tekan `/start` atau kirim pesan apapun. Bot akan merespons dengan meminta password autentikasi.
* Kirimkan password yang telah Anda set di file `.env` backend (misal: `123123`).
* Setelah autentikasi sukses, ID akun Telegram Anda berhasil terdaftar ke dalam database `data/config.json`. Anda sekarang akan menerima peringatan deteksi manusia berupa foto dan rekaman video secara otomatis.

### 3. Mengontrol Servo Manual & Image Tuning
* Buka dashboard Kiosk di peramban web (`http://localhost:5173`).
* Gunakan slider sudut di bawah layar untuk memutar arah kamera secara manual atau klik tombol arah Kiri/Tengah/Kanan.
* Klik tombol **Configure Camera** untuk membuka modal pengaturan detail sensor. Di sini Anda bisa mengaktifkan mode dynamic scaling, mengubah brightness/contrast, serta melakukan Reset parameter ke default.

---

## Konfigurasi Sensor & Kamera

[tambahkan gambar camera_configuration_modal disini]

Untuk mengatur detail tuning kamera dan dynamic resolution scaling:
1. Klik tombol **Configure Camera** di dashboard Kiosk.
2. Atur **Scale Mode**:
   * **Static**: Pilih satu resolusi tetap untuk streaming.
   * **Dynamic**: Tentukan resolusi & kualitas untuk 5 tingkatan kualitas sinyal Wi-Fi berbeda (Excellent s.d. Very Weak).
3. Klik tombol **Save Camera Settings** untuk mengirimkan perintah konfigurasi langsung ke ESP32-CAM via WebSocket.
4. Jika ingin mengembalikan semua pengaturan resolusi ke kondisi bawaan awal, klik tombol **Reset** yang berada di dalam kotak "Resolution & Quality".

---

## Demo Aplikasi

[tambahkan gambar dashboard_monitoring disini]
*Tampilan dashboard monitoring utama dengan panel kontrol servo manual, live streaming video, panel log riwayat, dan grafik status sistem.*

[tambahkan gambar telegram_notification_demo disini]
*Tampilan pesan bot Telegram berupa lampiran snapshot manusia ber-bounding box AI beserta lampiran video rekaman MP4.*
