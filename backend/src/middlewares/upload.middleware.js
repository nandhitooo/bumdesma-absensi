const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'surat-izin');
// Lampiran disimpan per kategori (izin/sakit/cuti). Multer menulis dulu ke
// folder staging karena field `jenis` belum tentu sudah ter-parse saat file
// sedang dialirkan (urutan part multipart ditentukan client); controller
// memindahkan file setelah validasinya lolos.
const STAGING_DIR = path.join(UPLOAD_DIR, '_tmp');
for (const dir of [UPLOAD_DIR, STAGING_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// NB: mobile's file_picker (leave_form_screen.dart) offers .pdf and .docx,
// and the README explicitly documents ".pdf/.docx" as supported lampiran.
// The mime list below was missing both docx and the legacy .doc type, which
// caused every Word-document upload to be rejected by fileFilter below
// (silently failing the whole "Ajukan Izin/Cuti" submission on mobile).
// Pemetaan MIME -> ekstensi kanonik. Ekstensi file yang disimpan SELALU diambil
// dari sini, tidak pernah dari file.originalname: nama file datang dari client,
// jadi penyerang bisa memakai ekstensi apa pun (mis. .html) sementara
// Content-Type multipart-nya dipalsukan menjadi mime yang diizinkan. Tanpa
// pemetaan ini, file .html tersimpan apa adanya dan /uploads menyajikannya
// kembali sebagai text/html (CWE-434 / stored HTML injection).
const MIME_EXTENSION = Object.freeze({
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/jpg': '.jpg',
  'application/msword': '.doc', // .doc (legacy)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
});
const ALLOWED_MIME = Object.keys(MIME_EXTENSION);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, STAGING_DIR),
  filename: (req, file, cb) => {
    const ext = MIME_EXTENSION[file.mimetype] || '';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error('Format file tidak didukung. Gunakan PDF, DOCX, JPG, atau PNG.'));
  }
  cb(null, true);
};

const uploadSuratIzin = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

/**
 * Pindahkan lampiran dari folder staging ke subfolder kategori
 * (`uploads/surat-izin/<kategori>/<file>`) dan kembalikan path relatifnya
 * (tanpa prefix /uploads) untuk disimpan di `leaves.file_lampiran`.
 */
function pindahkanKeKategori(file, kategori) {
  if (!file) return null;
  if (!/^[a-z]+$/.test(String(kategori))) {
    throw new Error(`Kategori lampiran tidak valid: ${kategori}`);
  }
  const targetDir = path.join(UPLOAD_DIR, kategori);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, file.filename);
  if (path.resolve(file.path) !== path.resolve(targetPath)) {
    fs.renameSync(file.path, targetPath);
  }
  // Pembersihan file saat request gagal (leave.controller) memakai file.path,
  // jadi metadata ini harus ikut diperbarui ke lokasi yang sekarang.
  file.destination = targetDir;
  file.path = targetPath;
  return `surat-izin/${kategori}/${file.filename}`;
}

module.exports = { uploadSuratIzin, UPLOAD_DIR, STAGING_DIR, pindahkanKeKategori };
