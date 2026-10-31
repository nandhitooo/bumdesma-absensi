// Helper untuk menstandarkan bentuk response JSON di seluruh endpoint

function success(res, { message = 'Berhasil', data = null, meta = null, statusCode = 200 } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function failure(res, { message = 'Terjadi kesalahan', statusCode = 400, errors = null } = {}) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { success, failure };
