# APERTIO.

APERTIO adalah prototipe aplikasi transparansi pembangunan daerah Kota Salatiga. Warga dapat melihat peta dan progres proyek, sementara admin dapat mengelola proyek serta memantau data publik dan laporan warga.

## Tech stack

- Next.js 15
- React 19
- TypeScript
- Leaflet dan React Leaflet
- OpenStreetMap
- Lucide React

## Cara menjalankan

```bash
git clone https://github.com/devbycpw/jujur.git
cd jujur
npm install
npm run dev
```

Buka `http://localhost:3000` di browser. Ganti `<URL-repository>` dengan URL repository project.

## Progress saat ini

- Peta interaktif dengan marker proyek dan pilihan tampilan standar, monokrom, serta gelap.
- Detail proyek dengan progres, anggaran, dokumentasi foto, diskusi, dan laporan lapangan.
- Login demo untuk role warga dan admin.
- Halaman admin untuk daftar proyek, edit proyek, data publik, statistik, dan laporan warga.
- Data masih berupa data demo lokal; backend dan database belum diimplementasikan.
