// Komponen pagination reusable untuk tabel/kartu yang datanya diambil dari
// backend dengan pagination server-side (backend mengirim `meta` berisi
// total, page, limit - lihat utils/response.js di backend).
export default function Pagination({ page, limit, total, onPageChange }) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  // Cegah crash ketika jumlah data menyusut (mis. setelah hapus di halaman
  // terakhir) dan halaman aktif jadi melebihi total halaman.
  if (page > totalPages && onPageChange) {
    // Dipanggil tanpa render bersih dulu supaya aman dipanggil saat render.
    // setState dalam render dilarang React, jadi pakai microtask.
    Promise.resolve().then(() => onPageChange(totalPages));
  }

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const getPages = () => {
    const pages = [];
    const maxButtons = 5;
    let from = Math.max(1, page - Math.floor(maxButtons / 2));
    const to = Math.min(totalPages, from + maxButtons - 1);
    from = Math.max(1, to - maxButtons + 1);
    for (let i = from; i <= to; i++) pages.push(i);
    return pages;
  };

  const btnBase =
    "min-w-9 h-9 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-2">
      <p className="text-xs font-bold text-gray-500">
        Menampilkan {start}–{end} dari {total} data
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`${btnBase} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        {getPages().map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${btnBase} ${
              p === page
                ? "text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
            style={p === page ? { backgroundColor: "#1a7a1a" } : undefined}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={`${btnBase} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
}
