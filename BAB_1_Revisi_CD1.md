# BAB I PENDAHULUAN

## 1.1 Deskripsi Umum Masalah dan Kebutuhan

Sistem monitoring pada sektor pertanian dan peternakan berperan penting dalam mendeteksi dini indikasi pencurian atau intrusi liar, sehingga pemilik lahan dapat merespons ancaman lebih cepat dan berpotensi menekan risiko kerugian finansial. Perlu ditegaskan bahwa fungsi utama sistem semacam ini bersifat **detektif** (mendeteksi dan memberi peringatan dini), bukan preventif dalam arti menghalangi pelaku secara fisik; kecepatan deteksi dan respons yang dihasilkanlah yang menjadi nilai tambah utamanya. Saat ini, solusi pengawasan yang umum diterapkan didominasi oleh perangkat CCTV (*Closed-Circuit Television*) berbasis IoT (*Internet of Things*) komersial. Namun, efektivitas operasional sistem ini sering terganggu oleh tingginya frekuensi alarm palsu (*false positive*), karena algoritma bawaan umumnya belum mampu membedakan secara presisi antara intrusi nyata dengan gangguan lingkungan alami seperti pergerakan dedaunan, perubahan intensitas cahaya, atau aktivitas hewan ternak di sekitar lahan.

Sebagai alternatif, terdapat tren pengembangan sistem pemantauan kustom yang mengintegrasikan kamera, unit pemroses lokal, dan algoritma deteksi objek berbasis AI seperti YOLO (*You Only Look Once*). Pendekatan ini pernah diterapkan secara langsung pada lahan mitra oleh tim capstone sebelumnya, menggunakan konfigurasi Raspberry Pi 4 sebagai unit pemroses, webcam sebagai node kamera, dan layanan VPS (*Virtual Private Server*) berbasis *cloud* untuk inferensi deteksi manusia. Sistem tersebut telah dioperasikan selama **[ISI: durasi pemakaian, misal "kurang lebih 8 bulan"]**. Setelah periode tersebut, mitra mulai keberatan menanggung biaya langganan VPS bulanan sebesar **[ISI: nominal biaya VPS per bulan, misal "Rp150.000–Rp300.000"]**, karena dianggap sebagai beban operasional (*OPEX*) yang tidak sebanding dengan skala usaha UMKM. Keluhan mitra inilah yang menjadi titik tolak permasalahan: bagaimana merancang sistem monitoring yang mempertahankan kemampuan deteksi AI, namun menghilangkan ketergantungan pada biaya komputasi *cloud* berulang.

Kelemahan lain dari pendekatan berbasis *cloud* adalah rendahnya rasio efisiensi antara biaya investasi dengan luas cakupan pemantauan. Mengingat lahan agraris memiliki karakteristik area terbuka yang sangat luas, penggunaan kamera bersudut pandang statis memaksa pengguna melipatgandakan jumlah perangkat demi memperoleh cakupan pengawasan yang komprehensif, sehingga biaya pengadaan membengkak secara eksponensial. Ditambah lagi, ketergantungan pada *streaming* video ke server eksternal membutuhkan *bandwidth* internet besar yang menjadi kendala kritis bagi wilayah rural dengan jaringan telekomunikasi fluktuatif, membuat operasional sistem menjadi tidak andal (*unreliable*).

Permasalahan ini semakin relevan apabila dikaitkan dengan tingginya angka kriminalitas di sektor properti dan aset produksi. Berdasarkan data Pemerintah Provinsi Jawa Barat tahun 2019–2021, sebanyak 14 dari 19 kabupaten/kota tercatat mengalami kasus pencurian, dengan total 9.452 desa terdampak dalam kurun tiga tahun [1][2].

<figure>
<img src="media/image6.png" style="width:3.14548in;height:2.34259in" />
<figcaption>Gambar 1.1.1 Grafik Kasus Pencurian Tahun 2019–2021</figcaption>
</figure>

Pencurian termasuk dalam permasalahan umum yang sering dialami dalam usaha peternakan [3]. Kehilangan aset biologis (ayam) maupun produk (telur) secara langsung mengurangi *output* produksi dan menurunkan pendapatan. Selain itu, aksi pencurian seringkali disertai perusakan fasilitas kandang, yang mengakibatkan proses produksi terhambat dan memunculkan biaya tambahan untuk perbaikan. Di samping itu, gangguan dari hama seperti ular, kucing liar, anjing liar, dan tikus juga berkontribusi pada berkurangnya aset biologis atau produk peternakan [3][4]. Tanpa adanya sistem *monitoring* yang andal, kerugian finansial dan psikologis bagi pemilik lahan akan terus berulang.

Kebutuhan ini semakin spesifik pada studi kasus peternakan ayam milik mitra, yang memiliki pagar utama sepanjang 35 meter dan area titik buta berbentuk "L" seluas 3×10 m dan 4×10 m. Secara topografi dan infrastruktur, terdapat pemisahan lokasi yang signifikan antara aset produksi dan tempat tinggal mitra. Kandang peternakan dan lahan terbuka berada pada jarak sekitar 100 meter dari rumah mitra. Di area peternakan telah tersedia infrastruktur jaringan eksisting berupa router yang terhubung langsung ke rumah mitra menggunakan kabel *fiber optik*. Rumah mitra akan dijadikan sebagai pos komando pusat yang menaungi PC Server untuk komputasi AI dan *Kiosk Monitor* untuk pemantauan pasif. Sayangnya, sistem kustom generasi sebelumnya gagal memanfaatkan *backbone fiber optik* lokal ini secara optimal; sistem tersebut justru memaksa seluruh *streaming* video dari router peternakan keluar ke internet publik menuju VPS *cloud*, yang tidak hanya memboroskan *bandwidth* tetapi juga memicu biaya langganan yang sebenarnya bisa dihindari jika komputasi dipusatkan secara lokal di PC Server rumah mitra.

Berdasarkan keterangan dari pemilik lahan, dibutuhkan sistem yang mampu:
1. Memberikan notifikasi visual (foto) secara *real-time* melalui aplikasi pesan instan (Telegram) sebagai sistem peringatan dini asinkron yang selalu aktif dengan konsumsi *bandwidth* minimal.
2. Menyediakan antarmuka pemantauan terpusat berbasis web (*Kiosk Monitor*) yang mendukung mode lokal (LAN) untuk pemantauan pasif 24/7 di pos rumah mitra tanpa membebani internet.
3. Mendukung akses jarak jauh (WAN) melalui internet secara *on-demand* (hanya saat dibutuhkan) melalui peramban web *mobile*, dengan syarat PC Server dalam keadaan menyala.
4. Beroperasi secara mandiri dengan memindahkan beban komputasi AI ke infrastruktur lokal, sehingga menghilangkan biaya operasional (*OPEX*) berlangganan *cloud*.

Permasalahan ini memenuhi kriteria *Complex Engineering Problem* (CEP) pada beberapa aspek berikut:

**Tabel 1.1 Kompleksitas Permasalahan**

| No | Kriteria Kompleksitas | Penjelasan |
|:---|:---|:---|
| 1 | Penyelesaian permasalahan memerlukan pengetahuan keteknikan yang mendalam. | Solusi yang dibutuhkan memerlukan integrasi pengetahuan di bidang sistem tertanam (ESP32-CAM), komunikasi nirkabel (Intranet Lokal), rekayasa perangkat lunak (*Backend Server*), dan implementasi *Machine Learning* (YOLO) untuk deteksi objek secara *real-time*. |
| 2 | Permasalahan melibatkan isu-isu yang luas, saling bersinggungan, dan melibatkan masalah non-teknis. | Masalah ini tidak hanya bersifat teknis, tetapi juga sangat terikat dengan aspek ekonomi (kebutuhan OPEX nol/biaya rendah), aspek fungsional (keandalan pada konektivitas internet terbatas), dan aspek keamanan (akurasi deteksi dan minimalisasi *alarm palsu*). |
| 3 | Permasalahan tersebut jarang ditemui pada skala industri besar, namun krusial bagi UMKM. | Optimasi biaya komputasi AI pada infrastruktur jaringan yang tidak stabil jarang menjadi prioritas pada skala industri besar yang memiliki *budget* IT tak terbatas. Namun, pada skala UMKM di area rural, setiap rupiah biaya operasional sangat diperhitungkan, menuntut adanya rekayasa arsitektur sistem yang inovatif untuk memisahkan beban komputasi dan beban akuisisi data secara efisien. |
| 4 | Permasalahan melibatkan pemangku kepentingan yang beragam dengan berbagai kebutuhan. | Permasalahan ini melibatkan beberapa aktor: (1) Pemilik Peternakan (butuh keamanan aset biologis), (2) Pemilik Lahan (butuh pemantauan area buta), dan (3) Penjaga Lahan (butuh sistem notifikasi yang tidak membingungkan/*false alarm*). |

## 1.2 Analisa Masalah

Masalah yang diangkat menyangkut multi-aspek, yaitu teknis, ekonomi, dan fungsionalitas-keamanan. Berikut adalah analisis akar permasalahan yang terjadi di lapangan.

### 1.2.1 Aspek Teknis

- **Inefisiensi Pemanfaatan Infrastruktur Jaringan Lokal:** Lahan peternakan dan rumah mitra (sebagai pos komando) terpisah sejauh kurang lebih 100 meter namun telah terhubung oleh *backbone fiber optik* yang memadai untuk lalu lintas data lokal. Masalah fundamental pada sistem terdahulu adalah arsitekturnya yang memaksa *streaming* video dari kamera di lahan untuk di-*routing* keluar melalui internet publik menuju VPS *cloud* secara 24/7 hanya untuk keperluan inferensi AI. Pendekatan ini sangat tidak efisien karena membebani *bandwidth* internet publik (yang di area rural sering fluktuatif) untuk lalu lintas yang sebenarnya bisa diisolasi sepenuhnya di dalam jaringan lokal melalui *fiber optik* yang sudah ada. Ketergantungan pada *cloud* ini pula yang menyebabkan sistem sering mengalami putus koneksi (*offline*) dan gagal mendeteksi intrusi secara *real-time* tepat pada saat dibutuhkan.

- **Keterbatasan Komputasi pada Perangkat Edge (SBC):** Sistem kustom sebelumnya menggunakan *Single-Board Computer* (SBC) seperti Raspberry Pi 4 sebagai unit pemroses di lahan. Kendala teknis fundamentalnya adalah SBC berbasis ARM tersebut tidak memiliki akselerator *neural network* (NPU/GPU) yang mumpuni untuk menjalankan inferensi model AI kompleks seperti YOLO secara *real-time* (FPS akan *drop* drastis hingga tidak fungsional untuk deteksi *real-time*). Keterbatasan *hardware* inilah yang pada akhirnya memaksa sistem lama untuk melakukan *offloading* komputasi ke VPS *cloud*, yang memicu biaya langganan bulanan dan ketergantungan mutlak pada stabilitas internet.

- **Jangkauan Area dan Titik Buta (*Blind Spot*):** Luasnya area (pagar 35 m) dan adanya area titik buta berbentuk "L" tidak memungkinkan diawasi hanya dengan satu kamera statis. Berdasarkan observasi langsung terhadap denah lahan (Gambar 1.2.1), teridentifikasi sejumlah titik rawan, terutama pada area belakang (pencahayaan minim), area teras (terhalang pagar), serta area tengah dan depan yang terhalang oleh rumah kaca, pepohonan, dan kolam. Kondisi topografi ini menuntut penambahan node kamera pada titik-titik spesifik yang apabila dilakukan menggunakan perangkat komersial konvensional akan memicu pembengkakan biaya investasi dan kompleksitas instalasi kabel fisik yang rawan putus di lahan terbuka.

<figure>
<img src="media/image7.jpeg" style="width:2.6in;height:2.93145in" />
<figcaption>Gambar 1.2.1 Denah Lahan dan Identifikasi Titik Buta</figcaption>
</figure>

### 1.2.2 Aspek Ekonomi

- **Biaya Operasional Berkelanjutan (OPEX):** Solusi kustom berbasis AI yang menggunakan komputasi *cloud* membebankan biaya operasional bulanan untuk layanan VPS. Sebagaimana disebutkan pada sub-bab 1.1, biaya ini mencapai **[ISI: nominal]**, yang dalam jangka panjang terakumulasi menjadi beban finansial signifikan yang ditolak oleh mitra berskala UMKM karena dianggap tidak berkelanjutan (*unsustainable*).

- **Tingginya Biaya Investasi Awal (CAPEX) Solusi Komersial:** Survei pada platform *e-commerce* terhadap tiga *brand* CCTV populer (IMOU, Ezviz, Uniview) menunjukkan rentang harga satuan Rp280.000 hingga Rp1.600.000, dengan rata-rata sekitar Rp760.000 per unit [10][11][12]. Angka ini belum termasuk biaya perekam (NVR/DVR), penyimpanan, maupun instalasi. Untuk menutupi seluruh titik buta lahan mitra yang memerlukan minimal beberapa unit kamera, biaya investasi awal solusi komersial akan sangat membebani permodalan UMKM.

### 1.2.3 Aspek Fungsionalitas dan Keamanan

- **Potensi Alarm Palsu (*False Alarm*):** Ketergantungan pada sensor gerak dasar (PIR) atau analisis perubahan piksel sangat rentan terhadap alarm palsu yang dipicu oleh hewan ternak, bayangan, dahan pohon, atau perubahan cuaca [8]. Di lingkungan peternakan, hal ini menurunkan tingkat kepercayaan (*trust*) pengguna terhadap sistem dan berpotensi membuat mereka mengabaikan notifikasi ancaman yang sesungguhnya.

- **Keterbatasan Luas Cakupan Pengawasan:** Perangkat kamera pengawas standar bekerja dengan sudut pandang (*field of view*) yang statis dan kaku, menyebabkan area titik buta yang luas pada lahan terbuka, sehingga menurunkan efisiensi fungsional alat dalam memantau area peternakan secara komprehensif.

### 1.2.4 Aspek Sosial

Bagi pemilik lahan dengan mobilitas tinggi, pemantauan berkelanjutan secara manual sangat sulit dilakukan. Ketiadaan solusi peringatan dini yang andal menimbulkan beban psikologis dan rasa tidak aman yang berkelanjutan bagi pemilik maupun penjaga lahan, terlebih saat meninggalkan aset produksinya dalam waktu yang lama tanpa ada sistem yang memberikan jaminan deteksi dini atas kondisi lahan.

## 1.3 Analisa Solusi yang Ada

Analisis ini mengkaji beberapa alternatif solusi pengawasan guna memvalidasi *research gap* dari sistem yang diusulkan.

### 1.3.1 Sistem Kustom Sebelumnya (Raspberry Pi 4 + Webcam + VPS)

Sistem ini pernah diimplementasikan oleh tim capstone terdahulu pada lahan mitra menggunakan Raspberry Pi 4 dan algoritma YOLO yang dijalankan melalui layanan VPS.

- **Kelebihan:** Modularitas pemrograman yang baik, mampu mendeteksi wujud manusia secara presisi, dan mengirimkan notifikasi langsung ke gawai.
- **Keterbatasan:** Kendala teknis terbesarnya adalah **keterbatasan daya komputasi (CPU/GPU) pada Raspberry Pi 4** yang berbasis ARM dan tidak memiliki NPU mumpuni untuk inferensi YOLO secara *real-time*. Akibatnya, sistem **terpaksa melakukan *offloading* ke VPS Cloud**, memicu biaya langganan bulanan sebesar **[ISI: nominal]** yang memberatkan mitra. Selain itu, sistem menuntut *bandwidth* internet besar secara kontinu dan memiliki arah pandang statis.

### 1.3.2 Sistem CCTV IP Kamera Komersial

Kamera IP nirkabel tunggal (*Smart Home IP Camera*) yang terhubung langsung ke *router* Wi-Fi dan merekam data ke kartu memori (*MicroSD*). Harga satuan berkisar antara Rp280.000 hingga Rp1.600.000 dengan rata-rata sekitar Rp760.000 per unit [10][11][12].

- **Kelebihan:** Instalasi praktis (*plug-and-play*), harga satuan relatif murah, dan mudah diakses melalui aplikasi telepon pintar.
- **Keterbatasan:** Sangat bergantung pada ketersediaan *bandwidth* internet untuk akses jarak jauh. Penyimpanan lokal di kartu memori rawan terhadap pencurian fisik (jika kamera dicuri, rekaman hilang). Algoritma deteksi bawaan umumnya hanya menganalisis perubahan piksel, sehingga rawan memicu alarm palsu.

### 1.3.3 Sistem CCTV Berbasis DVR (Analog/HD-TVI/AHD)

Sistem sirkuit tertutup berbasis kabel koaksial/UTP dan DVR (*Digital Video Recorder*) merupakan standar industri keamanan konvensional yang mapan.

- **Kelebihan:** Mampu menyediakan cakupan area yang sangat baik dan andal secara kontinu (24/7) secara luring (*offline*). Transmisi kabel analog murni memastikan latensi nol dan tidak terpengaruh oleh fluktuasi sinyal nirkabel.
- **Keterbatasan:** Kelemahan fundamentalnya terletak pada **kompleksitas infrastruktur dan instalasi**. Di lahan peternakan terbuka dengan jarak hingga 100 meter antara kandang dan rumah mitra, membentangkan puluhan meter kabel daya dan data sangat tidak praktis, memicu biaya infrastruktur (kabel, pipa pelindung, galian) yang mahal, serta sangat rawan terputus akibat cuaca ekstrem, gigitan hama, atau aktivitas fisik di lahan. Selain itu, fitur analitik AI pada DVR komersial umumnya hanya tersedia pada model premium dengan harga yang tidak realistis bagi UMKM.

### 1.3.4 Sistem CCTV Wireless Berbasis NVR dengan AI

Solusi ini menggabungkan kamera nirkabel modern dengan mesin pusat NVR (*Network Video Recorder*) yang berkomunikasi melalui jaringan Wi-Fi lokal (*intranet*).

- **Kelebihan:** Menyelesaikan masalah instalasi kabel pada DVR dengan tetap mempertahankan keandalan pemantauan luring dan cakupan area yang luas.
- **Keterbatasan:** Kendala utamanya adalah **biaya investasi (CAPEX) yang sangat tinggi** (estimasi Rp4,8 juta hingga Rp5,2 juta untuk konfigurasi kelas menengah) dan sifat ekosistemnya yang tertutup (*proprietary / vendor lock-in*). Algoritma AI bawaan pabrik tidak dapat dilatih ulang (*retrain*) ketika sistem terus-menerus memicu *false alarm* akibat pergerakan daun atau hewan ternak. Mitra dipaksa menerima logika deteksi bawaan pabrik yang kaku dan tidak bisa dikustomisasi sesuai kebutuhan unik lahan peternakan.

### 1.3.5 Matriks Perbandingan Solusi

**Tabel 1.2 Matriks Perbandingan Solusi Monitoring**

| Solusi | Model Biaya (OPEX & CAPEX) | Ketergantungan Internet | Fleksibilitas AI | Kompleksitas Instalasi & Infrastruktur |
|:---|:---|:---|:---|:---|
| **Sistem Lama (RPi+VPS)** | **OPEX Tinggi** (Langganan VPS bulanan) | Tinggi (Wajib *streaming* ke Cloud) | Tinggi (*Custom*) | Sedang (Butuh RPi & Webcam di tiap titik) |
| **IP Kamera Komersial** | **CAPEX Sedang**, OPEX Rendah | Tinggi (Akses jarak jauh butuh internet stabil) | Rendah (*Locked*) | Mudah (*Plug-and-play*, tapi rawan kehilangan MicroSD) |
| **DVR Analog** | **CAPEX Tinggi** (Kabel & pipa pelindung panjang), OPEX Nol | Nol (Luring penuh) | Sangat Rendah / Tidak Ada | **Sangat Rumit.** Menarik kabel koaksial & daya sepanjang 100 m dari lahan ke rumah mitra sangat tidak praktis, rentan putus digigit hama/terkena cangkul, dan merusak estetika lahan. |
| **Wireless NVR + AI** | **CAPEX Sangat Tinggi** (Rp 4,8 jt–5,2 jt+), OPEX Nol | Rendah (Intranet lokal) | Rendah (*Proprietary/Locked*) | Mudah (Nirkabel), namun terkendala *Vendor Lock-in* |
| **Sistem Diusulkan (ESP32-CAM + PC + YOLO)** | **CAPEX Rendah** (Manfaatkan PC existing), **OPEX Nol** | **Sangat Rendah & Terkendali.** AI & Monitoring rutin 24/7 berjalan via LAN (*Fiber Optik*). Internet hanya digunakan untuk *payload* Telegram dan akses *on-demand* via Web Kiosk *Mobile*. | **Tinggi (*Custom & Retrainable*)** | **Mudah & Skalabel.** Memanfaatkan *backbone fiber optik* & router *existing* di lahan. Node ESP32-CAM terhubung ke WiFi lokal, *stream* langsung ke PC Server di rumah via LAN tanpa butuh kabel data fisik baru. |

## 1.4 Kesimpulan

Berdasarkan analisis yang telah dipaparkan, pengangkatan masalah ini sebagai proyek Capstone Design memiliki urgensi, relevansi, dan nilai kemanfaatan yang tinggi, dirangkum dalam beberapa poin berikut:

1. **Urgensi Pengamanan Lahan Berbiaya Efisien:** Sistem yang sebelumnya digunakan mitra terbukti fungsional secara teknis, namun menimbulkan beban biaya berlangganan VPS bulanan yang pada akhirnya ditolak oleh mitra karena dianggap tidak berkelanjutan bagi skala usaha UMKM.

2. **Kompleksitas Rancangan Multidimensional:** Solusi yang dirancang harus mengintegrasikan aspek perangkat keras dan perangkat lunak secara seimbang — komputasi lokal tanpa biaya berlangganan, arsitektur terpisah dengan unit kamera dedikasi yang skalabel, hingga optimalisasi komunikasi data lokal nirkabel melalui pemanfaatan infrastruktur *fiber optik* eksisting untuk mengatasi keterbatasan *bandwidth* internet.

3. **Kesenjangan Kritis Solusi yang Tersedia:** Sistem CCTV wireless NVR berfitur AI bersifat kaku akibat *vendor lock-in* (algoritma tidak bisa di-*retrain* untuk menghindari *false alarm* hewan/daun). Sistem DVR analog terkendala inefisiensi tarikan kabel di lahan terbuka. IP Kamera komersial rawan kehilangan bukti rekaman akibat pencurian fisik. Sementara itu, sistem kustom sebelumnya (RPi+VPS) menjadi bukti konkret bahwa pendekatan AI *custom* secara teknis layak, namun model biaya berbasis langganan *cloud* dan keterbatasan komputasi SBC-lah yang menjadi akar penolakan mitra.

4. **Penyediaan Alternatif Sistem Berdaya Guna Tinggi:** Kehadiran sistem pengawasan yang mempertahankan fleksibilitas deteksi AI *custom*, namun memindahkan seluruh biaya komputasi dari model langganan bulanan menjadi investasi satu kali (*one-time cost*) berbasis PC Server lokal (*Low-Power Mini PC repurposed*), menjadi solusi krusial bagi pelaku UMKM. Perlu digarisbawahi bahwa kontribusi utama sistem ini terletak pada kecepatan deteksi dan notifikasi dini (bersifat detektif), sehingga waktu respons terhadap potensi ancaman dapat dipersingkat tanpa membebani infrastruktur jaringan yang ada. Keberadaan node kamera yang aktif dan responsif juga berpotensi menimbulkan efek jera (*deterrent effect*) secara psikologis bagi pelaku, meskipun secara teknis sistem ini tidak menjamin pencegahan fisik secara mutlak.