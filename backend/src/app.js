require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();
// Di belakang reverse proxy (nginx pada setup Docker) Express perlu tahu
// berapa hop proxy yang dipercaya. Tanpa ini express-rate-limit melempar
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR dan mencatat IP proxy, bukan IP klien.
// Kosong = tidak ada proxy (development / backend diakses langsung).
if (process.env.TRUST_PROXY) {
  const trustProxy = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

app.use(helmet({ crossOriginResourcePolicy: false }));

// --- CORS -------------------------------------------------------------------
// Daftar origin diambil dari CORS_ORIGINS (dipisah koma). Kalau kosong, semua
// origin diizinkan supaya dev lokal tidak ribet — TAPI di production itu
// berarti situs mana pun boleh memanggil API ini, jadi kita peringatkan.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  console.warn(
    '[security] CORS_ORIGINS belum diisi — semua origin diizinkan. Isi daftar ' +
      'origin produksi, mis. CORS_ORIGINS=https://admin.contoh.id'
  );
}

app.use(
  cors(
    allowedOrigins.length === 0
      ? {}
      : {
          origin: (origin, callback) => {
            // Request tanpa Origin (curl, app mobile native) tetap diizinkan;
            // yang dibatasi hanya browser dari origin lain.
            if (!origin || allowedOrigins.includes(origin)) {
              return callback(null, true);
            }
            const err = new Error('Origin tidak diizinkan oleh CORS.');
            err.statusCode = 403;
            return callback(err);
          },
        }
  )
);
// Gzip response JSON (laporan/backup bisa besar).
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit berlapis:
//   1. Limiter global (di bawah) sebagai jaring pengaman terhadap scraping /
//      brute-force endpoint non-auth.
//   2. Limiter per-route di src/routes/index.js (ketat khusus login /
//      forgot-password, longgar untuk endpoint auth lainnya).
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.',
  },
});

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// File statis: gambar QR Code & lampiran surat izin/cuti
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => res.json({ success: true, message: 'API is healthy' }));

app.use('/api', generalApiLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
