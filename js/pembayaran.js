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
let localDataSantri = []; 

if (datalistBayar) {
  onSnapshot(collection(db, "santri"), (snapshot) => {
    datalistBayar.innerHTML = ""; 
    localDataSantri = []; 

    snapshot.forEach((docSnap) => {
      const santri = docSnap.data();
      localDataSantri.push(santri); 

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

    const badgeClass = bayar.status === "LUNAS" ? "status-lunas" : "status-cicil";
    
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
// 4. WRITE DATA: PROSES SIMPAN TRANSAKSI + AKUMULASI CICILAN AKURAT
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

    // Validasi input bulan khusus jika memilih SPP
    if (kategori === "SPP Bulanan" && bulan === "-") {
      alert("Silakan pilih bulan tagihan SPP terlebih dahulu.");
      return;
    }
    if (kategori === "Pendaftaran") {
      bulan = "-"; 
    }

    // 2. Tentukan Nilai Tagihan Awal Bawaan Pondok
    let nominalTagihanAwal = 0;
    if (kategori === "SPP Bulanan") {
      nominalTagihanAwal = 320000;
    } else if (kategori === "Pendaftaran") {
      nominalTagihanAwal = cocokSantri.gender === "Putra" ? 875000 : 945000;
    }

    try {
      // 3. AMBIL DATA DARI FIRESTORE UNTUK CEK RIWAYAT CICILAN SEBELUMNYA
      const querySnapshot = await getDocs(collection(db, "pembayaran"));
      let riwayatTransaksi = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.nama.toLowerCase() === nama.toLowerCase() && data.kategori === kategori && data.bulan === bulan) {
          riwayatTransaksi.push(data);
        }
      });

      let nominalTagihanFinal = nominalTagihanAwal;

      if (riwayatTransaksi.length > 0) {
        riwayatTransaksi.sort((a, b) => new Date(b.tanggalBayar) - new Date(a.tanggalBayar));
        const transaksiTerakhir = riwayatTransaksi[0];

        if (transaksiTerakhir.status === "LUNAS") {
          alert(`Transaksi untuk ${nama} pada kategori ${kategori} ${bulan !== '-' ? bulan : ''} sudah LUNAS sebelumnya.`);
          return;
        }

        nominalTagihanFinal = transaksiTerakhir.sisa;
      }

      // 4. Hitung Sisa Tunggakan Baru
      const sisaTunggakanBaru = nominalTagihanFinal - jumlahDibayar;
      const statusPembayaran = sisaTunggakanBaru <= 0 ? "LUNAS" : "DICICIL";

      // 5. Kirim data transaksi cicilan ke database Firebase
      await addDoc(collection(db, "pembayaran"), {
        nama: nama,
        kategori: kategori,
        bulan: bulan,
        tagihan: nominalTagihanFinal, 
        dibayar: jumlahDibayar,
        sisa: sisaTunggakanBaru < 0 ? 0 : sisaTunggakanBaru,
        status: statusPembayaran,
        tanggalBayar: new Date().toISOString()
      });

      formBayar.reset();
      alert(`Transaksi berhasil! \nTagihan sebelumnya: Rp ${nominalTagihanFinal.toLocaleString("id-ID")}\nDibayar: Rp ${jumlahDibayar.toLocaleString("id-ID")}\nSisa Tunggakan Baru: Rp ${(sisaTunggakanBaru < 0 ? 0 : sisaTunggakanBaru).toLocaleString("id-ID")} (${statusPembayaran})`);
    } catch (error) {
      console.error("Gagal memproses hitungan akumulasi keuangan: ", error);
      alert("Terjadi kesalahan sistem saat menghitung sisa cicilan.");
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
