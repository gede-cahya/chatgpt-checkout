# ChatGPT Checkout Generator

Sebuah tool eksperimental untuk men-generate link checkout *ChatGPT Plus / Pro* menggunakan data sesi dari OpenAI. Tool ini mampu mengecek promo *1-month free trial* dan men-generate link pembayaran secara otomatis menggunakan backend server region Jepang atau melalui Proxy HTTP/SOCKS5.

## Fitur Utama

- **⚡ Auto Generate Mode**: Memanfaatkan external API Vercel (region Jepang `hnd1`) untuk bypass verifikasi lokasi secara instan tanpa ribet setting proxy.
- **🔧 Manual Proxy Mode**: Generate link pembayaran murni dari komputer lokal (localhost) dengan routing koneksi menggunakan HTTP/SOCKS5 proxy residensial kustom Anda.
- **🏷️ Promo Checker**: Mengecek kelayakan (eligibility) akun untuk kampanye promo gratis bulan pertama (`plus-1-month-free`).
- **💰 Currency Selector**: Paksa harga untuk tampil dalam IDR (Indonesia) atau JPY (Jepang).
- **📋 Account Info Inspector**: Menampilkan informasi email, nama, tipe plan, dan status verifikasi ponsel dari akun OpenAI.

## Prasyarat

Pastikan komputer Anda sudah terinstall:
- [Node.js](https://nodejs.org/) (Versi 18 ke atas)
- Npm atau Yarn atau Bun

## Cara Install & Menjalankan

1. **Clone repository ini** (atau download/extract source codenya):
   ```bash
   git clone https://github.com/gede-cahya/chatgpt-checkout.git
   cd chatgpt-checkout
   ```
   *(Sesuaikan link repository dengan akun GitHub Anda)*

2. **Install dependensi**:
   ```bash
   npm install
   ```
   Dependensi yang digunakan: `express`, `node-fetch`, `https-proxy-agent`, dan `socks-proxy-agent`.

3. **Jalankan Server Lokal**:
   ```bash
   node server.js
   ```

4. **Akses UI di Browser**:
   Buka browser Anda dan kunjungi: **http://localhost:3456**

## Cara Penggunaan (Step-by-step)

1. Buka tab baru dan login ke akun ChatGPT Anda di `chatgpt.com`.
2. Setelah berhasil login, buka URL ini di tab yang sama: **`https://chatgpt.com/api/auth/session`**
3. Anda akan melihat banyak teks JSON (berisi `"accessToken"`, `"user"`, dll). Blok seluruh teks tersebut, klik kanan, lalu **Copy** (`Ctrl+C`).
4. Buka kembali halaman Checkout Generator di `http://localhost:3456`.
5. Tempel (**Paste** / `Ctrl+V`) teks JSON tersebut ke dalam kotak teks (textarea).
6. Pilih mode yang diinginkan:
   - **Auto Generate (Recommended)**: langsung klik tombol Generate.
   - **Manual Proxy**: Masukkan URL proxy Anda pada menu dropdown proxy sebelum klik Generate.
7. Klik **Generate Checkout Link**.
8. Jika akun Anda memenuhi syarat (belum pernah subscribe), link checkout akan muncul di bagian bawah halaman. Anda tinggal mengklik tombol **Open** untuk melanjutkan proses pembayaran/klaim trial.

## Catatan Penting
- **Keamanan Token**: Jangan pernah membagikan isi `https://chatgpt.com/api/auth/session` kepada orang lain. Token ini memberikan akses penuh ke akun ChatGPT Anda. Tool ini hanya berjalan di mesin lokal Anda atau menghubungi API aman yang ditujukan untuk bypass geo-restriction promo.

## Disclaimer
Proyek ini dibuat untuk tujuan edukasi dan eksperimental. Pengguna bertanggung jawab sepenuhnya terhadap penggunaan tool ini.
