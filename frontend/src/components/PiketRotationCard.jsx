import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../lib/api";
import { useModal } from "../context/ModalContext";
import SaturdayPicker from "./SaturdayPicker";

// Sabtu terdekat (hari ini kalau kebetulan Sabtu). Dipakai sebagai tampilan
// default ketika siklus giliran belum punya tanggal mulai tersimpan.
// Backend memakai default yang sama (utils/piketRotation.js:
// firstSaturdayOnOrAfter(today)), jadi nilai yang ditampilkan akurat — sekaligus
// mencegah SaturdayPicker menerima undefined (akan menjadi "Invalid Date").
function defaultSaturday() {
  const d = new Date();
  const diff = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Card "Giliran Piket (Otomatis)".
//
// Admin mengatur daftar pegawai berurut + berapa orang per Sabtu + berapa pekan
// ke depan. Backend (utils/piketRotation.js) memutar daftar itu secara melingkar
// tiap Sabtu dan menyimpan jadwalnya otomatis, lalu mengirim notifikasi.
//
// `canEdit` = false untuk Pimpinan: hanya melihat konfigurasi & pratinjau.
export default function PiketRotationCard({ canEdit = false }) {
  const { alert, confirm } = useModal();

  const [state, setState] = useState(null);
  const [pegawaiList, setPegawaiList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({ enabled: false, start: "", perSabtu: 1, weeksAhead: 4 });
  const [draftMembers, setDraftMembers] = useState([]);
  const [pickUser, setPickUser] = useState("");

  const applyState = (data) => {
    setState(data);
    setForm({
      enabled: !!data.enabled,
      start: data.start || defaultSaturday(),
      perSabtu: data.perSabtu ?? 1,
      weeksAhead: data.weeksAhead ?? 4,
    });
    setDraftMembers(
      (data.members || []).map((m) => ({
        id: m.user_id,
        name: m.user?.name ?? m.name ?? m.user_id,
        nip: m.user?.nip ?? m.nip ?? null,
      })),
    );
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [rotationRes, pegawaiRes] = await Promise.all([
        api.get("/piket/rotation"),
        canEdit
          ? api.get("/users", { params: { role: "pegawai", limit: 100 } })
          : null,
      ]);
      applyState(rotationRes.data.data);
      if (pegawaiRes) setPegawaiList(pegawaiRes.data.data);
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal memuat pengaturan giliran piket."), {
        title: "Gagal Memuat Data",
        danger: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Microtask: setState tidak boleh jalan sinkron di badan effect
    // (rule react-hooks/set-state-in-effect, sama seperti Piket.jsx).
    Promise.resolve().then(loadData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Daftar anggota giliran (urutan array = urutan giliran) ---
  const addMember = () => {
    if (!pickUser) return;
    if (draftMembers.some((m) => m.id === pickUser)) {
      setPickUser("");
      return;
    }
    const p = pegawaiList.find((u) => u.id === pickUser);
    if (!p) return;
    setDraftMembers([...draftMembers, { id: p.id, name: p.name, nip: p.nip ?? null }]);
    setPickUser("");
  };

  const moveMember = (index, delta) => {
    const next = [...draftMembers];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraftMembers(next);
  };

  const removeMember = (id) => setDraftMembers(draftMembers.filter((m) => m.id !== id));

  const handleSaveConfig = async () => {
    if (savingConfig) return;
    setSavingConfig(true);
    try {
      await api.put("/piket/rotation", {
        enabled: form.enabled,
        start: form.start || "",
        perSabtu: Number(form.perSabtu),
        weeksAhead: Number(form.weeksAhead),
      });
      await loadData();
      await alert("Pengaturan giliran piket disimpan.", { title: "Berhasil" });
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menyimpan pengaturan giliran."), {
        title: "Gagal Menyimpan",
        danger: true,
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveMembers = async () => {
    if (savingMembers) return;
    setSavingMembers(true);
    try {
      await api.put("/piket/rotation/members", {
        userIds: draftMembers.map((m) => m.id),
      });
      await loadData();
      await alert(`${draftMembers.length} pegawai tersimpan di daftar giliran.`, {
        title: "Berhasil",
      });
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal menyimpan daftar giliran."), {
        title: "Gagal Menyimpan",
        danger: true,
      });
    } finally {
      setSavingMembers(false);
    }
  };

  const handleGenerate = async () => {
    if (generating) return;
    const confirmed = await confirm(
      `Buat jadwal giliran piket untuk ${form.weeksAhead} pekan ke depan?\n\n` +
        "Jadwal yang sudah ada (termasuk assign manual) tidak akan tertimpa, " +
        "dan notifikasi otomatis dikirim ke pegawai yang baru terjadwal.",
      { title: "Generate Jadwal Giliran", confirmLabel: "Generate" },
    );
    if (!confirmed) return;
    setGenerating(true);
    try {
      const res = await api.post("/piket/rotation/generate", {});
      await loadData();
      await alert(res.data.message || "Jadwal giliran dibuat.", {
        title: "Berhasil",
      });
    } catch (err) {
      await alert(getErrorMessage(err, "Gagal membuat jadwal giliran."), {
        title: "Gagal Generate",
        danger: true,
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-sm font-semibold text-gray-500 mb-5">
        Memuat pengaturan giliran...
      </div>
    );
  }

  const plan = state?.plan || [];
  const perSabtu = Math.max(1, Number(form.perSabtu) || 1);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-gray-700 font-extrabold">
          <i className="fa-solid fa-arrows-rotate text-green-700"></i> Giliran
          Piket (Otomatis)
          <span
            className={`ml-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
              state?.enabled ? "text-green-700 bg-green-100" : "text-gray-500 bg-gray-100"
            }`}
          >
            {state?.enabled ? "Aktif" : "Nonaktif"}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-2 hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "#1a7a1a" }}
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            {generating ? "Membuat..." : "Generate Sekarang"}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 font-semibold mt-1 mb-4">
        Pegawai pada daftar ini bergiliran otomatis tiap Sabtu sesuai urutan.
        Kalau aktif, server mengisi jadwal beberapa pekan ke depan sendiri dan
        mengirim notifikasi ke pegawai yang baru terjadwal.
      </p>

      {/* Pengaturan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
            Pegawai per Sabtu
          </div>
          <input
            type="number"
            min="1"
            max="20"
            value={form.perSabtu}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, perSabtu: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50"
          />
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
            Buat berapa pekan ke depan
          </div>
          <input
            type="number"
            min="1"
            max="52"
            value={form.weeksAhead}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, weeksAhead: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50"
          />
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
            Sabtu mulai siklus
          </div>
          {canEdit ? (
            <SaturdayPicker
              value={form.start}
              onChange={(v) => setForm({ ...form, start: v })}
            />
          ) : (
            <div className="px-3 py-2 text-sm font-semibold text-gray-700">
              {form.start || "-"}
            </div>
          )}
          {!state?.start && (
            <div className="text-[10px] font-semibold text-gray-400 mt-1">
              Default: Sabtu terdekat
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 accent-green-700"
            />
            Aktifkan giliran otomatis
          </label>
          <button
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="px-4 py-2 rounded-xl text-gray-700 font-bold text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
          >
            {savingConfig ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      )}

      {/* Daftar anggota giliran */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-extrabold text-gray-600 mb-2">
          Daftar Giliran ({draftMembers.length} pegawai)
          {draftMembers.length > 0 && (
            <span className="font-semibold text-gray-400">
              {" "}
              — tiap Sabtu diambil {Math.min(perSabtu, draftMembers.length)} orang
              berurutan
            </span>
          )}
        </div>

        {draftMembers.length === 0 ? (
          <p className="text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-3">
            Belum ada pegawai di daftar giliran.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {draftMembers.map((m, i) => (
              <li
                key={m.id}
                className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
              >
                <span className="w-6 h-6 shrink-0 rounded-lg bg-green-100 text-green-800 text-[11px] font-extrabold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800 truncate">
                    {m.name}
                  </div>
                  {m.nip && (
                    <div className="text-[11px] font-semibold text-gray-400">
                      {m.nip}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveMember(i, -1)}
                      disabled={i === 0}
                      title="Naikkan urutan"
                      className="w-7 h-7 rounded-lg text-gray-500 bg-white border border-gray-200 hover:text-green-700 disabled:opacity-40"
                    >
                      <i className="fa-solid fa-arrow-up text-[11px]"></i>
                    </button>
                    <button
                      onClick={() => moveMember(i, 1)}
                      disabled={i === draftMembers.length - 1}
                      title="Turunkan urutan"
                      className="w-7 h-7 rounded-lg text-gray-500 bg-white border border-gray-200 hover:text-green-700 disabled:opacity-40"
                    >
                      <i className="fa-solid fa-arrow-down text-[11px]"></i>
                    </button>
                    <button
                      onClick={() => removeMember(m.id)}
                      title="Keluarkan dari giliran"
                      className="w-7 h-7 rounded-lg text-red-500 bg-white border border-gray-200 hover:bg-red-50"
                    >
                      <i className="fa-solid fa-xmark text-[11px]"></i>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {canEdit && (
          <div className="flex gap-2 mt-3">
            <select
              value={pickUser}
              onChange={(e) => setPickUser(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Tambah pegawai ke giliran...</option>
              {pegawaiList
                .filter((u) => !draftMembers.some((m) => m.id === u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <button
              onClick={addMember}
              disabled={!pickUser}
              className="px-4 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-40 shrink-0"
              style={{ backgroundColor: "#1a7a1a" }}
            >
              <i className="fa-solid fa-plus"></i>
            </button>
            <button
              onClick={handleSaveMembers}
              disabled={savingMembers}
              className="px-4 py-2 rounded-xl text-gray-700 font-bold text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-60 shrink-0"
            >
              {savingMembers ? "Menyimpan..." : "Simpan Daftar"}
            </button>
          </div>
        )}
      </div>

      {/* Pratinjau giliran */}
      <div className="border-t border-gray-100 mt-4 pt-4">
        <div className="text-xs font-extrabold text-gray-600 mb-2">
          Pratinjau Giliran ({plan.length} Sabtu)
        </div>
        {plan.length === 0 ? (
          <p className="text-xs font-semibold text-gray-400">
            Belum ada pratinjau.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {plan.map((p) => (
              <div
                key={p.tanggal}
                className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
              >
                <span className="text-xs font-bold text-gray-600 shrink-0">
                  {p.tanggal}
                </span>
                <span className="text-xs font-semibold text-gray-700 text-right truncate">
                  {p.members.length > 0
                    ? p.members.map((m) => m.name).join(", ")
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
