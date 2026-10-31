import { createContext, useCallback, useContext, useState } from "react";

const ModalContext = createContext(null);

// Menampilkan popup modal (bukan browser alert()/confirm() bawaan) di atas
// seluruh halaman. alert() mengembalikan Promise<void> yang selesai saat
// tombol OK ditekan; confirm() mengembalikan Promise<boolean> (true jika
// pengguna menekan tombol konfirmasi, false jika Batal/menutup modal).
export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const alert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setModal({
        type: "alert",
        title: options.title || "Informasi",
        message,
        confirmLabel: options.confirmLabel || "OK",
        danger: options.danger || false,
        resolve,
      });
    });
  }, []);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setModal({
        type: "confirm",
        title: options.title || "Konfirmasi",
        message,
        confirmLabel: options.confirmLabel || "Ya",
        cancelLabel: options.cancelLabel || "Batal",
        danger: options.danger ?? false,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    modal?.resolve?.(true);
    setModal(null);
  };

  const handleCancel = () => {
    modal?.resolve?.(false);
    setModal(null);
  };

  return (
    <ModalContext.Provider value={{ alert, confirm }}>
      {children}
      {modal && (
        <AppModal
          type={modal.type}
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          cancelLabel={modal.cancelLabel}
          danger={modal.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ModalContext.Provider>
  );
}

function AppModal({
  type,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100] px-4"
      onClick={type === "alert" ? onConfirm : undefined}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <i
            className={`fa-solid text-xl ${
              danger
                ? "fa-triangle-exclamation text-red-600"
                : "fa-circle-info text-green-700"
            }`}
          ></i>
          <h2 className="text-lg font-extrabold text-gray-800">{title}</h2>
        </div>
        <p className="text-sm text-gray-600 font-semibold mb-6 whitespace-pre-line">
          {message}
        </p>
        <div className="flex gap-3">
          {type === "confirm" && (
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-gray-600 font-bold text-sm bg-gray-100 hover:bg-gray-200"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            autoFocus
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all ${
              danger ? "bg-red-500 hover:bg-red-600" : ""
            }`}
            style={!danger ? { backgroundColor: "#1a7a1a" } : {}}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal harus dipakai di dalam <ModalProvider>");
  return ctx;
}
