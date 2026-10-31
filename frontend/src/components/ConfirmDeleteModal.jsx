import { useState } from "react";

export default function ConfirmDeleteModal({
  title = "Konfirmasi Hapus",
  message,
  confirmText,
  onCancel,
  onConfirm,
  loading = false,
}) {
  const [typed, setTyped] = useState("");
  const matched = typed.trim() === confirmText;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-2 mb-2 text-red-600">
          <i className="fa-solid fa-triangle-exclamation text-xl"></i>
          <h2 className="text-lg font-extrabold text-gray-800">{title}</h2>
        </div>
        <p className="text-sm text-gray-600 font-semibold mb-4">{message}</p>
        <p className="text-xs text-gray-500 font-semibold mb-1.5">
          Ketik{" "}
          <span className="font-extrabold text-gray-800">"{confirmText}"</span>{" "}
          untuk konfirmasi:
        </p>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matched && !loading) onConfirm();
          }}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400 mb-4"
          placeholder={confirmText}
          autoComplete="off"
        />
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={!matched || loading}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Menghapus..." : "Hapus Permanen"}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-gray-600 font-bold text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
