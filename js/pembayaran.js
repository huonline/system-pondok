import { db, auth } from "../firebase.js"; 
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =========================================================================
// 1. CEK STATUS LOGIN ADMIN
// =========================================================================
let isAdmin = false;

onAuthStateChanged(auth, (user) => {
  const adminElements = document.querySelectorAll('.admin-only');
  if (user) {
    isAdmin = true;
    adminElements.forEach(el => {
      if (el.tagName === 'TR' || el.tagName === 'TD' || el.tagName === 'TH') {
        el.style.setProperty('display', 'table-cell', 'important');
      } else {
        el.style.setProperty('display', 'block', 'important');
      }
    });
  } else {
    isAdmin = false;
    adminElements.forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });
  }
});

// =========================================================================
// 2. LIVE SEARCH NAMA SANTRI & SIMPAN LOCAL MEMORY UNTUK CEK GENDER
// =========================================================================
const datalistBayar = document.getElementById("data-santri-list-bayar");
let localDataSantri = []; // Menyimpan data sementara untuk cek gender secara offline/cepat

if (datalistBayar) {
  onSnapshot(collection(db, "santri"), (snapshot) => {
    datalistBayar.innerHTML = ""; 
    localDataSantri = []; 

    snapshot.forEach((docSnap) => {
      const santri = docSnap.data();
      localDataSantri.push(santri); // Simpan nama dan gender

      const option = document.createElement("option");
      option.value = santri.nama; 
      datalistBayar.appendChild(option);
    });
  });
}

// Fungsi Bantuan Format Uang & Tanggal
const formatRupiah = (angka) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(angka);
};

const formatTanggal = (isoString) => {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.toLocaleString("id-ID", { day: '2-digit', month: 'short', year: 'numeric' });
};

// =========================================================================
// 3. READ DATA: TAMPILKAN RIWAYAT TRANSAKSI KEUANGAN REAL-TIME
// =========================================================================
const tbodyBayar = document.getElementById("list-pembayaran-santri");

onSnapshot(collection(db, "pembayaran"), (snapshot) => {
  if (!tbodyBayar) return;
  tbodyBayar.innerHTML = "";
  let count = 0;

  snapshot.forEach((docSnap) => {
    const bayar = docSnap.data();
    const id = docSnap.id;
    count++;

    // Tentukan badge status keuangan
    const badgeClass = bayar.status === "LUNAS" ? "status-lunas" : "status-cicil";
    
    // Teks sisa tunggakan
    const sisaTeks = bayar.sisa > 0 
      ? `<span class="text-tunggakan">${formatRupiah(bayar.sisa)}</span>` 
      : `<span class="text-pas">-</span>`;

    const rowHTML = `
      <tr>
        <td>**${bayar.nama}**</td>
        <td>${bayar.kategori}</td>
        <td class="text-center">${bayar.bulan || "-"}</td>
        <td>${formatRupiah(bayar.tagihan)}</td>
        <td>${formatRupiah(bayar.dibayar)}</td>
        <td>${sisaTeks}</td>
        <td class="text-center"><span class="status-badge ${badgeClass}">${bayar.status}</span></td>
        <td>${formatTanggal(bayar.tanggalBayar)}</td>
        <td class="admin-only text-center" style="display: ${isAdmin ? 'table-cell' : 'none'} !important;">
          <button class="btn-delete-bayar btn-delete" data-id="${id}">Hapus</button>
        </td>
      </tr>
    `;
    tbodyBayar.insertAdjacentHTML("beforeend", rowHTML);
  });

  if (count === 0) {
    tbodyBayar.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Belum ada riwayat pembayaran.</td></tr>`;
  }
});

// =========================================================================
// 4. WRITE DATA: PROSES SIMPAN TRANSAKSI + LOGIKA OTOMATISASI TAGIHAN
// =========================================================================
const formBayar = document.getElementById("form-pembayaran");

if (formBayar) {
  formBayar.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nama = document.getElementById("bayar-nama").value.trim();
    const kategori = document.getElementById("bayar-jenis").value;
    let bulan = document.getElementById("bayar-bulan").value;
    const jumlahDibayar = parseInt(document.getElementById("bayar-jumlah").value) || 0;

    // 1. Cari data santri di local memory untuk mencocokkan gender
    const cocokSantri = localDataSantri.find(s => s.nama.toLowerCase() === nama.toLowerCase());

    if (!cocokSantri) {
      alert("Nama santri tidak ditemukan! Pastikan memilih nama dari rekomendasi list.");
      return;
    }

    // 2. Tentukan Nominal Tagihan Otomatis berdasarkan Aturan Pondok
    let nominalTagihan = 0;

    if (kategori === "SPP Bulanan") {
      nominalTagihan = 320000; // SPP Flat Rp 320.000
    } else if (kategori === "Pendaftaran") {
      bulan = "-"; // Jika pendaftaran, kolom bulan diset strip otomatis
      if (cocokSantri.gender === "Putra") {
        nominalTagihan = 875000; // Pendaftaran Putra
      } else if (cocokSantri.gender === "Putri") {
        nominalTagihan = 945000; // Pendaftaran Putri
      }
    }

    // Validasi input bulan khusus jika memilih SPP
    if (kategori === "SPP Bulanan" && bulan === "-") {
      alert("Silakan pilih bulan tagihan SPP terlebih dahulu.");
      return;
    }

    // 3. Hitung Sisa Tunggakan dan Status Otomatis
    const sisaTunggakan = nominalTagihan - jumlahDibayar;
    const statusPembayaran = sisaTunggakan <= 0 ? "LUNAS" : "DICICIL";

    try {
      // 4. Kirim data final ke database Firebase Firestore
      await addDoc(collection(db, "pembayaran"), {
        nama: nama,
        kategori: kategori,
        bulan: bulan,
        tagihan: nominalTagihan,
        dibayar: jumlahDibayar,
        sisa: sisaTunggakan < 0 ? 0 : sisaTunggakan, // Mencegah minus jika bayar kelebihan
        status: statusPembayaran,
        tanggalBayar: new Date().toISOString()
      });

      formBayar.reset();
      alert("Transaksi pembayaran berhasil disimpan!");
    } catch (error) {
      console.error("Gagal menyimpan transaksi: ", error);
      alert("Terjadi kesalahan saat menyimpan data pembayaran.");
    }
  });
}

// =========================================================================
// 5. DELETE DATA: HAPUS RIWAYAT TRANSAKSI KEUANGAN
// =========================================================================
document.body.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-delete-bayar")) {
    const id = e.target.getAttribute("data-id");
    if (confirm("Apakah Anda yakin ingin menghapus catatan transaksi ini?")) {
      try {
        await deleteDoc(doc(db, "pembayaran", id));
        alert("Catatan transaksi berhasil dihapus.");
      } catch (error) {
        console.error("Gagal menghapus transaksi: ", error);
      }
    }
  }
});
