import { createContext, useContext } from "react";

// Context dan hook dipisah dari file provider supaya ModalContext.jsx hanya
// mengekspor komponen (aturan react-refresh/only-export-components).
export const ModalContext = createContext(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal harus dipakai di dalam <ModalProvider>");
  return ctx;
}
