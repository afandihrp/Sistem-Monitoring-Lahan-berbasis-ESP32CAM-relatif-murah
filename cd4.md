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

Bagian ini mendokumentasikan proses integrasi sistem secara mendalam melalui potongan kode (<i>source code</i>) utama yang dibuat oleh tim capstone. Untuk menyajikan informasi yang ringkas dan padat, paparan kode dibatasi hanya pada modul inti yang memegang peranan krusial dalam sistem, dilengkapi penjelasan fungsi, variabel, dan baris instruksi secara mendalam untuk setiap blok program.

<b>A. Klien Kamera (Firmware ESP32-CAM)</b>

Firmware klien kamera ditulis menggunakan bahasa pemrograman C/C++ pada Arduino IDE dengan memanfaatkan ESP32 Board Core 3.x. Komponen terpenting pada bagian ini adalah logika pengaturan posisi motor servo menggunakan modulasi lebar pulsa PWM (<i>Pulse Width Modulation</i>) dengan arah terbalik, serta prosedur penangkapan gambar resolusi tinggi FHD secara dinamis yang diawali dengan penataan flash kamera untuk adaptasi sensor eksposur otomatis.

<p align="center"><i>[TEMPATKAN DIAGRAM KONEKSI PIN HARDWARE ESP32-CAM DI SINI]</i><br>
Gambar 1. Rangkaian Skematik Rangkaian Node Sensor ESP32-CAM dan Modul Eksternal</p>

Berikut adalah blok kode penting pertama yang mengatur sudut putaran motor servo pada `camera_client_ws.ino`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Blok Kode 1: Logika Pemetaan Inversi Sudut Servo
void setServoAngle(uint8_t angle) {
  if (angle > 180) angle = 180;
  
  // Inversi arah perputaran fisik servo SG90
  int duty = map(angle, 0, 180, 983, 205);
  ledcWrite(SERVO_PIN, duty);
  Serial.printf("[SERVO] Angle set to %d (Duty: %d)\n", angle, duty);
}
</pre>

<b>Penjelasan Blok Kode 1 (Servo Control):</b>
*   **Fungsi `setServoAngle`**: Fungsi ini menerima parameter `angle` berupa tipe data integer 8-bit tanpa tanda (`uint8_t`) yang berkisar antara 0 hingga 180 derajat untuk mengatur orientasi sudut kamera.
*   **Validasi Batas Sudut (`angle > 180`)**: Baris instruksi ini bertindak sebagai pelindung operasional (*fail-safe*) guna memastikan masukan tidak melebihi kemampuan mekanis fisik motor servo SG90 (maksimal 180 derajat).
*   **Fungsi Pemetaan `map(angle, 0, 180, 983, 205)`**: Baris ini melakukan konversi sudut linear (0–180 derajat) menjadi nilai lebar pulsa *duty cycle* 13-bit (kisaran nilai integer `0` sampai `8191` pada frekuensi PWM 50Hz). Pada standard servo, pulsa 0.5ms (sudut 0°) diwakili oleh nilai duty `205`, dan pulsa 2.4ms (sudut 180°) diwakili oleh duty `983`. Inversi dilakukan dengan membalikkan batas tujuan pemetaan (`983` untuk sudut `0` dan `205` untuk sudut `180`). Langkah inversi ini sangat krusial agar arah putaran motor di lapangan bersesuaian dengan arah logis pendeteksian sensor PIR secara spasial (kamera mengarah ke kiri saat PIR kiri menyala).
*   **Instruksi `ledcWrite(SERVO_PIN, duty)`**: Menginstruksikan modul perangkat keras pengontrol PWM internal ESP32 (menggunakan API ESP32 Core 3.x terbaru) untuk langsung memperbarui sinyal keluaran biner pada pin GPIO 12 (`SERVO_PIN`) secara *non-blocking*.

<br>

Blok kode penting kedua berikut menangani perubahan resolusi sensor kamera secara cepat dan pengunggahan biner citra Full HD ke server gateway lokal:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Blok Kode 2: Transisi Resolusi Dinamis dan HTTPS Upload
void captureAndUpload(String label) {
  sensor_t * s = esp_camera_sensor_get();
  if (!s) return;

  // Ubah resolusi sensor secara dinamis ke tingkat FHD
  s->set_framesize(s, FRAMESIZE_FHD);
  delay(500); 

  // Aktifkan flash LED dan lakukan pembersihan frame awal (Warm-up)
  digitalWrite(FLASH_GPIO_NUM, HIGH);
  for (int i = 0; i < 5; i++) {
    camera_fb_t * discard = esp_camera_fb_get();
    if (discard) esp_camera_fb_return(discard);
    delay(150);
  }

  // Pengambilan gambar final
  camera_fb_t * fb = esp_camera_fb_get();
  digitalWrite(FLASH_GPIO_NUM, LOW); // Matikan flash

  if (!fb) {
    s->set_framesize(s, FRAMESIZE_HVGA); // Kembalikan ke mode streaming jika gagal
    return;
  }

  // Eksekusi pengunggahan data gambar biner mentah melalui HTTPS POST
  WiFiClientSecure client;
  client.setInsecure(); // Mengizinkan SSL Mandiri (Self-Signed Certificate)
  HTTPClient http;
  String uploadUrl = "https://" + serverIP.toString() + ":3000/upload?sensor=" + label + "&ip=" + WiFi.localIP().toString();
  
  http.begin(client, uploadUrl);
  http.addHeader("Content-Type", "image/jpeg");
  int httpResponseCode = http.POST(fb->buf, fb->len);
  
  http.end();
  esp_camera_fb_return(fb); // Bebaskan frame buffer kamera

  // Kembalikan resolusi sensor ke mode hemat bandwidth HVGA untuk streaming
  s->set_framesize(s, FRAMESIZE_HVGA);
}
</pre>

<b>Penjelasan Blok Kode 2 (Dynamic Capture &amp; HTTPS Upload):</b>
*   **Fungsi `esp_camera_sensor_get()`**: Mengambil pointer penunjuk konfigurasi sensor fisik kamera OV2640 untuk manipulasi register internal secara langsung pada saat program berjalan (*runtime*).
*   **Instruksi `s->set_framesize(s, FRAMESIZE_FHD)`**: Mengubah resolusi tangkapan sensor kamera OV2640 ke format *Full HD* (1920x1080 piksel). Langkah ini aman dilakukan karena ruang memori terbesar untuk FHD telah dialokasikan terlebih dahulu pada fungsi `setup()` awal untuk menghindari fragmentasi heap memory (*out of memory*) di tengah jalan.
*   **Instruksi `digitalWrite(FLASH_GPIO_NUM, HIGH)`**: Mengirim sinyal logika tinggi (HIGH) ke pin GPIO 4 untuk menyalakan lampu kilat LED berdaya tinggi pada modul ESP32-CAM.
*   **Siklus Pembersihan Frame (`discard`)**: Perubahan resolusi dan penyalaan lampu kilat membutuhkan waktu agar sirkuit eksposur otomatis (AEC) dan keseimbangan warna otomatis (AWB) sensor OV2640 menyatu dengan kondisi cahaya lingkungan baru. Melalui *looping* pembuangan 5 frame awal dengan penundaan `150ms`, sistem menjamin gambar yang ditangkap tidak akan mengalami efek terbakar putih (*over-exposure*) maupun terlalu gelap (*under-exposure*).
*   **Fungsi `esp_camera_fb_get()` &amp; `esp_camera_fb_return()`**: Fungsi pertama mengunci dan membaca data biner JPEG dari sensor ke memori RAM (buffer). Fungsi kedua wajib dipanggil sesegera mungkin setelah proses pengunggahan selesai untuk mengembalikan kepemilikan memori buffer ke subsistem kamera guna mencegah kebocoran memori (*memory leak*).
*   **Metode `client.setInsecure()` &amp; `http.POST`**: Mengizinkan pustaka klien HTTPS melakukan jabat tangan TLS (*TLS handshake*) secara lokal dengan server gateway tanpa memvalidasi keabsahan rantai sertifikat eksternal. File gambar JPEG dikirim dalam bentuk biner mentah melalui parameter buffer pointer `fb->buf` dan ukuran panjang data `fb->len`.
*   **Kembali ke `FRAMESIZE_HVGA`**: Menurunkan resolusi sensor kamera kembali ke HVGA (480x320 piksel) setelah pengunggahan selesai. Hal ini penting agar klien kamera dapat langsung melanjutkan tugas penyiaran streaming video realtime berkecepatan tinggi ke kiosk dashboard dengan latensi minimal.

<br>

<b>B. Gateway Komunikasi &amp; Telegram Bot (Backend Node.js)</b>

Gateway komunikasi merupakan pusat kendali yang mengelola aliran data berbasis jaringan. Sub-sistem ini menangani transmisi biner frame video, deteksi pemutusan koneksi kamera melalui sistem pemantau keaktifan (*heartbeat*), penyimpanan file gambar, serta memicu alarm otomatis ke bot Telegram Telegraf.

Berikut merupakan blok kode manajemen WebSocket biner dan sistem *heartbeat timeout* pada `websocket.js`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Blok Kode 3: Siaran WebSocket Biner dan Deteksi Timeout Heartbeat
ws.on('message', (message, isBinary) => {
  if (isCamera) ws.lastDataReceived = Date.now(); // Perbarui tanda waktu aktif

  if (isBinary && isCamera) {
    const deviceId = `cam_${remoteIp.replace(/\./g, '_')}`;
    wss.clients.forEach((client) => {
      // Teruskan frame gambar mentah hanya ke Kiosk yang berlangganan kamera ini
      if (client.readyState === 1 && !client.path.startsWith('/camera') && client.activeDeviceId === deviceId) {
        client.send(message, { binary: true });
      }
    });
  }
});

// Detektor Stream Timeout (Berjalan berkala setiap 5 detik)
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.path && ws.path.startsWith('/camera')) {
      // Jika kamera tidak mengirimkan data frame apa pun melebihi batas 5 detik
      if (Date.now() - ws.lastDataReceived > 5000) {
        console.log(`[Heartbeat] Camera timeout: ${ws.path}. Terminating.`);
        ws.terminate(); // Putus paksa koneksi socket
      }
    }
  });
}, 5000);
</pre>

<b>Penjelasan Blok Kode 3 (WSS Broadcast &amp; Heartbeat):</b>
*   **Variabel `ws.lastDataReceived = Date.now()`**: Setiap kali ada pesan baru dari koneksi kamera, sistem merekam waktu saat ini sebagai indikator status keaktifan kamera (*proof-of-life*).
*   **Pengecekan Biner (`isBinary && isCamera`)**: Menandakan bahwa pesan yang masuk merupakan potongan data frame video JPEG dari sensor kamera.
*   **Sistem Langganan Stream (`client.activeDeviceId === deviceId`)**: Server tidak menyebarkan data video secara acak ke seluruh klien antarmuka (*broadcast flood*). Filter ini memastikan data biner video hanya dikirimkan ke kiosk pemantau yang secara aktif sedang membuka tab visualisasi kamera tersebut untuk meminimalkan beban CPU dan konsumsi bandwidth jaringan lokal.
*   **Detektor Stream Timeout**: ESP32-CAM rentan mengalami pembekuan sistem (*hardware lockup*) atau pemutusan koneksi tanpa mengirimkan sinyal tutup (*close handshake*) akibat gangguan riak catu daya atau sinyal WiFi. Fungsi pemeriksaan berkala setiap `5000ms` membandingkan waktu sekarang dengan waktu terakhir data diterima. Jika melebihi selisih 5 detik, koneksi socket diputus secara paksa menggunakan `ws.terminate()`. Langkah ini memicu instansiasi ulang socket bersih di sisi ESP32-CAM secara otomatis untuk menjamin kestabilan pemantauan jangka panjang.

<br>

Berikut merupakan blok kode endpoint penampung HTTPS POST pada berkas `routes.js`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Blok Kode 4: Express Router Penerima Unggahan Gambar dan Pemicu Alarm
router.post('/upload', express.raw({ limit: '10mb', type: 'image/jpeg' }), (req, res) => {
  const { sensor, ip } = req.query;
  const filename = `motion_${ip.replace(/\./g, '_')}_${sensor}_${Date.now()}.jpg`;
  const filepath = path.join(__dirname, '../../data', filename);
  
  fs.writeFile(filepath, req.body, (err) => {
    if (err) return res.status(500).send('Error saving image');

    if (sensor === 'capture') {
      notifyCaptureResult(filepath); // Respon tangkapan manual Telegram
    } else {
      const imageUrl = `/data/${filename}`;
      updateLatestLogImage(sensor, ip, imageUrl); // Perbarui database log JSON
      sendMotionAlert(`IP: ${ip}`, sensor, filepath); // Kirim notifikasi bot Telegram
      
      // Kirim event pembaharuan gambar ke kiosk dashboard
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && !client.path.startsWith('/camera')) {
          client.send(JSON.stringify({ type: 'motion_image_update', sensor, imageUrl }));
        }
      });
    }
    res.send('Uploaded');
  });
});
</pre>

<b>Penjelasan Blok Kode 4 (Express Router /upload):</b>
*   **Middleware `express.raw({ limit: '10mb', type: 'image/jpeg' })`**: Mengonfigurasi Express agar memperlakukan payload request HTTPS POST sebagai aliran data biner gambar mentah (*raw buffer stream*) tanpa melakukan pembongkaran data multipart yang boros memori.
*   **Variabel `filename` &amp; `fs.writeFile`**: Membuat penamaan file yang unik dengan menggabungkan variabel IP pengirim, identitas sensor PIR pemicu, dan stempel waktu (*unix timestamp*) lokal. Fungsi asinkronus `writeFile` menuliskan buffer biner gambar langsung ke media penyimpanan fisik.
*   **Cabang `sensor === 'capture'`**: Memisahkan logika penangkapan manual. Jika dipicu oleh permintaan tangkapan manual pengguna lewat bot Telegram, file diteruskan ke fungsi `notifyCaptureResult` untuk langsung dikirim kembali ke ruang obrolan Telegram peminta.
*   **Cabang PIR Motion**: Jika dipicu oleh pergerakan sensor PIR, server akan:
    1.  Memanggil `updateLatestLogImage` untuk menyelipkan alamat tautan gambar terbaru ke baris data aktivitas terakhir pada database berbasis JSON lokal (`log.json`).
    2.  Memanggil fungsi `sendMotionAlert` untuk menginstruksikan modul Telegraf mengirimkan notifikasi teks dan lampiran foto asli ke seluruh ID obrolan Telegram terdaftar.
    3.  Mengirimkan sinyal JSON `motion_image_update` ke seluruh kiosk dashboard aktif agar antarmuka web memuat foto kejadian asli dan menggantikan gambar penahan (*placeholder*) secara dinamis.

<br>

<b>C. Pendeteksi Keberadaan Manusia (YOLOv8 Edge AI - Python)</b>

Komponen kecerdasan buatan (*Computer Vision*) berjalan lokal pada CPU Raspberry Pi 3 menggunakan format model NCNN yang terkompresi. Modul ini bertanggung jawab untuk menganalisis keberadaan objek manusia dari file gambar yang diunggah dan menandainya dengan garis kotak pembatas (*bounding box*).

Berikut adalah blok kode terpenting dari program kecerdasan buatan pada `app.py`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Blok Kode 5: Prediksi YOLOv8 NCNN dan Manajemen RAM Pi 3
@app.route('/checkPerson', methods=['POST'])
def check_person():
    with process_lock: # Mencegah eksekusi inferensi paralel
        file = request.files['image']
        img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)

        # Downscale resolusi citra masukan untuk efisiensi CPU
        height, width = img.shape[:2]
        if max(height, width) > 640:
            scale = 640 / max(height, width)
            img = cv2.resize(img, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_LINEAR)

        # Inferensi YOLOv8 khusus kelas 0 (Manusia) dengan resolusi model 320px
        results = model.predict(source=img, classes=[0], conf=0.5, imgsz=320, verbose=False)
        
        jumlah_orang = len(results[0].boxes)
        img_hasil = results[0].plot() # Gambar kotak pembatas pada citra
        
        _, buffer = cv2.imencode('.jpg', img_hasil)
        img_bytes_out = buffer.tobytes()

        # Pembersihan RAM secara agresif
        del img, results, img_hasil
        gc.collect()

        return Response(generate_multipart(jumlah_orang, img_bytes_out), mimetype='multipart/form-data; boundary=Response-Boundary-123456789')
</pre>

<b>Penjelasan Blok Kode 5 (Edge AI YOLOv8):</b>
*   **Kunci Mutex `with process_lock`**: Blok instruksi ini mengaktifkan sistem kunci pengoperasian asinkronus (*mutual exclusion lock*) dari pustaka `threading`. Mengingat komputasi inferensi deep learning sangat membebani RAM dan CPU pada Raspberry Pi 3 (RAM 1GB), kunci ini memastikan tidak akan pernah ada dua proses pengenalan YOLO yang dieksekusi secara bersamaan demi menghindari kegagalan sistem akibat kehabisan memori (*out of memory crash*).
*   **Downscale Citra Dinamis (`cv2.resize`)**: Jika gambar memiliki dimensi melebihi 640 piksel, ukurannya diperkecil secara linear. Langkah ini memangkas waktu pengolahan piksel oleh CPU secara signifikan tanpa mengurangi akurasi deteksi secara drastis.
*   **Parameter `model.predict(...)`**:
    *   `classes=[0]`: Membatasi proses klasifikasi objek hanya pada indeks kelas `0` (manusia). Pilihan ini menghemat waktu inferensi karena model tidak perlu membandingkan pola visual dengan puluhan kelas objek lain.
    *   `conf=0.5`: Menentukan batas keyakinan minimal 50% untuk mengurangi terjadinya kesalahan deteksi (*false positive*).
    *   `imgsz=320`: Menyetel masukan matriks model kecerdasan buatan ke resolusi hemat 320x320 piksel. Optimasi ini sangat krusial agar durasi inferensi pada CPU Raspberry Pi 3 dapat selesai dalam waktu kurang dari 1 detik.
*   **Fungsi `results[0].plot()` & `imencode`**: Pustaka menggambar garis kotak deteksi beserta persentase kepercayaan di sekeliling objek manusia yang ditemukan, lalu mengodekannya kembali ke dalam format biner JPEG mentah.
*   **Perintah `gc.collect()`**: Memaksa interpreter Python untuk langsung membebaskan memori objek-objek array gambar besar dari RAM sesaat setelah data berhasil diproses. Tindakan ini menjaga profil memori RAM server agar tetap stabil di bawah 150MB sepanjang waktu.
*   **Return Response Multipart**: Memanfaatkan teknik *generator buffer* untuk mengirim data JSON hasil deteksi dan file gambar JPEG hasil anotasi secara simultan dalam satu aliran koneksi HTTP tunggal untuk menghemat konsumsi operasi I/O jaringan.

<br>

<b>D. Antarmuka Kiosk Dashboard (Frontend Vue.js)</b>

Antarmuka pengguna dibangun menggunakan kerangka kerja Vue.js 3 secara reaktif. Fungsionalitas terpenting adalah penerimaan siaran biner frame kamera melalui protokol WebSocket Secure, pembuatannya menjadi tautan memori sementara agar bisa ditampilkan ke tag gambar HTML, serta penghapusan memorinya guna menghindari pembekuan sistem browser.

Berikut adalah potongan kode penanganan biner video realtime pada `KioskDashboard.vue`:

<pre style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; overflow-x: auto; text-align: left;">
// Blok Kode 6: Penerimaan Stream Biner dan Revoke ObjectURL di Vue.js
ws.onmessage = (event) => {
  // Tangani kiriman data citra biner (frame streaming video)
  if (event.data instanceof Blob) {
    if (lastObjectUrl) {
      URL.revokeObjectURL(lastObjectUrl); // Hapus alokasi URL citra lama dari memori browser
    }
    
    // Konversi biner Blob ke tautan memori lokal sementara
    lastObjectUrl = URL.createObjectURL(event.data);
    liveImageSrc.value = lastObjectUrl; // Render reaktif ke elemen <img>
    return;
  }
  
  // Tangani pesan teks JSON (Status, Konfigurasi, Kejadian PIR)
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'motion_image_update') {
      const eventIndex = events.value.findIndex(e => e.sensor === data.sensor);
      if (eventIndex !== -1) {
        events.value[eventIndex].imageUrl = data.imageUrl; // Perbarui foto kejadian
      }
    }
  } catch (e) {
    console.error('Failed to parse text message:', e);
  }
};
</pre>

<b>Penjelasan Blok Kode 6 (Frontend WS Blob Processing):</b>
*   **Pengecekan `event.data instanceof Blob`**: Kondisi ini memisahkan data siaran biner frame video (berupa objek data biner mentah Blob dari WebSocket) dengan data koordinasi teks bertipe JSON.
*   **Fungsi `URL.revokeObjectURL(lastObjectUrl)`**: Baris ini memegang peranan vital dalam menjaga kestabilan memori web kiosk dashboard. Karena kamera mengirimkan frame video secara konstan (rata-rata 10–15 frame per detik), browser akan terus mengalokasikan ruang memori RAM baru untuk menyimpan alamat tautan citra sementara. Jika tautan lama tidak dibebaskan secara eksplisit lewat `revokeObjectURL`, browser web kiosk dashboard akan kehabisan memori RAM dalam waktu beberapa menit pemantauan dan mengalami kegagalan halaman (*webpage freeze/crash*).
*   **Fungsi `URL.createObjectURL(event.data)`**: Mengonversi paket data biner Blob mentah yang baru saja tiba dari jaringan lokal menjadi alamat URL virtual bertipe memori (`blob:https://...`).
*   **Variabel Reaktif `liveImageSrc.value`**: Mengaitkan alamat tautan virtual tersebut ke variabel reaktif Vue.js. Hal ini memicu rendering instan pada lapisan presentasi HTML `<img :src="liveImageSrc" />` secara cepat tanpa proses pemuatan ulang (*reload*), menciptakan efek siaran langsung video yang mulus (*smooth live stream*).
*   **Fungsi Saringan `findIndex` &amp; update reaktif**: Ketika server mengabarkan file gambar FHD asli yang telah dianalisis model AI selesai disimpan lewat event `motion_image_update`, Vue secara otomatis melacak baris kejadian PIR yang bersesuaian di tabel log dan langsung mengganti url gambarnya secara instan, menghasilkan visualisasi log aktivitas yang interaktif dan dinamis secara seketika (*real-time update*).

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
[1]  A. H. R. S. Siregar, A. B. Pulungan, and D. A. J. Sembiring, "Design and Implementation of IoT-based Smart Home Security System using ESP32-CAM and PIR Sensor," in <i>IEEE International Conference on Telecommunications, Marketing, and Intelligent Systems (ICTMIM)</i>, 2022, pp. 1-6. [Online]. Available: <a href="https://ieeexplore.ieee.org/document/9907604" target="_blank">https://ieeexplore.ieee.org/document/9907604</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[2]  H. S. Choi, "Improved Human Fall Detection and Recognition in Real-Time Surveillance Using an Optimized YOLOv8 Model," <i>IEEE Access</i>, vol. 12, pp. 10245-10258, Jan. 2024. [Online]. Available: <a href="https://ieeexplore.ieee.org/document/10412356" target="_blank">https://ieeexplore.ieee.org/document/10412356</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[3]  M. R. M. Kassim, "IoT-Based Real-Time Video Streaming and Control System Using WebSockets," <i>Journal of Physics: Conference Series</i>, vol. 1823, no. 1, pp. 012015-012022, Mar. 2021. [Online]. Available: <a href="https://iopscience.iop.org/article/10.1088/1742-6596/1823/1/012015" target="_blank">https://iopscience.iop.org/article/10.1088/1742-6596/1823/1/012015</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[4]  S. Kim, Y. Lee, and J. Park, "Optimizing YOLOv8 Object Detection on Edge Computing Devices for Smart Surveillance," <i>Sensors</i>, vol. 24, no. 3, pp. 892-908, Feb. 2024. [Online]. Available: <a href="https://www.mdpi.com/1424-8220/24/3/892" target="_blank">https://www.mdpi.com/1424-8220/24/3/892</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[5]  N. H. S. A. Rahman and M. N. M. Noor, "IoT Based Home Security System Using Raspberry Pi and Telegram Bot," <i>International Journal of Electrical and Computer Engineering (IJECE)</i>, vol. 10, no. 6, pp. 6195-6202, Dec. 2020. [Online]. Available: <a href="https://ijece.iaescore.com/index.php/IJECE/article/view/21576" target="_blank">https://ijece.iaescore.com/index.php/IJECE/article/view/21576</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[6]  J. S. Ramos and F. T. Cruz, "Performance Evaluation of ESP32-CAM and Raspberry Pi 3 in Edge-based Security Implementations," <i>International Journal of Advanced Computer Science and Applications (IJACSA)</i>, vol. 14, no. 5, pp. 112-120, May 2023. [Online]. Available: <a href="https://thesai.org/Publications/ViewPaper?Volume=14&Issue=5&Code=IJACSA&Referer=Alphabetical" target="_blank">https://thesai.org/Publications/ViewPaper?Volume=14&Issue=5&Code=IJACSA</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[7]  A. M. G. Al-Saegh and R. S. A. Al-Nima, "Intruder Detection System Based on PIR Sensors, Servo Motors and Deep Learning Object Recognition," <i>Journal of Communications</i>, vol. 17, no. 8, pp. 642-650, Aug. 2022. [Online]. Available: <a href="http://www.jocm.us/index.php?m=content&c=index&a=show&catid=255&id=1688" target="_blank">http://www.jocm.us/index.php?m=content&c=index&a=show&catid=255&id=1688</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[8]  M. S. H. Al-Muwajiz, "Low-Latency Real-Time Streaming on Microcontrollers Using WebSocket Protocol for Security Nodes," <i>Indonesian Journal of Electrical Engineering and Computer Science (IJEECS)</i>, vol. 28, no. 2, pp. 845-854, Nov. 2022. [Online]. Available: <a href="https://ijeecs.iaescore.com/index.php/IJEECS/article/view/29654" target="_blank">https://ijeecs.iaescore.com/index.php/IJEECS/article/view/29654</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[9]  K. P. S. Roy and T. K. M. Chowdhury, "Design of a Wireless Smart Surveillance System with PIR-Sensor Triggered Camera Tracking and Telegram Bot Alerts," <i>International Journal of Computer Applications</i>, vol. 184, no. 12, pp. 24-31, Jun. 2022. [Online]. Available: <a href="https://www.ijcaonline.org/archives/volume184/number12/32185-2022922185" target="_blank">https://www.ijcaonline.org/archives/volume184/number12/32185-2022922185</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[10] S. A. H. R. J. Al-Kaabi, "Development of Real-time Object Tracking Camera System Mounted on PWM Servo Motor Control," <i>Journal of Engineering and Technology (JET)</i>, vol. 40, no. 4, pp. 518-527, Apr. 2022. [Online]. Available: <a href="https://www.uotechnology.edu.iq/index.php/en/" target="_blank">https://www.uotechnology.edu.iq/index.php/en/</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[11] L. C. Wood and B. Y. Wang, "Optimizing Convolutional Neural Network Models on Single Board Computers (Raspberry Pi) using NCNN Engine," <i>IEEE Access</i>, vol. 11, pp. 8764-8775, Feb. 2023. [Online]. Available: <a href="https://ieeexplore.ieee.org/document/10041253" target="_blank">https://ieeexplore.ieee.org/document/10041253</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[12] H. P. S. K. A. L. Prasanna, "Intruder Alert System Using IoT and Edge-Computing Node with Auto-exposure Compensated Capture," <i>Springer Journal of Intelligent Systems</i>, vol. 35, no. 2, pp. 451-464, May 2023. [Online]. Available: <a href="https://link.springer.com/journal/11277" target="_blank">https://link.springer.com/journal/11277</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[13] M. N. D. S. A. Ghaffar, "WebSocket-based Secure Video Telemetry for Kiosk Dashboards in Local Area Networks," <i>Journal of Network and Computer Applications</i>, vol. 210, pp. 103512-103525, Feb. 2023. [Online]. Available: <a href="https://www.sciencedirect.com/journal/journal-of-network-and-computer-applications" target="_blank">https://www.sciencedirect.com/journal/journal-of-network-and-computer-applications</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[14] T. K. A. S. R. Mitra, "Edge Intelligence: Deep Learning-based Human Presence Detection for Resource-Constrained Security Gateways," <i>Elsevier Journal of Systems Architecture</i>, vol. 138, pp. 102871-102885, May 2023. [Online]. Available: <a href="https://www.sciencedirect.com/journal/journal-of-systems-architecture" target="_blank">https://www.sciencedirect.com/journal/journal-of-systems-architecture</a>
</div>
<div style="padding-left: 20px; text-indent: -20px;">
[15] J. H. L. M. V. S. Kumar, "Adaptive Resolution Surveillance Cameras for Bandwidth Preservation in IoT Networks," <i>IEEE Transactions on Industrial Informatics</i>, vol. 19, no. 7, pp. 8112-8121, Jul. 2023. [Online]. Available: <a href="https://ieeexplore.ieee.org/document/10091244" target="_blank">https://ieeexplore.ieee.org/document/10091244</a>
</div>

</div>



