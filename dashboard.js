// NAV SWITCHING
const navBtns = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.section');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById('section-' + btn.dataset.section);
    if (target) target.classList.add('active');
  });
});

import { db, auth } from "./firebase.js"; // Pastikan path ke file firebase.js Anda sudah benar
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// =========================================================================
// 1. CEK STATUS LOGIN (ADMIN VS PENGUNJUNG)
// =========================================================================
let isAdmin = false;

onAuthStateChanged(auth, (user) => {
  const adminElements = document.querySelectorAll('.admin-only');
  
  if (user) {
    // Jika user login (Admin)
    isAdmin = true;
    adminElements.forEach(el => {
      // Kembalikan display sesuai tipe elemennya
      if (el.tagName === 'TR' || el.tagName === 'TD' || el.tagName === 'TH') {
        el.style.setProperty('display', 'table-cell', 'important');
      } else {
        el.style.setProperty('display', 'block', 'important');
      }
    });
  } else {
    // Jika belum login (User Biasa)
    isAdmin = false;
    adminElements.forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });
  }
});

// =========================================================================
// 2. READ DATA: AMBIL DATA SANTRI REAL-TIME DARI FIRESTORE
// =========================================================================
const tbodyPutra = document.getElementById("list-santri-putra");
const tbodyPutri = document.getElementById("list-santri-putri");
const countPutra = document.getElementById("count-putra");
const countPutri = document.getElementById("count-putri");

// Hubungkan ke koleksi bernama "santri" di Firestore
onSnapshot(collection(db, "santri"), (snapshot) => {
  // Kosongkan tabel dulu setiap ada perubahan data
  tbodyPutra.innerHTML = "";
  tbodyPutri.innerHTML = "";
  
  let totalPutra = 0;
  let totalPutri = 0;

  snapshot.forEach((docSnap) => {
    const santri = docSnap.data();
    const id = docSnap.id; // ID dokumen untuk keperluan hapus data

    // Baris HTML untuk tiap baris santri
    const rowHTML = `
      <tr>
        <td>${santri.nama}</td>
        <td>${santri.kamar}</td>
        <td class="admin-only text-center" style="display: ${isAdmin ? 'table-cell' : 'none'} !important;">
          <button class="btn-delete" data-id="${id}">Hapus</button>
        </td>
      </tr>
    `;

    // Filter otomatis berdasarkan gender/kategori
    if (santri.gender === "Putra") {
      tbodyPutra.insertAdjacentHTML("beforeend", rowHTML);
      totalPutra++;
    } else if (santri.gender === "Putri") {
      tbodyPutri.insertAdjacentHTML("beforeend", rowHTML);
      totalPutri++;
    }
  });

  // Update angka total santri di dashboard
  if(countPutra) countPutra.innerText = totalPutra;
  if(countPutri) countPutri.innerText = totalPutri;

  // Jika data kosong, tampilkan pesan kosong
  if (totalPutra === 0) {
    tbodyPutra.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Belum ada data santri putra.</td></tr>`;
  }
  if (totalPutri === 0) {
    tbodyPutri.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Belum ada data santri putri.</td></tr>`;
  }
});

// =========================================================================
// 3. WRITE DATA: TAMBAH DATA SANTRI (KHUSUS ADMIN)
// =========================================================================
const formTambah = document.getElementById("form-tambah-santri");

if (formTambah) {
  formTambah.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Ambil data dari input form HTML
    const nama = document.getElementById("santri-nama").value;
    const gender = document.getElementById("santri-gender").value;
    const kamar = document.getElementById("santri-kamar").value;

    try {
      // Kirim data ke Firestore
      await addDoc(collection(db, "santri"), {
        nama: nama,
        gender: gender,
        kamar: kamar,
        createdAt: new Date().toISOString() // opsional, untuk penanda waktu
      });

      // Reset form setelah berhasil input
      formTambah.reset();
      alert("Data santri berhasil disimpan!");
    } catch (error) {
      console.error("Gagal menambah data: ", error);
      alert("Gagal menyimpan data, periksa koneksi atau hak akses database.");
    }
  });
}

// =========================================================================
// 4. DELETE DATA: HAPUS DATA SANTRI (KHUSUS ADMIN)
// =========================================================================
// Menggunakan event delegation karena tombol hapus dibuat secara dinamis
document.body.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-delete")) {
    const id = e.target.getAttribute("data-id");
    
    // Konfirmasi sebelum hapus
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
