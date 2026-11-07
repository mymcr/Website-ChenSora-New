# Pengelolaan konten ChenSora

Dashboard: `/admin/content.html` (juga tersedia dari menu **Kelola Konten Website** pada dashboard lama).

Empat kategori dapat ditambah, diedit, diurutkan, dihapus, atau disembunyikan sebagai draft: katalog produk, expert medis, merchant, dan Latest News. Gambar menerima JPEG/PNG/WebP hingga 5 MB. Artikel memakai teks biasa, bukan HTML, dan mendukung sumber, URL, tanggal publikasi, serta kredit gambar.

Tombol **Selengkapnya** membuka halaman `news.html?id=ID_ARTIKEL`. Gambar utama memakai rasio 1:1 yang responsif. Isi artikel dapat memuat tautan `[teks tautan](https://alamat.com)` atau URL HTTP(S) langsung. Pisahkan paragraf dengan baris kosong. HTML tidak dijalankan. Halaman artikel menampilkan daftar berita terbaru dan pencarian; artikel draft tidak ditampilkan.

## Server

Gunakan PHP 8.0+ dengan session. Login produksi memakai akun pada tabel `login` yang sudah digunakan `api.php` (MySQL/mysqli diperlukan). Dashboard harus disajikan dari origin yang sama dengan API. Login yang berhasil membuat sesi server; `sessionStorage` saja tidak memberi akses ke API konten.

Sebagai alternatif konfigurasi server, tetapkan `CONTENT_ADMIN_EMAIL` dan `CONTENT_ADMIN_PASSWORD_HASH` (hasil `password_hash`, jangan password polos). Tidak ada akun atau password admin bawaan. Variabel ini tidak perlu diisi bila menggunakan login database yang sudah ada.

Preview PHP lokal tersedia di `http://localhost:8080/`. Runtime portable lokal berada di folder `scratch/php-runtime` dan tidak ikut Git. Perintah untuk menjalankan ulang dari root proyek:

```powershell
& './scratch/php-runtime/php.exe' -S 127.0.0.1:8080 scratch/php-router.php
```

Login database produksi tidak dapat diuji tanpa koneksi database yang sesuai. Preview statis port 8000 tetap menampilkan konten awal tetapi tidak menjalankan API PHP.

## Penyimpanan dan deployment

- `asset/content-seed.json`: konten awal yang telah ditinjau; dipakai ketika belum ada data tersimpan dan untuk preview statis.
- `content-data/store.json`: dibuat saat penyimpanan pertama. Seluruh konten berikutnya disimpan di sini dengan lock, penulisan atomik, dan pemeriksaan versi untuk mencegah data tertimpa.
- `uploads/content/`: gambar unggahan dengan nama acak; SVG dan file executable tidak diterima.
- Kedua direktori harus writable oleh PHP. Jangan mengganti `store.json` atau direktori unggahan saat deployment. Keduanya perlu backup bersama.
- Apache membaca `.htaccess` untuk menolak akses langsung ke `content-data` dan file executable pada unggahan. Nginx harus diberi aturan ekuivalen. Router preview lokal menerapkan pembatasan direktori yang sama.
- `CONTENT_DATA_DIR` opsional mengarahkan penyimpanan ke direktori privat lain yang sudah ada; ini juga dipakai untuk pengujian terisolasi.
- Endpoint publik `GET content-api.php` hanya mengembalikan konten yang dipublikasikan. `GET ?admin=1` memerlukan sesi admin dan mengembalikan token CSRF serta versi. Semua mutasi memakai POST, sesi, token CSRF, dan versi terkini.
- Jika API gagal, halaman publik menampilkan konten awal dari seed. Perbarui seed bila konten awal perlu diganti permanen; draft admin tidak pernah dimasukkan ke seed secara otomatis.

## Sumber berita awal

Berita awal adalah ringkasan asli singkat, bukan salinan artikel. Tanggal mengikuti publikasi sumber (2024/2025), bukan tanggal hari ini. Foto aset ChenSora diberi label ilustrasi, bukan diklaim sebagai foto liputan.

- RRI, 31 Agustus 2024: https://rri.co.id/surabaya/bisnis/943986/chensora-soft-launching-kantor-baru
- RRI, 1 Juli 2025: https://rri.co.id/surabaya/bisnis/1671711/kakkoi-detox-usus-sekaligus-perawatan-kulit-dari-chensora
- Kabarhit, 28 Juli 2025: https://kabarhit.com/news-28704-kakkoi-jadi-primadona-baru-detox-harian-aman-dikonsumsi-dan-bersertifikat-halal

## Validasi

`scratch/content-api.test.cjs` menguji server terisolasi port 8081 dengan kredensial uji sementara dan `CONTENT_DATA_DIR` terpisah. Cakupan: autentikasi, CSRF, CRUD empat kategori, draft/publikasi, konflik versi, validasi URL/tanggal, penolakan upload palsu, upload gambar, logout, dan proteksi direktori. Jangan mengaktifkan kredensial pengujian pada preview utama atau hosting produksi.

## Konfigurasi database hosting

Kredensial database tidak disimpan di source code. Sebelum memakai dashboard database lama di hosting, tetapkan `DB_HOST`, `DB_USER`, `DB_PASSWORD`, dan `DB_NAME` melalui konfigurasi environment hosting/PHP-FPM. Dashboard konten tetap dapat menggunakan `CONTENT_ADMIN_EMAIL` dan `CONTENT_ADMIN_PASSWORD_HASH` tanpa MySQL. Jangan menaruh password atau file konfigurasi rahasia di Git.

## Hero Section

Tab **Hero Section** mengelola tiap slide: headline utama (`name`), baris kedua berwarna biru (`accent`, opsional), deskripsi, gambar, urutan, dan status publikasi. Data tersimpan lama otomatis dilengkapi dengan slide awal bila kategori Hero belum ada. Jika semua slide dijadikan draft, bagian Hero disembunyikan. Keterangan dan URL merchant kini bersifat informatif; kartu merchant tidak membuka tautan.

## Gambar produk dua sisi

Katalog mendukung `image` (gambar utama) dan `image_back` (gambar kedua). Editor produk menyediakan kolom path/URL untuk gambar belakang. Arahkan kursor pada gambar produk untuk melihat sisi belakang; keluar dari area gambar untuk kembali. Pada perangkat sentuh, ketuk gambar untuk membalik kartu. Enter/Spasi tetap didukung untuk navigasi keyboard. Popup gambar tetap digunakan untuk berita, bukan untuk produk. Aset di `asset/produk/` memakai ekstensi `.WEBP` sesuai nama file aslinya, termasuk kata `behind` untuk sisi kedua.
