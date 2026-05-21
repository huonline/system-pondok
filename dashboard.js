import { db, auth } from "./firebase.js"; 
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc,
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
// 2. READ DATA: AMBIL DATA SANTRI REAL-TIME
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

    // Setiap baris diberi ID unik (row-id) agar bisa dimanipulasi saat tombol edit diklik
    const rowHTML = `
      <tr id="row-${id}">
        <td class="cell-nama">${santri.nama}</td>
        <td class="cell-asrama">${santri.asrama || "-"}</td>
        <td class="cell-alamat">${santri.alamat || "-"}</td>
        <td class="admin-only text-center" style="display: ${isAdmin ? 'table-cell' : 'none'} !important;">
          <div class="action-actions-wrap">
            <button class="btn-edit" data-id="${id}">Edit</button>
            <button class="btn-delete" data-id="${id}">Hapus</button>
          </div>
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
// 3. WRITE DATA: INPUT NAMA MASSAL (ASRAMA & ALAMAT DEFAULT SEBAGAI SEBELUMNYA "-")
// =========================================================================
const formTambah = document.getElementById("form-tambah-santri");

if (formTambah) {
  formTambah.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawNames = document.getElementById("santri-nama").value;
    const gender = document.getElementById("santri-gender").value;

    const namaList = rawNames
      .split("\n")
      .map(nama => nama.trim())
      .filter(nama => nama.length > 0);

    if (namaList.length === 0) return;

    try {
      const uploadPromises = namaList.map(nama => {
        return addDoc(collection(db, "santri"), {
          nama: nama,
          gender: gender,
          asrama: "-", // Nilai bawaan, nanti diedit di tabel
          alamat: "-", // Nilai bawaan, nanti diedit di tabel
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(uploadPromises);
      formTambah.reset();
      alert(`Berhasil memasukkan ${namaList.length} nama santri! Silakan lengkapi asrama dan alamatnya langsung di tabel bawah.`);
    } catch (error) {
      console.error("Gagal menyimpan data massal: ", error);
      alert("Terjadi kesalahan saat menyimpan data.");
    }
  });
}

// =========================================================================
// 4. INLINE EDIT & UPDATE DATA (EDIT LANGSUNG DI TABEL)
// =========================================================================
document.body.addEventListener("click", async (e) => {
  // AKSI 1: KETIKA TOMBOL EDIT DIKLIK
  if (e.target.classList.contains("btn-edit")) {
    const id = e.target.getAttribute("data-id");
    const tr = document.getElementById(`row-${id}`);
    
    // Ambil teks asli yang ada di tabel saat ini
    const currentAsrama = tr.querySelector(".cell-asrama").innerText;
    const currentAlamat = tr.querySelector(".cell-alamat").innerText;

    // Ubah text td menjadi kotak input ketik
    tr.querySelector(".cell-asrama").innerHTML = `<input type="text" class="table-input input-asrama" value="${currentAsrama === '-' ? '' : currentAsrama}" placeholder="Kamar...">`;
    tr.querySelector(".cell-alamat").innerHTML = `<input type="text" class="table-input input-alamat" value="${currentAlamat === '-' ? '' : currentAlamat}" placeholder="Kota...">`;

    // Ubah tombol "Edit" menjadi tombol "Simpan"
    const actionWrap = tr.querySelector(".action-actions-wrap");
    actionWrap.innerHTML = `
      <button class="btn-save" data-id="${id}">Simpan</button>
      <button class="btn-delete" data-id="${id}">Hapus</button>
    `;
  }

  // AKSI 2: KETIKA TOMBOL SIMPAN DIKLIK
  if (e.target.classList.contains("btn-save")) {
    const id = e.target.getAttribute("data-id");
    const tr = document.getElementById(`row-${id}`);

    // Ambil nilai baru dari kotak input
    const newAsrama = tr.querySelector(".input-asrama").value.trim() || "-";
    const newAlamat = tr.querySelector(".input-alamat").value.trim() || "-";

    try {
      // Update langsung ke dokumen Firestore berdasarkan ID santri tersebut
      const docRef = doc(db, "santri", id);
      await updateDoc(docRef, {
        asrama: newAsrama,
        alamat: newAlamat
      });

      alert("Data berhasil diperbarui!");
      // Catatan: Tampilan tabel akan otomatis berubah kembali menjadi teks biasa 
      // karena fungsi onSnapshot (Read Data) di atas mendeteksi perubahan data secara real-time.
    } catch (error) {
      console.error("Gagal memperbarui data: ", error);
      alert("Gagal memperbarui data.");
    }
  }

  // AKSI 3: HAPUS DATA SANTRI
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

// =========================================================================
// 5. LOGIKA PERPINDAHAN MENU DASHBOARD (NAVIGASI SECTION)
// =========================================================================
const navButtons = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll(".section");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    // 1. Ambil target id section dari atribut data-section
    const targetSectionId = `section-${btn.getAttribute("data-section")}`;
    const targetSection = document.getElementById(targetSectionId);

    if (targetSection) {
      // 2. Hilangkan class 'active' dari semua tombol menu
      navButtons.forEach((b) => b.classList.remove("active"));
      
      // 3. Hilangkan class 'active' dari semua section konten
      sections.forEach((s) => s.classList.remove("active"));

      // 4. Tambahkan kembali class 'active' ke tombol yang diklik dan section pasangannya
      btn.classList.add("active");
      targetSection.classList.add("active");
    }
  });
});
