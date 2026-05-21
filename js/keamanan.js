// =========================================================================
// 6. LOGIKA MENU KEAMANAN (PERIZINAN SANTRI)
// =========================================================================

// A. Isi Datalist Pencarian Nama Santri Otomatis (Live Search)
const datalistSantri = document.getElementById("data-santri-list");
if (datalistSantri) {
  onSnapshot(collection(db, "santri"), (snapshot) => {
    datalistSantri.innerHTML = ""; // Bersihkan list lama
    snapshot.forEach((docSnap) => {
      const santri = docSnap.data();
      const option = document.createElement("option");
      option.value = santri.nama; // Memasukkan nama santri ke dropdown
      datalistSantri.appendChild(option);
    });
  });
}

// Fungsi Bantuan: Format Tanggal agar lebih mudah dibaca
const formatTanggal = (isoString) => {
  if (!isoString || isoString === "-") return "-";
  const d = new Date(isoString);
  return d.toLocaleString("id-ID", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Fungsi Bantuan: Format Angka ke Rupiah (Denda)
const formatRupiah = (angka) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(angka);
};

// B. Read Data Perizinan Real-Time
const tbodyIzin = document.getElementById("list-izin-santri");

onSnapshot(collection(db, "perizinan"), (snapshot) => {
  if (!tbodyIzin) return;
  tbodyIzin.innerHTML = "";
  let count = 0;

  snapshot.forEach((docSnap) => {
    const izin = docSnap.data();
    const id = docSnap.id;
    count++;

    // Atur warna badge berdasarkan status
    let badgeClass = "status-keluar";
    if (izin.status === "Tepat Waktu") badgeClass = "status-tepat";
    if (izin.status === "Terlambat") badgeClass = "status-terlambat";

    // Format Denda
    const dendaTeks = izin.denda > 0 ? `<span class="text-denda">${formatRupiah(izin.denda)}</span>` : `<span class="text-aman">-</span>`;

    // Tombol konfirmasi HANYA muncul jika santri belum kembali (Sedang Keluar)
    const tombolKonfirmasi = izin.status === "Sedang Keluar" 
      ? `<button class="btn-konfirmasi" data-id="${id}" data-batas="${izin.batasWaktu}">Konfirmasi</button>` 
      : "";

    const rowHTML = `
      <tr>
        <td>${izin.nama}</td>
        <td>${izin.alasan}</td>
        <td>${formatTanggal(izin.waktuKeluar)}</td>
        <td>${formatTanggal(izin.batasWaktu)}</td>
        <td>${formatTanggal(izin.waktuKembali)}</td>
        <td><span class="status-badge ${badgeClass}">${izin.status}</span></td>
        <td>${dendaTeks}</td>
        <td class="admin-only text-center" style="display: ${isAdmin ? 'table-cell' : 'none'} !important;">
          <div class="action-actions-wrap">
            ${tombolKonfirmasi}
            <button class="btn-delete-izin btn-delete" data-id="${id}">Hapus</button>
          </div>
        </td>
      </tr>
    `;
    tbodyIzin.insertAdjacentHTML("beforeend", rowHTML);
  });

  if (count === 0) {
    tbodyIzin.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Belum ada data perizinan keluar.</td></tr>`;
  }
});

// C. Write: Tambah Data Perizinan Baru ke Firebase
const formIzin = document.getElementById("form-izin");
if (formIzin) {
  formIzin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nama = document.getElementById("izin-nama").value;
    const alasan = document.getElementById("izin-alasan").value;
    const waktuKeluar = document.getElementById("izin-waktu-keluar").value;
    const batasWaktu = document.getElementById("izin-batas-waktu").value;

    try {
      await addDoc(collection(db, "perizinan"), {
        nama: nama,
        alasan: alasan,
        waktuKeluar: waktuKeluar,
        batasWaktu: batasWaktu,
        waktuKembali: "-",
        status: "Sedang Keluar",
        denda: 0,
        createdAt: new Date().toISOString()
      });
      formIzin.reset();
      alert("Data perizinan berhasil disimpan!");
    } catch (error) {
      console.error("Gagal menyimpan izin: ", error);
      alert("Gagal menyimpan data perizinan.");
    }
  });
}

// D. Update Kedatangan & Hitung Denda (Delegasi Event)
document.body.addEventListener("click", async (e) => {
  // 1. Aksi Tombol Konfirmasi Kedatangan
  if (e.target.classList.contains("btn-konfirmasi")) {
    const id = e.target.getAttribute("data-id");
    const batasWaktuIso = e.target.getAttribute("data-batas");
    
    if (confirm("Konfirmasi santri ini sudah kembali ke pondok?")) {
      const sekarang = new Date();
      const batasWaktu = new Date(batasWaktuIso);
      
      let statusBaru = "Tepat Waktu";
      let totalDenda = 0;

      // Logika Keterlambatan dan Denda
      if (sekarang > batasWaktu) {
        statusBaru = "Terlambat";
        const selisihMs = sekarang - batasWaktu;
        // Hitung selisih hari (dibulatkan ke atas: lewat 1 jam = denda 1 hari penuh)
        const selisihHari = Math.ceil(selisihMs / (1000 * 60 * 60 * 24));
        totalDenda = selisihHari * 10000; // Rp 10.000 per hari
      }

      try {
        await updateDoc(doc(db, "perizinan", id), {
          waktuKembali: sekarang.toISOString(), // Catat jam kembali real-time
          status: statusBaru,
          denda: totalDenda
        });
        alert(`Kedatangan berhasil dikonfirmasi!\nStatus: ${statusBaru}\nTotal Denda: Rp ${totalDenda.toLocaleString("id-ID")}`);
      } catch (error) {
        console.error("Gagal update kedatangan: ", error);
      }
    }
  }

  // 2. Aksi Tombol Hapus Riwayat Izin
  if (e.target.classList.contains("btn-delete-izin")) {
    const id = e.target.getAttribute("data-id");
    if (confirm("Apakah Anda yakin ingin menghapus catatan izin ini?")) {
      try {
        await deleteDoc(doc(db, "perizinan", id));
      } catch (error) {
        console.error("Gagal menghapus izin: ", error);
      }
    }
  }
});
