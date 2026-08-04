# Sistem Monitoring Keamanan & Bounding Box AI Berbasis ESP32-CAM & Sensor Getar

Sistem monitoring keamanan pintar berbasis IoT yang mengintegrasikan kamera **ESP32-CAM**, sensor gerak PIR multi-arah, **Node Sensor Getar (Vibration Sensor Node)** dengan kontrol relay HTTP, motor servo pemutar kamera otomatis, kecerdasan buatan (**AI YOLO 11**) untuk deteksi dan pelacakan manusia (*Object Tracking* berbasis *Proportional Controller*), penyimpanan terpusat **SQLite Database**, serta bot Telegram untuk notifikasi instan berupa foto snapshot dan rekaman video MP4 secara *real-time*.

---

## 📋 Daftar Isi
1. [Panduan Instalasi Aplikasi (Server-Side)](#panduan-instalasi-aplikasi)
   * [Instalasi pada Linux (Ubuntu, Linux Mint, Debian)](#1-instalasi-pada-linux-ubuntu-linux-mint--debian-based)
   * [Instalasi pada Windows (Windows 10 / 11)](#2-instalasi-pada-windows-windows-10--11)
   * [Startup Scripts Opsi Cepat (Windows & Linux)](#3-startup-scripts-opsi-cepat-windows-batch--linux-shell)
2. [Setup Hardware & Perkabelan](#setup-hardware-perkabelan)
   * [Pinout ESP32-CAM (AI-Thinker)](#1-pinout-esp32-cam-ai-thinker)
   * [Pinout Node Sensor Getar](#2-pinout-node-sensor-getar-vibration-sensor-node)
   * [Konfigurasi Arduino IDE](#3-konfigurasi-arduino-ide)
   * [Skematik Rangkaian & Desain Hardware Node](#4-skematik-rangkaian--desain-hardware-node)
   * [Dokumentasi Fisik & Realisasi PCB Hardware](#5-dokumentasi-fisik--realisasi-pcb-hardware)
3. [Panduan Pengoperasian & Konfigurasi](#panduan-pengoperasian-konfigurasi)
   * [Modal Pengaturan Kamera & Servo (Kiosk UI)](#1-modal-pengaturan-kamera--servo-kiosk-ui)
   * [Pengujian Relay Node Sensor Getar](#2-pengujian-relay-node-sensor-getar)
4. [Fitur Utama](#fitur-utama)
   * [Pelacakan Gerakan Otomatis (PIR)](#1-pelacakan-gerakan-otomatis-pir-triggered-servo-rotation)
   * [Node Sensor Getar & HTTP Relay API](#2-node-sensor-getar--http-relay-control-api)
   * [Deteksi Manusia YOLO 11 & P-Controller](#3-deteksi-manusia-yolo-11--pure-proportional-object-tracking)
   * [Mode Sapuan Servo (Sweep & Auto-Return)](#4-mode-sapuan-servo-servo-sweep--auto-return)
   * [Protokol Streaming Biner 16-Bit](#5-protokol-streaming-biner-16-bit--dynamic-chunking)
   * [Penyimpanan Terpusat SQLite Database](#6-penyimpanan-terpusat-sqlite-database-camera_datadb)
   * [Panel Kontrol Kiosk UI Modern](#7-panel-kontrol-kiosk-ui-modern)
   * [Integrasi Bot Telegram & Alert Log](#8-integrasi-bot-telegram--alert-log)
5. [Arsitektur Sistem](#arsitektur-sistem)
6. [Alur Kerja Deteksi Keamanan & Flowchart](#alur-kerja-deteksi-keamanan)
7. [Dokumentasi API & Skema Payload WebSocket](#dokumentasi-api--skema-payload-websocket)
   * [HTTP REST API Endpoint Registry](#1-http-rest-api-endpoint-registry)
   * [Payload WebSocket (ESP32-CAM <-> Backend)](#2-skema-payload-websocket-esp32-cam---backend-nodejs)
   * [Payload WebSocket (Backend <-> Kiosk UI)](#3-skema-payload-websocket-backend-nodejs---kiosk-ui-frontend)
8. [Demo & Tampilan Antarmuka](#demo-tampilan-antarmuka)

---

<a id="panduan-instalasi-aplikasi"></a>
## 💻 Panduan Instalasi Aplikasi (Server-Side)

Sistem ini mendukung pengoperasian pada lingkungan **Linux (Ubuntu, Linux Mint, Debian, & OS berbasis Debian/Ubuntu)** serta **Windows (10 / 11)**.

---

### 1. Instalasi pada Linux (Ubuntu, Linux Mint, & Debian-Based)

#### Langkah 1: Instalasi Paket Prasyarat Sistem
Buka Terminal dan jalankan perintah berikut untuk meng-install Node.js, Python, FFmpeg, dan Git:

```bash
# Update paket repository
sudo apt update && sudo apt upgrade -y

# Install Git, Curl, FFmpeg, dan Python3
sudo apt install -y git curl ffmpeg python3 python3-pip python3-venv

# Install Node.js (v18.x LTS via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi instalasi
node -v
npm -v
python3 --version
ffmpeg -version
```

#### Langkah 2: Kloning Repositori
```bash
git clone https://github.com/afandihrp/Sistem-Monitoring-Lahan-berbasis-ESP32CAM-relatif-murah.git
cd projectTaGateway
```

#### Langkah 3: Setup Node.js Backend & Bot Telegram
```bash
cd backendAndTelegramBot
npm install

# Buat file .env di folder backendAndTelegramBot/
echo "TELEGRAM_BOT_TOKEN=8105737525:AAH..." > .env
echo "TELEGRAM_AUTH_PASSWORD=password_anda" >> .env

# Jalankan Backend Server
./runbackend.sh
```
*(Backend beroperasi pada port 3000 dan secara otomatis menginisialisasi SQLite database `camera_data.db`)*

#### Langkah 4: Setup Python AI Detector (YOLO 11)
Buka tab/jendela Terminal baru:
```bash
cd projectTaGateway/human_detection
python3 -m venv pc_env
source pc_env/bin/activate
pip install -r requirements.txt

# Pastikan file model YOLO 11 'best.tflite' ada di folder ini, lalu jalankan:
./start.sh
```

#### Langkah 5: Setup Vue 3 Kiosk UI (Frontend)
Buka tab/jendela Terminal baru:
```bash
cd projectTaGateway/cameraKiosk
npm install
./runkiosk.sh
```
*(Akses dasbor melalui browser di `http://localhost:5173`)*

#### Langkah 6: Setup Nginx Reverse Proxy (Opsional / Direkomendasikan)
Menggunakan konfigurasi Nginx [nginx_configuration/linux/projectTaGateway.conf](file:///home/afandi/Desktop/projectTaGateway/nginx_configuration/linux/projectTaGateway.conf) untuk memetakan Kiosk UI (Port 5173) dan WebSocket API Backend (Port 3000) di bawah Port HTTP standar (Port 80):

```bash
# Install Nginx
sudo apt install -y nginx

# Menyalin file konfigurasi site Nginx untuk Linux
sudo cp projectTaGateway/nginx_configuration/linux/projectTaGateway.conf /etc/nginx/sites-available/projectTaGateway.conf

# Mengaktifkan situs & menghapus situs default (opsional)
sudo ln -s /etc/nginx/sites-available/projectTaGateway.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Uji konfigurasi & restart Nginx
sudo nginx -t
sudo systemctl restart nginx
```
*(Aplikasi kini dapat diakses langsung via browser di `http://localhost` tanpa perlu mengetik nomor port)*

---

### 2. Instalasi pada Windows (Windows 10 / 11)

#### Langkah 1: Instalasi Prasyarat Sistem
1. **Node.js**: Unduh installer **Node.js LTS (v18 atau v20)** dari [nodejs.org](https://nodejs.org/) dan jalankan instalasi.
2. **Python**: Unduh installer **Python 3.9+** dari [python.org](https://www.python.org/).
   * ⚠️ **PENTING**: Centang opsi **"Add python.exe to PATH"** sebelum menekan tombol *Install Now*.
3. **Git**: Unduh installer **Git for Windows** dari [git-scm.com](https://git-scm.com/).
4. **FFmpeg**:
   * **Via Winget (Command Prompt)**: Buka cmd sebagai Administrator dan jalankan `winget install FFmpeg`.
   * **Via Manual**: Unduh *build zip* dari [gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/), ekstrak, dan tambahkan direktori `bin` ke Environment Variables `PATH`.

#### Langkah 2: Kloning Repositori
Buka Command Prompt (cmd) atau PowerShell:
```cmd
git clone https://github.com/afandihrp/Sistem-Monitoring-Lahan-berbasis-ESP32CAM-relatif-murah.git
cd projectTaGateway
```

#### Langkah 3: Setup Node.js Backend & Bot Telegram
```cmd
cd backendAndTelegramBot
npm install

:: Buat file .env
echo TELEGRAM_BOT_TOKEN=8105737525:AAH... > .env
echo TELEGRAM_AUTH_PASSWORD=password_anda >> .env

:: Jalankan Backend Server
runbackend.bat
```

#### Langkah 4: Setup Python AI Detector (YOLO 11)
Buka jendela Command Prompt (cmd) baru:
```cmd
cd projectTaGateway\human_detection
python -m venv pc_env
pc_env\Scripts\activate
pip install -r requirements.txt

:: Jalankan Server AI Detector pada Windows
start.bat
```

#### Langkah 5: Setup Vue 3 Kiosk UI (Frontend)
Buka jendela Command Prompt (cmd) baru:
```cmd
cd projectTaGateway\cameraKiosk
npm install
runkiosk.bat
```
*(Akses dasbor melalui browser di `http://localhost:5173`)*

#### Langkah 6: Setup Nginx Reverse Proxy (Opsional / Direkomendasikan)
1. Unduh **Nginx for Windows** zip dari [nginx.org/en/download.html](https://nginx.org/en/download.html) dan ekstrak (misalnya ke `C:\nginx`).
2. Salin file `nginx.conf` khusus Windows dari folder proyek `projectTaGateway\nginx_configuration\windows\nginx.conf` dan timpa (*overwrite*) file `C:\nginx\conf\nginx.conf`.
3. Jalankan Nginx via Command Prompt (cmd):
   ```cmd
   cd C:\nginx
   start nginx
   ```
4. Perintah pengelolaan Nginx di Windows (cmd):
   ```cmd
   :: Reload konfigurasi Nginx setelah perubahan
   nginx -s reload

   :: Mematikan Nginx
   nginx -s stop
   ```
*(Aplikasi kini dapat diakses langsung via browser di `http://localhost` tanpa perlu mengetik nomor port)*

---

### 3. Startup Scripts Opsi Cepat (Windows Batch & Linux Shell)

Setiap subsistem proyek kini telah dilengkapi dengan script peluncuran lokal masing-masing untuk **Windows (`.bat`)** dan **Linux (`.sh`)**, serta utilitas otomasi publik/browser yang dikelompokkan di dalam folder `start script/`:

| Komponen Subsistem | Lokasi Folder Subsistem | Script Windows (`.bat`) | Script Linux (`.sh`) | Perintah Eksekusi / Fungsi Utama |
| :--- | :--- | :---: | :---: | :--- |
| **Backend Gateway** | `backendAndTelegramBot/` | `runbackend.bat` | `runbackend.sh` | Mengaktifkan server Node.js backend (`npm run dev`) pada Port 3000 |
| **AI Detector (YOLO 11)** | `human_detection/` | `start.bat` | `start.sh` | Mengaktifkan virtual env (`pc_env` / `ai_env`) & server AI (`python app.py`) |
| **Kiosk UI (Frontend)** | `cameraKiosk/` | `runkiosk.bat` | `runkiosk.sh` | Mengaktifkan server dev Vue 3 Kiosk UI (`npm run dev`) pada Port 5173 |
| **Public Funnel (Tailscale)** | `start script/windows/`<br>`start script/linux/` | `runFunnel.bat` | `runFunnel.sh` | Membuka rute HTTPS publik menggunakan `tailscale funnel 80` |
| **Auto Kiosk Browser** | `start script/windows/`<br>`start script/linux/` | `runChromeKiosk.bat` | `runChromeKiosk.sh` | Membuka Google Chrome otomatis dalam mode `--kiosk` fullscreen setelah delay 10s |

#### Cara Menggunakan di Windows:
Jalankan script `.bat` langsung dari dalam folder subsistem masing-masing:
```cmd
:: 1. Jalankan Server Backend Gateway
cd backendAndTelegramBot
runbackend.bat

:: 2. Jalankan Server AI Detector YOLO 11
cd ..\human_detection
start.bat

:: 3. Jalankan Server Kiosk UI Frontend
cd ..\cameraKiosk
runkiosk.bat

:: 4. (Opsional) Jalankan Tailscale Funnel Tunnel
cd "..\start script\windows"
runFunnel.bat

:: 5. (Opsional) Buka Browser Chrome Fullscreen Kiosk Mode
runChromeKiosk.bat
```

#### Cara Menggunakan di Linux (Ubuntu / Mint / Debian):
Jalankan script `.sh` langsung dari dalam folder subsistem masing-masing:
```bash
# 1. Jalankan Server Backend Gateway
cd backendAndTelegramBot
./runbackend.sh

# 2. Jalankan Server AI Detector YOLO 11
cd ../human_detection
./start.sh

# 3. Jalankan Server Kiosk UI Frontend
cd ../cameraKiosk
./runkiosk.sh

# 4. (Opsional) Jalankan Tailscale Funnel Tunnel
cd "../start script/linux"
./runFunnel.sh

# 5. (Opsional) Buka Browser Chrome Fullscreen Kiosk Mode
./runChromeKiosk.sh
```

---

<a id="setup-hardware-perkabelan"></a>
## 🔌 Setup Hardware & Perkabelan

### 1. Pinout ESP32-CAM (AI-Thinker)
| Komponen | Pin Komponen | Pin ESP32-CAM | Deskripsi |
| :--- | :--- | :--- | :--- |
| **PIR Sensor (Kiri)** | OUT / Data | GPIO 13 | Input sinyal gerakan sisi kiri |
| **PIR Sensor (Tengah)** | OUT / Data | GPIO 15 | Input sinyal gerakan sisi tengah |
| **PIR Sensor (Kanan)** | OUT / Data | GPIO 14 | Input sinyal gerakan sisi kanan |
| **Motor Servo** | PWM / Control | GPIO 12 | Sinyal PWM pemutar motor servo |
| **Flash LED** | Onboard LED | GPIO 4 | Lampu sorot flash (Kontrol PWM/LEDC) |

### 2. Pinout Node Sensor Getar (Vibration Sensor Node)
| Komponen | Pin Komponen | Pin ESP32/ESP8266 | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Sensor Getar** | OUT / Data | GPIO 4 (D2) | Sinyal input getaran |
| **Modul Relay** | IN / Signal | GPIO 1 (TX) | Kontrol relay active-low (`LOW` = ON, `HIGH` = OFF) |
| **HTTP API Server** | Port 80 | WebServer.h | Endpoint URL `/do?relay=1` atau `/do?relay=0` |

> [!IMPORTANT]
> **Power Supply Note**: Motor servo dan modul relay memerlukan arus yang stabil. Gunakan **Power Supply Eksternal 5V (Minimal 2A)**. Hubungkan jalur **GND Power Supply Eksternal** dengan **GND ESP32-CAM / Node Sensor** (*Common Ground*).

### 3. Konfigurasi Arduino IDE
1. Buka Arduino IDE dan buka file sketch:
   * Kamera: `camera_client_ws/camera_client_ws.ino` (atau `camera_client_ws_deploy.ino` untuk versi deploy tanpa log serial berlebihan).
   * Node Getar: `vibration_sensor_client/vibration_sensor_client.ino`.
2. Pengaturan Board untuk ESP32-CAM:
   * Board: **AI Thinker ESP32-CAM**
   * PSRAM: **Enabled** (Wajib aktif)
   * Partition Scheme: **Huge APP (3MB No OTA/1MB SPIFFS)**
3. Ubah kredensial Wi-Fi (`ssid` dan `password`) pada sketch.
4. *Compile* dan *Upload* program.

### 4. Skematik Rangkaian & Desain Hardware Node

| Skematik Node Kamera (ESP32-CAM) | Skematik Node Sensor Getar |
| :---: | :---: |
| ![Skematik Rangkaian Node Kamera](zfoto/6.png) | ![Skematik Rangkaian Node Sensor Getar](zfoto/7.png) |
| *Gambar 3.1: Skematik Rangkaian Node Kamera (ESP32-CAM)* | *Gambar 3.9: Skematik Rangkaian Node Sensor Getar* |

<br>

| Desain Enclosure Weatherproof Node Kamera |
| :---: |
| ![Desain Enclosure Tahan Cuaca Node Kamera](zfoto/8.jpeg) |
| *Gambar 3.2: Desain Enclosure Tahan Cuaca Node Kamera* |

### 5. Dokumentasi Fisik & Realisasi PCB Hardware

| Tampak Depan PCB Custom | Tampak Belakang PCB Custom |
| :---: | :---: |
| ![Tampak Depan PCB](zfoto/tampak%20depan%20pcb.png) | ![Tampak PCB Belakang](zfoto/tampak%20pcb%20belakang.jpg) |
| *Tampak Depan PCB Custom Node Kamera* | *Tampak Belakang PCB Custom Node Kamera* |

| Tampilan PCB Terpasang ESP32-CAM | Node Kamera Terpasang di Casing Enclosure |
| :---: | :---: |
| ![Tampilan PCB dengan ESP32-CAM](zfoto/tampilan%20pcb%20dengan%20esp32cam.png) | ![Tampak Kamera dengan PCB Terpasang di Casing](zfoto/tampak%20kamera%20dengan%20pcb%20terpasang%20di%20casing.png) |
| *Tampilan PCB Terpasang Modul ESP32-CAM* | *Node Kamera & PCB Terpasang di Casing Enclosure* |

<br>

| Instalasi Sensor Getaran di Pagar Area Lahan |
| :---: |
| ![Tampak Instalasi Sensor Getaran di Pagar](zfoto/tampak%20instalasi%20sensor%20getaran%20di%20pagar.jpg) |
| *Tampak Instalasi Sensor Getaran pada Pagar Area Pemantauan* |

---

<a id="panduan-pengoperasian-konfigurasi"></a>
## ⚙️ Panduan Pengoperasian & Konfigurasi

### 1. Modal Pengaturan Kamera & Servo (Kiosk UI)
* Klik ikon **Settings** di atas layar feed streaming untuk membuka modal pengaturan terpadu.
* **Tab Hardware**: Mengatur Brightness, Contrast, Saturation, AWB, AEC, Special Effects, serta penamaan kamera berbasis MAC address.
* **Tab PTZ & Sweep**: 
  * Mode Servo: Pilih antara **Sweep Mode** (sapuan otomatis) atau **Auto Return Mode**.
  * Servo Timer: Pilih interval waktu (misal 15s, 30s, atau Off).
  * Default Servo Angle: Menentukan sudut diam standar kamera (misal 90°).

### 2. Pengujian Relay Node Sensor Getar
* Gunakan file pengujian REST Client `vibration_sensor_client/test.rest` atau perintah `curl` untuk menguji relay:
  ```bash
  # Menyalahkan Relay (ON)
  curl "http://<IP_NODE_GETAR>/do?relay=1"

  # Mematikan Relay (OFF)
  curl "http://<IP_NODE_GETAR>/do?relay=0"
  ```

---

<a id="fitur-utama"></a>
## ⚡ Fitur Utama

### 1. Pelacakan Gerakan Otomatis (PIR-Triggered Servo Rotation)
* Menggunakan 3 sensor PIR (Kiri, Tengah, Kanan) pada ESP32-CAM untuk mendeteksi pergerakan di area sekitar secara presisi.
* Kamera berputar (menggunakan Motor Servo) mengarah ke posisi sensor PIR yang aktif, dengan pengiriman status WebSocket yang ditunda hingga gerakan servo selesai mencapai sudut target.

### 2. Node Sensor Getar & HTTP Relay Control API
* Mengintegrasikan node independen **Sensor Getar** (`vibration_sensor_client.ino`) berbasis ESP32/ESP8266.
* Menyediakan API HTTP Server pada Port 80 untuk mengontrol relay eksternal (`GET /do?relay=1` untuk ON dan `GET /do?relay=0` untuk OFF).
* Menggunakan pinout *Active-Low* (GND) untuk pemicuan relay yang aman dan stabil.

### 3. Deteksi Manusia YOLO 11 & Pure Proportional Object Tracking
* **Model YOLO 11 (`best.tflite`)**: Inferensi cepat dengan dukungan akelerasi **OpenVINO (Intel iGPU)** serta *fallback* CPU.
* **Pure Proportional (P) Controller**: Algoritma pelacakan objek di [objectFollower.js](file:///home/afandi/Desktop/projectTaGateway/backendAndTelegramBot/src/services/objectFollower.js) menggunakan pengontrol proporsional yang ringan, bebas *state*, dan *jitter-free* ($K_p = 45$, *deadband* $0.10$). Motor servo merespons posisi *bounding box* manusia secara halus untuk menjaga posisi subjek di tengah bidang pandang kamera.

### 4. Mode Sapuan Servo (Servo Sweep & Auto-Return)
* **Pilihan Mode Servo**: Mode *Sweep* (penyapuan berkala) atau *Auto-Return* (kembali ke sudut default).
* **Hitung Mundur Cerdas**: Penjadwalan hitung mundur ditampilkan di Kiosk UI (`nextTimerTime`). Sapuan otomatis ditangguhkan secara instan jika PIR atau AI mendeteksi manusia, dan berlanjut secara otomatis saat area kembali aman.
* Kecepatan sapuan diatur halus di firmware ESP32-CAM (250ms per derajat).

### 5. Protokol Streaming Biner 16-Bit & Dynamic Chunking
* Transmisi frame biner menggunakan paket header 16-bit Big-Endian (total 6 byte header + payload chunk).
* **Penyesuaian Chunk Dinamis**: ESP32-CAM mengevaluasi sinyal Wi-Fi (RSSI) secara *real-time*. Jika RSSI < -55dBm, ukuran paket chunk diturunkan secara otomatis dari 1024 byte menjadi 512 byte untuk mencegah kemacetan paket data.

### 6. Penyimpanan Terpusat SQLite Database (`camera_data.db`)
* Menggantikan file konfigurasi JSON lama dengan **SQLite Database** terintegrasi.
* Menyimpan profil konfigurasi hardware kamera/servo per alamat MAC (`device_configs`) dengan fitur *auto-migration schema* dan *fallback default values*, serta menyimpan riwayat log kejadian (*event log*).

### 7. Panel Kontrol Kiosk UI Modern
* Antarmuka web modern (Vue 3 + Tailwind CSS) dengan **Modal Pengaturan Bertab** (*Hardware Settings* dan *PTZ & Sweep Settings*).
* Penamaan kamera berbasis alamat MAC, pengukur FPS murni *client-side* (tersimpan di *LocalStorage*), indikator kesehatan *bandwidth*, dan kontainer video rasio 4:3 yang responsif untuk tampilan *mobile*.

### 8. Integrasi Bot Telegram & Alert Log
* Mengirimkan peringatan instan ke pengguna Telegram terautentikasi.
* Notifikasi memuat **Foto Snapshot Resolusi Tinggi (FHD)** berisikan *bounding box* hasil deteksi AI, beserta **Video MP4** rekaman kejadian yang di-render secara *asynchronous* menggunakan FFmpeg.

---

<a id="arsitektur-sistem"></a>
## 🏗 Arsitektur Sistem

Sistem ini terdiri dari komponen-komponen terintegrasi yang saling berkomunikasi melalui protokol jaringan berlatensi rendah:

```
+---------------------+         WebSocket (16-bit Chunks)        +----------------------+
|  ESP32-CAM Client   |----------------------------------------->|                      |
| (PIR 3x, Servo PTZ) |<-----------------------------------------|                      |
+---------------------+            Config & Commands             |    Node.js Server    |
                                                                 |    (Backend Gateway) |
+---------------------+           HTTP GET /do?relay=1/0         |                      |
| Node Sensor Getar   |----------------------------------------->|                      |
| (Relay Control API) |                                          +----------------------+
+---------------------+                                            |   ^            |
                                                      TCP Binary   |   |            | WebSocket
                                                      Frame Stream v   |            v & HTTP
                                                            +--------------+   +--------------------+
                                                            |  Python AI   |   | Vue 3 Kiosk UI     |
                                                            | (YOLO 11)    |   | Dashboard Frontend |
                                                            +--------------+   +--------------------+
                                                                                    |
                                                                                    v
                                                                          +--------------------+
                                                                          | SQLite Database    |
                                                                          | (camera_data.db)   |
                                                                          +--------------------+
```

### Visualisasi Arsitektur & Topologi Sistem

| Diagram Blok Keseluruhan | Desain Arsitektur Jaringan |
| :---: | :---: |
| ![Diagram Blok Keseluruhan Sistem](zfoto/5.jpeg) | ![Desain Arsitektur Jaringan](zfoto/2.jpeg) |
| *Gambar 3.16: Diagram Blok Keseluruhan Sistem* | *Gambar 3.17: Desain Arsitektur Jaringan* |

| Desain Aliran Data (Dataflow) | Denah Pantauan Kamera |
| :---: | :---: |
| ![Desain Aliran Data dan Integrasi Sistem](zfoto/1.jpeg) | ![Denah Pantauan Kamera](zfoto/3.jpeg) |
| *Gambar 3.18: Desain Aliran Data dan Integrasi Sistem* | *Gambar 3.10: Denah Pantauan Kamera* |

---

<a id="alur-kerja-deteksi-keamanan"></a>
## 🔄 Alur Kerja Deteksi Keamanan & Flowchart

### Flowchart Sistem Utama (Mermaid)

```mermaid
flowchart TD
    subgraph Hardware_Layer["Hardware Layer (ESP32 Nodes)"]
        PIR["Sensor PIR (Kiri/Tengah/Kanan)"]
        VIB["Node Sensor Getar (HTTP Relay API)"]
        CAM["Kamera ESP32-CAM (MJPEG Stream)"]
        SERVO["Motor Servo PTZ"]
    end

    subgraph Backend_Gateway["Node.js Backend Gateway"]
        WS["WebSocket Gateway & Router"]
        P_CTRL["Pure Proportional (P) Controller"]
        DB[("SQLite Database (camera_data.db)")]
        REC["FFmpeg Video Buffer & MP4 Renderer"]
        BOT["Telegram Bot Notifier"]
    end

    subgraph AI_Subsystem["Python AI Subsystem"]
        YOLO["Detector (YOLO 11 TFLite / OpenVINO)"]
    end

    subgraph Frontend_Kiosk["Vue 3 Kiosk Dashboard"]
        UI["Live Monitoring & Control Panel"]
    end

    PIR -->|"Trigger Gerakan"| CAM
    VIB -->|"HTTP GET /do?relay=1"| WS
    CAM -->|"16-bit Chunked Stream (UDP/WS)"| WS
    WS -->|"Video Frames"| UI
    WS -->|"Frame Feed"| YOLO
    YOLO -->|"Bounding Box Coordinates"| WS
    WS -->|"Koordinat Bounding Box"| P_CTRL
    P_CTRL -->|"Command Sudut Servo"| SERVO
    WS -->|"Event Trigger"| REC
    REC -->|"Simpan MP4 & Log"| DB
    REC -->|"Snapshot + Video MP4"| BOT
    BOT -->|"Notifikasi Peringatan"| USER["User (Aplikasi Telegram)"]
    UI -->|"Simpan Parameter / PTZ Manual"| DB
```

### Penjelasan Alur Kerja

1. **Deteksi Gerakan Awalan**:
   * Sensor PIR mendeteksi pergerakan di area Kiri, Tengah, atau Kanan $\rightarrow$ Servo memutar kamera ke sudut sensor terkait.
   * Atau **Node Sensor Getar** menerima getaran fisik $\rightarrow$ Memicu relai dan memancarkan request HTTP ke backend gateway.
2. **Pengiriman Stream & Inferensi AI**:
   * ESP32-CAM mengirimkan paket frame biner melalui protokol WebSocket 16-bit.
   * Backend Node.js meneruskan frame ke **Python AI Subsystem** (YOLO 11).
3. **Pelacakan Objek (Object Tracking)**:
   * Jika manusia terdeteksi, koordinat *bounding box* dikirim ke `objectFollower.js`.
   * **P-Controller** menghitung `deltaAngle = offset * Kp` dan menggerakkan servo untuk menjaga manusia tepat di tengah layar.
4. **Perekaman Video & Notifikasi Telegram**:
   * Backend mengumpulkan frame ke *rolling buffer*. Saat objek menghilang, FFmpeg me-render video MP4 secara *asynchronous*.
   * Notifikasi memuat foto snapshot resolusi tinggi dan rekaman MP4 dikirimkan ke Telegram pengguna serta dicatat pada database SQLite `camera_data.db`.

---

<a id="dokumentasi-api--skema-payload-websocket"></a>
## 🌐 Dokumentasi API & Skema Payload WebSocket

### 1. HTTP REST API Endpoint Registry

#### A. Backend Gateway Server (Port 3000)
| Endpoint | Method | Hak Akses | Deskripsi & Fungsionalitas | Contoh Request Payload | Contoh Response Output |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/api/login` | `POST` | Publik | Autentikasi pengguna Kiosk UI | `{"password": "123"}` | `{"success": true, "message": "Logged in successfully"}` |
| `/api/logout` | `POST` | Session | Logout session & hapus cookie auth | `-` | `{"success": true}` |
| `/api/verify` | `GET` | Cookie/IP | Verifikasi status autentikasi session / IP Lokal | `-` | `{"success": true, "local": true, "authenticated": true}` |
| `/upload` | `POST` | ESP32 | High-Res FHD Image upload dari ESP32-CAM | `Raw Binary JPEG Buffer` | `{"status": "ok", "file": "snapshot-1722..."}` |
| `/api/ping` | `GET` | Publik | Health-check endpoint gateway backend | `-` | `{"status": "pong", "timestamp": 1722800000000}` |

#### B. Node Sensor Getar (Port 80)
| Endpoint | Method | Deskripsi | Query Parameters | Contoh Request URL | Respon Output |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `/do` | `GET` | Kontrol HTTP Relay Active-Low | `relay=1` (ON) / `relay=0` (OFF) | `http://192.168.1.50/do?relay=1` | `HTTP 200 OK (Relay ON)` |

---

### 2. Skema Payload WebSocket (ESP32-CAM <-> Backend Node.js)

#### A. Pesan dari ESP32-CAM ke Backend:
* **Heartbeat Keep-Alive (Pong)**:
  ```json
  { "type": "pong" }
  ```
* **Status Sinyal PIR Motion**:
  ```json
  {
    "type": "motion",
    "sensor": "pir_left"
  }
  ```
* **Status Selesai Menyapu (Sweep Completed)**:
  ```json
  {
    "type": "sweep_status",
    "value": "off"
  }
  ```

#### B. Pesan dari Backend ke ESP32-CAM:
* **Kontrol Pergerakan Servo (PTZ)**:
  ```json
  {
    "type": "servo_control",
    "value": 90
  }
  ```
* **Kontrol Sapuan Servo (Sweep)**:
  ```json
  {
    "type": "sweep_control",
    "value": "once"
  }
  ```
* **Update Konfigurasi Hardware Kamera**:
  ```json
  {
    "type": "camera_config_update",
    "config": {
      "brightness": 0,
      "contrast": 0,
      "saturation": 0,
      "awb": 1,
      "aec": 1,
      "framesize": 6,
      "flashIntensity": 50
    }
  }
  ```

---

### 3. Skema Payload WebSocket (Backend Node.js <-> Kiosk UI Frontend)

#### A. Pesan Broadcast Backend ke Kiosk UI:
* **Daftar Perangkat Terhubung (`device_list`)**:
  ```json
  {
    "type": "device_list",
    "devices": [
      {
        "id": "A4:CF:12:89:56:4C",
        "ip": "192.168.1.100",
        "name": "Kamera Garasi Kiri",
        "type": "Camera",
        "currentAngle": 90,
        "sweepActive": "off",
        "nextTimerTime": 1722800015000,
        "servoMode": "sweep"
      }
    ]
  }
  ```
* **Broadcast Bounding Box Deteksi AI (`stream_boxes`)**:
  ```json
  {
    "type": "stream_boxes",
    "deviceId": "A4:CF:12:89:56:4C",
    "boxes": [
      {
        "confidence": 0.92,
        "posisi": [0.15, 0.20, 0.45, 0.85]
      }
    ]
  }
  ```
* **Perubahan Stream Aktif (`active_stream_updated`)**:
  ```json
  {
    "type": "active_stream_updated",
    "deviceId": "A4:CF:12:89:56:4C"
  }
  ```
* **Real-Time Event Log (`motion_event`)**:
  ```json
  {
    "type": "motion_event",
    "deviceId": "A4:CF:12:89:56:4C",
    "event": "PIR Motion Detected (PIR Left)",
    "timestamp": 1722800000000
  }
  ```

#### B. Pesan Kontrol dari Kiosk UI ke Backend:
* **Mengganti Kamera Aktif (`set_active_stream`)**:
  ```json
  {
    "type": "set_active_stream",
    "deviceId": "A4:CF:12:89:56:4C"
  }
  ```
* **Menyimpan Konfigurasi Servo & PTZ (`save_servo_config`)**:
  ```json
  {
    "type": "save_servo_config",
    "mac": "A4:CF:12:89:56:4C",
    "config": {
      "servoMode": "sweep",
      "servoTimer": "15s",
      "defaultAngle": 90,
      "leftPirAngle": 45,
      "middlePirAngle": 90,
      "rightPirAngle": 135
    }
  }
  ```
* **Menyimpan Konfigurasi Hardware Kamera (`save_camera_config`)**:
  ```json
  {
    "type": "save_camera_config",
    "mac": "A4:CF:12:89:56:4C",
    "config": {
      "name": "Kamera Depan Kandang",
      "brightness": 1,
      "contrast": 0,
      "specialEffect": "None"
    }
  }
  ```

---

<a id="demo-tampilan-antarmuka"></a>
## 📸 Demo & Tampilan Antarmuka

### 1. Antarmuka Kiosk UI & Dashboard Pemantauan

| Halaman Login Kiosk UI |
| :---: |
| ![Tampak UI Login Page](zfoto/tampak%20ui%20login%20page.png) |
| *Halaman Autentikasi Pengguna (Login Page)* |

| Dashboard Pemantauan Desktop (Desktop View) | Dashboard Pemantauan Mobile (Mobile View) |
| :---: | :---: |
| ![Tampak UI Dashboard Kiosk Desktop](zfoto/tampak%20ui%20dashboard%20kiosk%20desktop.png) | ![Tampak Dashboard Kiosk di Mobile](zfoto/tampak%20dashboard%20kiosk%20di%20mobile.png) |
| *Dashboard Pemantauan Utama Kiosk UI (Desktop View)* | *Dashboard Pemantauan Utama Kiosk UI (Mobile View)* |

### 2. Deteksi Manusia AI & Bounding Box Overlay

| Hasil Snapshot Deteksi Manusia dengan Bounding Box (YOLO 11) |
| :---: |
| ![Hasil Snapshot Deteksi Bounding Box Manusia](zfoto/tampak%20gambar%20dengan%20bounding%20box%20pada%20objek%20manusia.png) |
| *Hasil Snapshot Foto Resolusi Tinggi dengan Overlay Bounding Box Merah Tipis (1px) Hasil Inferensi YOLO 11* |
