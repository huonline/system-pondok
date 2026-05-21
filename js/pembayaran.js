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

    // Di sini nama sudah dibersihkan dari tanda bintang (**) agar tampil normal lagi
    const rowHTML = `
      <tr>
        <td>${bayar.nama}</td>
        <td>${bayar.kategori}</td>
        <td class="text-center">${bayar.bulan || "-"}</td>
        <td>${formatRupiah(bayar.tagihan)}</td>
        <td>${formatRupiah(bayar.dibayar)}</td>
        <td>${sisaTeks}</td>
        <td class="text-center"><span class="status-badge ${badgeClass}">${bayar.status}</span></td>
        <td>${formatTanggal(bayar.tanggalBayar)}</td>
        <td class="admin-only text-center" style="display: ${isAdmin ? 'table-cell' : 'none'} !important;">
          <div class="action-actions-wrap" style="display: flex; gap: 5px; justify-content: center;">
            <button class="btn-cetak-bayar" data-id="${id}" style="background: none; border: 1px solid #00ff66; color: #00ff66; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Cetak</button>
            <button class="btn-delete-bayar btn-delete" data-id="${id}">Hapus</button>
          </div>
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

    const cocokSantri = localDataSantri.find(s => s.nama.toLowerCase() === nama.toLowerCase());

    if (!cocokSantri) {
      alert("Nama santri tidak ditemukan! Pastikan memilih nama dari rekomendasi list.");
      return;
    }

    if (kategori === "SPP Bulanan" && bulan === "-") {
      alert("Silakan pilih bulan tagihan SPP terlebih dahulu.");
      return;
    }
    if (kategori === "Pendaftaran") {
      bulan = "-"; 
    }

    let nominalTagihanAwal = 0;
    if (kategori === "SPP Bulanan") {
      nominalTagihanAwal = 320000;
    } else if (kategori === "Pendaftaran") {
      nominalTagihanAwal = cocokSantri.gender === "Putra" ? 875000 : 945000;
    }

    try {
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

      const sisaTunggakanBaru = nominalTagihanFinal - jumlahDibayar;
      const statusPembayaran = sisaTunggakanBaru <= 0 ? "LUNAS" : "DICICIL";

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
// 5. DELETE DATA & FITUR CETAK NYA KANAN
// =========================================================================
document.body.addEventListener("click", async (e) => {
  // Aksi tombol Hapus
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

  // Aksi tombol Cetak (Bebas mau dipakai atau diabaikan)
  if (e.target.classList.contains("btn-cetak-bayar")) {
    const tr = e.target.closest("tr");
    const nama = tr.cells[0].innerText;
    const kategori = tr.cells[1].innerText;
    const bulan = tr.cells[2].innerText;
    const tagihan = tr.cells[3].innerText;
    const dibayar = tr.cells[4].innerText;
    const sisa = tr.cells[5].innerText;
    const status = tr.cells[6].innerText;
    const tanggal = tr.cells[7].innerText;

    const ruangCetak = window.open("", "_blank", "width=600,height=700");
    ruangCetak.document.write(`
      <html>
        <head>
          <title>Kwitansi Pembayaran Santri</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
            .title { font-size: 1.2rem; font-weight: bold; text-transform: uppercase; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .info-table td { padding: 5px 0; font-size: 0.9rem; }
            .info-table td:nth-child(2) { text-align: right; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; border-top: 1px dashed #000; padding-top: 10px; font-size: 0.8rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">PONDOK PESANTREN</div>
            <div style="font-size: 0.8rem;">Bukti Pembayaran Administrasi Resmi</div>
          </div>
          <table class="info-table">
            <tr><td>Tanggal Transaksi</td><td>${tanggal}</td></tr>
            <tr><td>Nama Santri</td><td>${nama}</td></tr>
            <tr><td>Kategori/Jenis</td><td>${kategori}</td></tr>
            \${kategori === 'SPP Bulanan' ? \`<tr><td>Untuk Bulan</td><td>\${bulan}</td></tr>\` : ''}
            <tr><td colspan="2" style="border-bottom: 1px dashed #000;"></td></tr>
            <tr><td>Jumlah Tagihan</td><td>${tagihan}</td></tr>
            <tr><td>Jumlah Dibayarkan</td><td>${dibayar}</td></tr>
            <tr><td colspan="2" style="border-bottom: 1px dashed #000;"></td></tr>
            <tr><td>Sisa Tunggakan</td><td>${sisa === '-' ? 'Rp 0' : sisa}</td></tr>
            <tr><td>Status Akhir</td><td>[ ${status} ]</td></tr>
          </table>
          <div class="footer">
            <p>Terima kasih atas pembayarannya.<br>Simpan struk ini sebagai bukti sah.</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    ruangCetak.document.close();
  }
});
