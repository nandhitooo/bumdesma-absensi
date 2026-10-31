const { failure } = require('../utils/response');

function notFoundHandler(req, res) {
  return failure(res, {
    statusCode: 404,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  // Error validasi bawaan Sequelize
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return failure(res, {
      statusCode: 422,
      message: 'Data tidak valid.',
      errors: err.errors?.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'MulterError') {
    return failure(res, { statusCode: 400, message: `Upload gagal: ${err.message}` });
  }

  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;

  return failure(res, {
    statusCode,
    // Pesan asli error server hanya boleh sampai ke client di luar production:
    // err.message sering memuat detail internal (query SQL, nama kolom, path
    // file, pesan driver database) yang berguna untuk penyerang. Detail
    // lengkapnya tetap tercatat penuh di log server baris di atas.
    message:
      isServerError && process.env.NODE_ENV === 'production'
        ? 'Terjadi kesalahan pada server.'
        : err.message || 'Terjadi kesalahan pada server.',
  });
}

module.exports = { notFoundHandler, errorHandler };
