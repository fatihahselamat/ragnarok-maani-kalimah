# Pengembaraan Maani Kalimah

RPG 3D multiplayer (PWA) untuk belajar Maani Kalimah Tafsir Tingkatan 4. Mula sebagai Novice, berjalan di dunia terbuka, langgar Jeli yang membawa kalimah, jawab maknanya.

## Cara jalan secara lokal
Perlu pelayan statik (modul ES tidak boleh dibuka terus dari fail):

    python3 -m http.server 8080      # kemudian buka http://localhost:8080

## Deploy
- **Netlify**: sambung repo GitHub, tiada arahan build, publish directory `.` (sudah ada `netlify.toml`).
- **GitHub Pages**: Settings → Pages → Deploy from branch → `main` / root. Semua laluan relatif, jadi boleh di subfolder.
- **Google Sites**: Insert → Embed → masukkan URL Netlify/Pages sebagai halaman. Game tetap dihos di Netlify/Pages.

Selepas ubah apa-apa fail, jalankan `python3 tools/stamp.py` supaya service worker kemas kini cache.

## Storan
Semua progress (akaun nama pengguna/emel, watak, level, kalimah dikuasai) dalam `localStorage` peranti. Tiada pelayan, tiada database.
- Tukar peranti: Menu → Simpan ke fail, kemudian di peranti baharu skrin log masuk → Muat fail progress.
- Cikgu boleh kumpul fail `.json` pelajar untuk semak progress.

## Multiplayer
Tanpa konfigurasi, game berjalan solo (pemain lain hanya nampak antara tab pelayar yang sama, untuk ujian).
Untuk multiplayer sebenar, buat projek Supabase (percuma), kemudian isi `js/config.js`:

    SUPABASE_URL: 'https://xxxx.supabase.co',
    SUPABASE_ANON_KEY: 'anon public key'

Hanya Realtime Broadcast digunakan (tiada jadual). Setiap zon satu saluran, kedudukan dihantar kira-kira 3 kali sesaat bila bergerak.

## Tambah / ubah kalimah
Edit `js/data.js`. Format: `[zon, surah, kalimah, makna]`.

## Kawalan
- Desktop: WASD / anak panah, klik tanah untuk berjalan, klik Jeli untuk kejar, E / Space untuk bercakap, seret butang kanan tetikus atau Q-E (butang ⟲ ⟳) untuk putar kamera, roda tetikus untuk zum.
- Telefon: joystick kiri, sentuh tanah untuk berjalan, seret untuk putar kamera.
