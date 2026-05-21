import { db, auth } from "./firebase.js"; 
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =========================================================================
// 1. CEK STATUS LOGIN (ADMIN VS PENGUNJUNG)
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
// 2. READ DATA: AMBIL DATA SANTRI REAL-TIME (TERMASUK ALAMAT)
// =========================================================================
const tbodyPutra = document.getElementById("list-santri-putra");
const tbodyPutri = document.getElementById("list-santri-putri");
const countPutra = document.getElementById("count-putra");
const countPutri = document.getElementById("count-putri");

onSnapshot(collection(db, "santri"), (snapshot) => {
  tbodyPutra.innerHTML = "";
  tbodyPutri.innerHTML = "";
  
  let totalPutra = 0;
  let totalPutri = 0;

  snapshot.forEach((docSnap) => {
    const santri = docSnap.data();
    const id = docSnap.id;

    // Baris HTML ditambah kolom Alamat (kolom ke-3)
    const rowHTML = `
      <tr>
        <td>${santri.nama}</td>
        <td>${santri.asrama}</td>
        <td>${santri.alamat || "-"}</td>
        <td class="admin-only text-center" style="display: ${isAdmin ? 'table-cell' : 'none'} !important;">
          <button class="btn-delete" data-id="${id}">Hapus</button>
        </td>
      </tr>
    `;

    if (santri.gender === "Putra") {
      tbodyPutra.insertAdjacentHTML("beforeend", rowHTML);
      totalPutra++;
    } else if (santri.gender === "Putri") {
      tbodyPutri.insertAdjacentHTML("beforeend", rowHTML);
      totalPutri++;
    }
  });

  if(countPutra) countPutra.innerText = totalPutra;
  if(countPutri) countPutri.innerText = totalPutri;

  if (totalPutra === 0) {
    tbodyPutra.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Belum ada data santri putra.</td></tr>`;
  }
  if (totalPutri === 0) {
    tbodyPutri.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Belum ada data santri putri.</td></tr>`;
  }
});

// =========================================================================
// 3. WRITE DATA: PROSES INPUT MASSAL (KHUSUS ADMIN)
// =========================================================================
const formTambah = document.getElementById("form-tambah-santri");

if (formTambah) {
  formTambah.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Ambil nilai input
    const rawNames = document.getElementById("santri-nama").value;
    const gender = document.getElementById("santri-gender").value;
    const asrama = document.getElementById("santri-asrama").value;
    const alamat = document.getElementById("santri-alamat").value;

    // Pecah teks berdasarkan baris baru, lalu bersihkan baris yang kosong atau hanya spasi
    const namaList = rawNames
      .split("\n")
      .map(nama => nama.trim())
      .filter(nama => nama.length > 0);

    if (namaList.length === 0) return;

    try {
      // Jalankan penyimpanan ke Firebase secara bersamaan (Bulk Insert)
      const uploadPromises = namaList.map(nama => {
        return addDoc(collection(db, "santri"), {
          nama: nama,
          gender: gender,
          asrama: asrama,
          alamat: alamat,
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(uploadPromises);

      // Reset input form setelah semua data berhasil masuk
      formTambah.reset();
      alert(`Berhasil menyimpan ${namaList.length} data santri secara massal!`);
    } catch (error) {
      console.error("Gagal menyimpan data massal: ", error);
      alert("Terjadi kesalahan saat menyimpan data massal.");
    }
  });
}

// =========================================================================
// 4. DELETE DATA: HAPUS SATU PER SATU (KHUSUS ADMIN)
// =========================================================================
document.body.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-delete")) {
    const id = e.target.getAttribute("data-id");
    
    if (confirm("Apakah Anda yakin ingin menghapus data santri ini?")) {
      try {
        await deleteDoc(doc(db, "santri", id));
        alert("Data santri berhasil dihapus.");
      } catch (error) {
        console.error("Gagal menghapus data: ", error);
        alert("Gagal menghapus data.");
      }
    }
  }
});
