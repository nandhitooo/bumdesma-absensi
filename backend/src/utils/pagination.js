/**
 * Normalisasi query pagination.
 *
 * Sebelumnya setiap endpoint melakukan `Number(page) - 1 * Number(limit)`
 * mentah dari req.query. Akibatnya `?limit=999999` (atau `?page=abc`,
 * `?page=-5`) langsung dipakai sebagai limit/offset SQL — satu request bisa
 * menarik seluruh tabel ke memori dan memblokir event loop saat di-JSON-kan.
 *
 * Helper ini memaksa: page >= 1, 1 <= limit <= maxLimit, dan selalu
 * mengembalikan angka (bukan NaN) sehingga offset tidak pernah NaN.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = options.maxLimit || MAX_LIMIT;

  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, maxLimit)
      : defaultLimit;

  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { parsePagination, DEFAULT_LIMIT, MAX_LIMIT };
