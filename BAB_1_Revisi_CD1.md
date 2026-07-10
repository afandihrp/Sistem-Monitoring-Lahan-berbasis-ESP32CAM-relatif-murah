# BAB I PENDAHULUAN

> **Catatan revisi (hapus sebelum submit):**
> - Bagian bertanda `[ISI: ...]` wajib diisi dengan data asli sebelum dokumen ini difinalisasi.
> - Nomor sitasi [1]-[12] mengikuti dokumen asli sebagai acuan sementara — cek ulang urutan sitasi sesuai format IEEE setelah restrukturisasi ini selesai, karena beberapa bagian dipindah antar sub-bab.
> - Tabel harga CCTV yang tadinya panjang (26 baris) sudah diringkas jadi 3-4 kalimat dan dipindah ke 1.3.2 (Analisa Solusi), sesuai aturan template bahwa 1.2 hanya membahas masalah, bukan solusi.

## 1.1 Deskripsi Umum Masalah dan Kebutuhan

Sistem monitoring pada sektor pertanian dan peternakan merupakan instrumen krusial untuk meminimalkan risiko kerugian finansial akibat tindakan pencurian atau intrusi liar. Saat ini, solusi pengawasan yang umum diterapkan di lapangan didominasi oleh perangkat CCTV (*Closed-Circuit Television*) berbasis IoT (*Internet of Things*) komersial. Namun, efektivitas operasional dari sistem komersial ini sering terganggu oleh tingginya frekuensi alarm palsu (*false positive*) dalam mengidentifikasi ancaman manusia, karena algoritma bawaan sistem umumnya belum mampu membedakan secara presisi antara pergerakan intrusi nyata dengan gangguan lingkungan alami seperti pergerakan dedaunan, perubahan intensitas cahaya, atau aktivitas hewan ternak di sekitar lahan.

Sebagai alternatif penanganan, terdapat tren pengembangan sistem pemantauan kustom yang mengintegrasikan kamera, unit pemroses lokal, dan algoritma deteksi objek berbasis kecerdasan buatan seperti YOLO (*You Only Look Once*). Pendekatan ini pernah diterapkan secara langsung pada lahan mitra oleh tim capstone sebelumnya, menggunakan konfigurasi Raspberry Pi 4 sebagai unit pemroses, webcam sebagai node kamera, dan layanan VPS (*Virtual Private Server*) berbasis cloud untuk menjalankan inferensi deteksi manusia. Sistem tersebut telah dioperasikan pada lahan mitra selama **[ISI: durasi pemakaian, misal "kurang lebih 8 bulan"]**. Setelah periode pemakaian tersebut, mitra mulai keberatan menanggung biaya langganan VPS bulanan sebesar **[ISI: nominal biaya VPS per bulan, misal "Rp150.000–Rp300.000"]**, karena dianggap sebagai beban operasional berkelanjutan yang tidak sebanding dengan skala usaha UMKM yang dijalankan. Keluhan mitra inilah yang menjadi titik tolak langsung dari permasalahan yang diangkat pada proyek ini: bagaimana merancang sistem monitoring yang mempertahankan kemampuan deteksi objek berbasis AI, namun menghilangkan ketergantungan pada biaya komputasi cloud berulang.

Kelemahan lain yang melingkupi pendekatan berbasis cloud ini adalah rendahnya rasio efisiensi antara biaya investasi dengan luas cakupan pemantauan (*underwhelming cost-to-coverage ratio*). Mengingat lahan agraris memiliki karakteristik area terbuka yang sangat luas, penggunaan kamera dengan sudut pandang statis memaksa pengguna melipatgandakan jumlah perangkat demi memperoleh cakupan pengawasan yang komprehensif, sehingga biaya pengadaan dan pemeliharaan sistem membengkak secara eksponensial. Ditambah lagi, ketergantungan sistem pengawasan pada konektivitas internet aktif dan server eksternal menjadi kendala kritis bagi wilayah yang memiliki keterbatasan aksesibilitas jaringan telekomunikasi, sehingga operasional sistem menjadi tidak andal (*unreliable*) bagi pelaku usaha sektor agraris skala UMKM (Usaha Mikro, Kecil, dan Menengah).

Oleh karena itu, diperlukan sebuah alternatif perancangan sistem monitoring cerdas yang mampu menekan biaya operasional melalui penggunaan unit pemroses pusat yang mengolah algoritma deteksi objek secara lokal secara mandiri, tanpa ketergantungan pada server eksternal berbayar. Unit pemroses pusat ini harus dirancang terpisah dari node penangkap gambar, serta mendukung integrasi dengan beberapa unit kamera dedikasi (ESP32-CAM) secara skalabel yang dapat ditambahkan sesuai kebutuhan lahan tanpa memicu pembengkakan biaya investasi yang signifikan. Setiap unit kamera dedikasi tersebut juga dilengkapi dengan mekanisme kontrol gerak kamera (pan-tilt) secara dinamis untuk memperluas cakupan area pantau dan mengurangi jumlah titik buta pada lahan terbuka.

Permasalahan ini semakin relevan apabila dikaitkan dengan tingginya angka kriminalitas di sektor properti dan aset produksi. Berdasarkan data Pemerintah Provinsi Jawa Barat tahun 2019–2021, sebanyak 14 dari 19 kabupaten/kota tercatat mengalami kasus pencurian, dengan total 9.452 desa terdampak dalam kurun tiga tahun, seperti terlihat dalam grafik berikut [1][2].

<figure>
<img src="media/image6.png" style="width:3.14548in;height:2.34259in" />
<figcaption>Gambar 1.1.1 Grafik Kasus Pencurian Tahun 2019–2021</figcaption>
</figure>

Pencurian termasuk dalam permasalahan umum yang sering dialami dalam usaha peternakan secara khusus [3]. Pencurian dapat mempengaruhi aset biologis dan produk peternakan, seperti ayam dan telur. Selain itu, gangguan hama seperti ular, kucing, anjing liar, dan tikus juga termasuk risiko keamanan yang berkontribusi pada berkurangnya aset biologis atau produk peternakan. Tanpa adanya sistem *monitoring* untuk mendeteksi hal-hal tersebut, dampak yang timbul antara lain [3][4]:

1. **Mengurangi Output Produksi** — berkurangnya aset biologis (ayam) secara langsung menurunkan volume produk yang dihasilkan, baik telur maupun ayam potong.
2. **Mengganggu Proses Produksi** — kerusakan fasilitas akibat usaha pengambilan paksa menimbulkan biaya tambahan untuk perbaikan kandang atau alat produksi.

Berangkat dari kondisi tersebut, diperlukan solusi monitoring keamanan lahan yang murah, mandiri, dan tidak bergantung pada biaya berlangganan berkelanjutan. Kebutuhan ini semakin spesifik pada studi kasus peternakan ayam milik mitra, yang memiliki pagar utama sepanjang 35 meter dan area titik buta berbentuk "L" seluas 3×10 m dan 4×10 m. Lokasi hanya memiliki akses listrik tanpa koneksi internet kabel yang stabil, sehingga penggunaan sistem keamanan berbasis *cloud* tidak memungkinkan secara berkelanjutan.

Berdasarkan keterangan dari pemilik lahan, dibutuhkan sistem yang mampu:

- Memberikan notifikasi visual (foto) secara *real-time* melalui aplikasi Telegram saat terdeteksi penyusup.
- Memungkinkan kontrol gerak kamera jarak jauh tanpa harus berlangganan layanan *cloud*.
- Beroperasi secara mandiri dengan biaya operasional berulang mendekati nol.

Dengan demikian, inti dari masalah pada judul *"Tingginya Biaya Operasional pada Monitoring Lahan Peternakan Ayam"* adalah kebutuhan akan sistem keamanan alternatif yang hemat biaya, tidak bergantung pada layanan komputasi cloud berbayar, namun tetap responsif dan fungsional dalam mendeteksi ancaman keamanan.

Permasalahan ini juga memenuhi kriteria *complex engineering problem* pada beberapa aspek berikut: (1) penyelesaiannya memerlukan pengetahuan mendalam yang mengintegrasikan sistem tertanam, komunikasi nirkabel, sensor-aktuator, dan rekayasa perangkat lunak edge AI; (2) melibatkan isu lintas bidang yang saling bersinggungan — teknis, ekonomi, dan keamanan — bukan sekadar masalah rekayasa tunggal; dan (3) melibatkan pemangku kepentingan yang beragam, yaitu pemilik peternakan, pemilik lahan, pemilik rumah, dan penjaga lahan, yang masing-masing memiliki kebutuhan berbeda terhadap sistem yang dirancang.

## 1.2 Analisa Masalah

Masalah yang diangkat menyangkut multi-aspek, yaitu teknis, ekonomi, dan fungsionalitas-keamanan. Berikut penjelasan tiap aspek yang terpengaruh.

### 1.2.1 Aspek Teknis

- **Ketergantungan pada Komputasi Eksternal Berbayar**: Hambatan utama sistem sebelumnya adalah kebutuhan komputasi inferensi AI yang cukup berat untuk dijalankan pada perangkat tunggal berdaya rendah secara real-time, sehingga tim sebelumnya memilih menyewa layanan VPS eksternal. Solusi ini secara fungsional berhasil, tetapi menimbulkan biaya berulang yang dianggap tidak berkelanjutan oleh mitra. Oleh karena itu, arsitektur sistem yang diusulkan perlu memindahkan seluruh proses inferensi ke unit pemroses lokal (PC) yang berada pada satu kali biaya investasi (*one-time cost*), tanpa biaya langganan bulanan apa pun.

- **Efisiensi Bandwidth dan Kemandirian Jaringan**: Ketergantungan pada transmisi video langsung berkapasitas besar ke server eksternal boros bandwidth dan tidak praktis pada wilayah dengan kestabilan jaringan yang sering berfluktuasi. Oleh karena itu, arsitektur komunikasi sistem dirancang mandiri menggunakan jaringan lokal (intranet); seluruh lalu lintas data visual dari kamera ke unit pemroses diisolasi secara lokal melalui access point internal, dan koneksi internet luar hanya digunakan secara minimal untuk mengirimkan notifikasi teks/foto ringan via Telegram saat terdeteksi intrusi.

- **Jangkauan Area dan Titik Buta**: Luasnya area (pagar 35 m) dan adanya area titik buta berbentuk "L" tidak memungkinkan diawasi hanya dengan satu kamera statis. Berdasarkan observasi langsung terhadap denah lahan (Gambar 1.2.1), teridentifikasi sejumlah titik rawan dan titik buta, baik di dalam maupun di sekitar area yang akan dipantau — terutama pada area belakang (pencahayaan minim), area teras (terhalang pagar dan struktur bangunan), serta area tengah dan depan lahan yang terhalang oleh rumah kaca, pepohonan, dan kolam. Kondisi ini menegaskan kebutuhan akan kamera dengan kontrol gerak (pan-tilt) dinamis dan kemungkinan penambahan unit kamera secara skalabel, alih-alih penambahan kamera statis dalam jumlah besar yang membengkakkan biaya.

<figure>
<img src="media/image7.jpeg" style="width:2.6in;height:2.93145in" />
<figcaption>Gambar 1.2.1 Denah Lahan dan Identifikasi Titik Buta</figcaption>
</figure>

### 1.2.2 Aspek Ekonomi

- **Biaya Operasional Berkelanjutan**: Solusi kustom berbasis AI yang menggunakan komputasi cloud (seperti sistem sebelumnya) mengenakan biaya operasional bulanan untuk layanan VPS. Sebagaimana disebutkan pada sub-bab 1.1, biaya ini mencapai **[ISI: nominal, misal Rp150.000–Rp300.000/bulan]**, yang dalam jangka panjang terakumulasi menjadi beban finansial signifikan bagi mitra berskala UMKM.

- **Perbandingan Kasar terhadap Solusi Komersial**: Sebagai gambaran awal, survei singkat pada platform e-commerce per 1 Oktober 2025 terhadap tiga brand CCTV populer di Indonesia (IMOU, Ezviz, Uniview) menunjukkan rentang harga per unit antara Rp280.000 hingga Rp1.600.000, dengan rata-rata sekitar Rp760.000 per unit [10][11][12]. Angka ini belum termasuk biaya perekam (DVR/NVR), penyimpanan, maupun instalasi, dan akan dibahas lebih lanjut sebagai pembanding pada sub-bab 1.3 (Analisa Solusi yang Ada).

### 1.2.3 Aspek Fungsionalitas dan Keamanan

- **Potensi Alarm Palsu (*False Alarm*)**: Ketergantungan pada satu jenis sensor, misalnya hanya sensor gerak (PIR) [8], sangat rentan terhadap alarm palsu yang dipicu oleh hewan, pergerakan bayangan, atau perubahan cuaca. Diperlukan pendekatan deteksi berlapis (sensor mekanis + deteksi visual berbasis AI) untuk menekan tingkat kesalahan ini.

- **Keterbatasan Luas Cakupan Pengawasan (Sudut Pandang Statis)**: Perangkat kamera pengawas standar umumnya bekerja dengan sudut pandang (*field of view*) yang statis dan kaku, menyebabkan area titik buta yang luas pada lahan terbuka (lihat 1.2.1), sehingga menurunkan efisiensi fungsional alat dalam memantau area peternakan yang luas secara dinamis.

### 1.2.4 Aspek Sosial

Bagi pemilik lahan dengan mobilitas tinggi, pemantauan berkelanjutan terhadap kondisi lahan menjadi sulit dilakukan secara manual. Berdasarkan keterangan mitra, ketiadaan solusi yang mampu memberikan peringatan dini atas kondisi lahan — terlebih dalam rentang waktu yang lama tanpa pengawasan langsung — menimbulkan rasa tidak aman yang berkelanjutan bagi pemilik maupun penjaga lahan **[ISI: opsional — tambahkan 1 data/sitasi pendukung terkait dampak psikologis atau keresahan pelaku UMKM agraris akibat gangguan keamanan, jika tersedia]**.

## 1.3 Analisa Solusi yang Ada

Analisis ini mengkaji beberapa alternatif solusi pengawasan yang telah tersedia, baik yang pernah diterapkan langsung di lahan mitra maupun yang umum ditemukan di pasaran, guna memvalidasi *research gap* dari sistem yang diusulkan.

### 1.3.1 Sistem Kustom Sebelumnya (Raspberry Pi 4 + Webcam + VPS)

Sistem ini merupakan solusi yang **secara nyata pernah diimplementasikan oleh tim capstone terdahulu pada lahan mitra yang sama**, menggunakan Raspberry Pi 4 sebagai pengendali utama, webcam sebagai node kamera, dan algoritma YOLO yang dijalankan melalui layanan VPS untuk mendeteksi objek manusia. Sistem ini dioperasikan selama **[ISI: durasi]** sebelum akhirnya mitra mengajukan keberatan atas biaya langganan.

- **Kelebihan**: Modularitas pemrograman yang baik, mampu mendeteksi wujud manusia secara presisi, serta mengirimkan notifikasi peringatan langsung ke gawai pemilik lahan saat terjadi intrusi.
- **Keterbatasan**: Kendala teknis dan finansial terbesarnya adalah ketergantungan pada langganan komputasi VPS bulanan sebesar **[ISI: nominal]**, yang dinilai memberatkan mitra dalam jangka panjang. Selain itu, sistem ini menuntut bandwidth internet yang cukup besar untuk mengirim data ke VPS secara berkelanjutan, serta memiliki arah pandang kamera yang statis sehingga menyisakan titik buta yang cukup luas pada area lahan.

### 1.3.2 Sistem CCTV IP Kamera Komersial

Kamera IP nirkabel tunggal (*Smart Home IP Camera*) merupakan perangkat siap pakai yang terhubung langsung ke router Wi-Fi dan merekam data secara lokal ke kartu memori (*MicroSD*) di dalam badan kamera. Survei harga pada platform e-commerce (per 1 Oktober 2025) terhadap tiga brand populer — IMOU, Ezviz, dan Uniview — menunjukkan rentang harga satuan Rp280.000 hingga Rp1.600.000, dengan rata-rata sekitar Rp760.000 per unit untuk kelas CCTV properti pribadi, belum termasuk biaya instalasi maupun penyimpanan tambahan [10][11][12].

- **Kelebihan**: Instalasi praktis (*plug-and-play*), harga satuan relatif murah, serta kemudahan akses pemantauan jarak jauh melalui aplikasi telepon pintar.
- **Keterbatasan**: Untuk konteks peternakan, sistem ini tetap bergantung pada ketersediaan internet untuk akses jarak jauh, dan penyimpanan lokal di kartu memori membuatnya rawan terhadap pencurian fisik — apabila unit kamera dicuri, seluruh rekaman bukti turut hilang. Algoritma deteksi bawaan umumnya hanya menganalisis perubahan piksel, sehingga rawan memicu alarm palsu akibat pergerakan daun atau hewan.

### 1.3.3 Sistem CCTV Berbasis DVR (Analog/HD-TVI/AHD)

Sistem sirkuit tertutup berbasis kabel koaksial dan DVR (*Digital Video Recorder*) merupakan standar industri keamanan konvensional yang mapan, di mana unit kamera dihubungkan melalui kabel fisik menuju mesin DVR terpusat.

- **Kelebihan**: Mampu menyediakan pemantauan pasif yang andal secara kontinu (24/7) secara luring melalui monitor besar berkat antarmuka output langsung (HDMI/VGA), dengan latensi minimal karena transmisi kabel analog murni.
- **Keterbatasan**: Ketergantungan pada kabel fisik menjadi kelemahan krusial di lahan terbuka — membentangkan kabel daya dan koaksial sepanjang puluhan meter memicu pembengkakan biaya infrastruktur dan rawan terputus akibat cuaca ekstrem atau gigitan hama. Fitur deteksi analitik AI pada DVR komersial umumnya hanya tersedia pada model premium dengan harga jauh lebih tinggi, sehingga kurang realistis bagi peternak skala UMKM.

### 1.3.4 Sistem CCTV Wireless Berbasis NVR dengan AI

Solusi ini menggabungkan kamera CCTV nirkabel modern (*Wireless IP Camera*) dengan mesin pusat NVR (*Network Video Recorder*), berkomunikasi melalui jaringan Wi-Fi lokal tanpa harus terkoneksi ke internet publik.

- **Kelebihan**: Mempertahankan keandalan pemantauan luring melalui monitor HDMI dan perekaman stabil di hard disk, dipadukan dengan instalasi nirkabel yang lebih ringkas. Unit kamera kelas menengah-atas bahkan dibekali cip *Edge AI Human Detection* internal untuk mengenali postur manusia secara lokal (*on-device*).
- **Keterbatasan**: Ekosistem tertutup (*vendor lock-in*) menjadi kelemahan fundamental — algoritma AI bawaan tidak dapat dilatih ulang (*retrain*) meskipun sering memicu alarm palsu terhadap karakteristik pohon atau hewan ternak lokal, dan sistem sulit diintegrasikan dengan sensor mekanis eksternal tambahan.
- **Estimasi Biaya**: Untuk konfigurasi kelas menengah (1 unit Wireless NVR 10-channel, 4 unit kamera wireless pendukung AI, dan hard disk surveillance 2TB), estimasi biaya investasi berada di rentang Rp4,8 juta hingga Rp5,2 juta di luar router dan monitor — nominal yang masih cukup membebani permodalan UMKM skala desa.

### Ringkasan Perbandingan

| Solusi | Biaya Berulang | Ketergantungan Internet | Fleksibilitas AI | Cakupan Area |
|---|---|---|---|---|
| Sistem lama (RPi+Webcam+VPS) | Tinggi (langganan VPS) | Tinggi | Tinggi (custom) | Rendah (statis) |
| IP Kamera Komersial | Rendah–sedang | Tinggi (akses jarak jauh) | Rendah | Rendah (statis) |
| DVR Analog | Rendah | Rendah | Sangat rendah/tidak ada | Rendah (statis) |
| Wireless NVR+AI | Rendah | Rendah | Rendah (*locked*) | Rendah (statis) |
| **Sistem diusulkan (ESP32-CAM+PC+YOLO)** | **Sangat rendah (one-time cost)** | **Rendah (intranet lokal)** | **Tinggi (custom, retrainable)** | **Tinggi (pan-tilt, skalabel)** |

## 1.4 Kesimpulan

Berdasarkan analisis yang telah dipaparkan, pengangkatan masalah ini sebagai proyek Capstone Design memiliki urgensi, relevansi, dan nilai kemanfaatan yang tinggi, dirangkum dalam beberapa poin berikut:

1. **Urgensi Pengamanan Lahan Berbiaya Efisien**: Sistem yang sebelumnya digunakan mitra terbukti fungsional secara teknis, namun menimbulkan beban biaya berlangganan VPS bulanan yang pada akhirnya ditolak oleh mitra karena dianggap tidak berkelanjutan bagi skala usaha UMKM.

2. **Kompleksitas Rancangan Multidimensional**: Solusi yang dirancang harus mengintegrasikan aspek perangkat keras dan perangkat lunak secara seimbang — komputasi lokal tanpa biaya berlangganan, arsitektur terpisah dengan unit kamera dedikasi yang skalabel, kontrol gerak kamera dinamis, hingga optimalisasi komunikasi data lokal (intranet) nirkabel.

3. **Kesenjangan Kritis Solusi yang Tersedia**: Sistem CCTV wireless NVR berfitur AI bersifat kaku akibat *vendor lock-in* — algoritma deteksinya tidak dapat dilatih ulang saat sering memicu alarm palsu, dan sulit diintegrasikan dengan sensor keamanan fisik tambahan. Sistem DVR analog terkendala inefisiensi tarikan kabel di lahan terbuka. IP Kamera komersial rawan kehilangan bukti rekaman akibat pencurian fisik kartu memori. Sementara itu, sistem kustom yang pernah diterapkan langsung pada lahan mitra (RPi+Webcam+VPS) justru menjadi bukti paling konkret bahwa pendekatan AI custom secara teknis layak, namun **model biaya berbasis langganan VPS-lah** yang menjadi akar penolakan mitra — bukan kemampuan deteksinya.

4. **Penyediaan Alternatif Sistem Berdaya Guna Tinggi**: Kehadiran sistem pengawasan yang mempertahankan fleksibilitas deteksi AI custom sebagaimana sistem sebelumnya, namun memindahkan seluruh biaya komputasi dari model langganan bulanan menjadi investasi satu kali (*one-time cost*) berbasis PC lokal, menjadi solusi krusial bagi pelaku usaha UMKM agraris untuk menekan biaya operasional bulanan mendekati nol tanpa mengorbankan akurasi maupun fleksibilitas deteksi.
