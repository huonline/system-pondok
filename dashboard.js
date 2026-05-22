import { db, auth } from "./firebase.js"; 
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  doc, 
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
// 2. READ DATA: AMBIL DATA SANTRI REAL-TIME & FILTER PER KELAS
// =========================================================================
const tbodyPutra = document.getElementById("list-santri-putra");
const tbodyPutri = document.getElementById("list-santri-putri");
const countPutra = document.getElementById("count-putra");
const countPutri = document.getElementById("count-putri");
const filterKelasSantri = document.getElementById("filter-kelas-santri");

// Jalankan ulang fungsi penyaringan setiap kali filter dropdown diubah
if (filterKelasSantri) {
  filterKelasSantri.addEventListener("change", muatDataSantri);
}

function muatDataSantri() {
  const q = query(collection(db, "santri"), orderBy("nama", "asc"));

  onSnapshot(q, (snapshot) => {
    tbodyPutra.innerHTML = "";
    tbodyPutri.innerHTML = "";
    
    let totalPutra = 0;
    let totalPutri = 0;
    
    // Tambahkan 2 variabel ini untuk menghitung nomor urut dari angka 1
    let noUrutPutra = 1;
    let noUrutPutri = 1;

    const kelasTerpilih = filterKelasSantri ? filterKelasSantri.value : "SEMUA";

    snapshot.forEach((docSnap) => {
      const santri = docSnap.data();
      const id = docSnap.id;

      if (kelasTerpilih !== "SEMUA" && santri.kelas !== kelasTerpilih) {
        return; 
      }

      // Tentukan nomor urut mana yang dipakai berdasarkan gender santri
      const nomorSekarang = santri.gender === "Putra" ? noUrutPutra : noUrutPutri;

      // Selipkan variabel ${nomorSekarang} di depan nama santri
      const rowHTML = `
        <tr id="row-${id}">
          <td class="cell-nama">
            <span class="nomer-urut">${nomorSekarang}.</span> ${santri.nama}
          </td>
          <td class="cell-kelas">${santri.kelas || "-"}</td>
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
        noUrutPutra++; // Naikkan nomor urut putra (+1) setelah berhasil merender 1 nama
      } else if (santri.gender === "Putri") {
        tbodyPutri.insertAdjacentHTML("beforeend", rowHTML);
        totalPutri++;
        noUrutPutri++; // Naikkan nomor urut putri (+1) setelah berhasil merender 1 nama
      }
    });

    if(countPutra) countPutra.innerText = totalPutra;
    if(countPutri) countPutri.innerText = totalPutri;

    if (totalPutra === 0) {
      tbodyPutra.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Tidak ada data santri putra di kelas ini.</td></tr>`;
    }
    if (totalPutri === 0) {
      tbodyPutri.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Tidak ada data santri putri di kelas ini.</td></tr>`;
    }
  });
}

// Jalankan fungsi muat data pertama kali saat halaman siap
muatDataSantri();

// =========================================================================
// 3. WRITE DATA: INPUT NAMA MASSAL PER KELAS & KATEGORI
// =========================================================================
const formTambah = document.getElementById("form-tambah-santri");

if (formTambah) {
  formTambah.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawNames = document.getElementById("santri-nama").value;
    const gender = document.getElementById("input-kategori").value; // Menyesuaikan ID Baru HTML
    const kelas = document.getElementById("input-kelas").value;   // Menyesuaikan ID Baru HTML

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
          kelas: kelas,   // Menggantikan field asrama menjadi kelas secara permanen
          alamat: "-",    // Nilai bawaan alamat awal
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(uploadPromises);
      formTambah.reset();
      alert(`Berhasil memasukkan ${namaList.length} nama santri ke kelas ${kelas}!`);
    } catch (error) {
      console.error("Gagal menyimpan data massal: ", error);
      alert("Terjadi kesalahan saat menyimpan data.");
    }
  });
}

// =========================================================================
// 4. INLINE EDIT & UPDATE DATA (EDIT LANGSUNG DI DALAM TABEL)
// =========================================================================
document.body.addEventListener("click", async (e) => {
  // AKSI 1: KETIKA TOMBOL EDIT DIKLIK
  if (e.target.classList.contains("btn-edit")) {
    const id = e.target.getAttribute("data-id");
    const tr = document.getElementById(`row-${id}`);
    
    // Ambil nilai teks tertulis saat ini
    const currentKelas = tr.querySelector(".cell-kelas").innerText;
    const currentAlamat = tr.querySelector(".cell-alamat").innerText;

    // Ubah kolom tabel menjadi bentuk input fields untuk diketik langsung
    tr.querySelector(".cell-kelas").innerHTML = `<input type="text" class="table-input input-kelas" value="${currentKelas === '-' ? '' : currentKelas}" placeholder="Kelas...">`;
    tr.querySelector(".cell-alamat").innerHTML = `<input type="text" class="table-input input-alamat" value="${currentAlamat === '-' ? '' : currentAlamat}" placeholder="Kota...">`;

    // Ganti tombol "Edit" menjadi tombol "Simpan"
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

    // Ambil data modifikasi terbaru dari input data tabel
    const newKelas = tr.querySelector(".input-kelas").value.trim() || "-";
    const newAlamat = tr.querySelector(".input-alamat").value.trim() || "-";

    try {
      const docRef = doc(db, "santri", id);
      await updateDoc(docRef, {
        kelas: newKelas,
        alamat: newAlamat
      });

      alert("Data santri berhasil diperbarui!");
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
    const targetSectionId = `section-${btn.getAttribute("data-section")}`;
    const targetSection = document.getElementById(targetSectionId);

    if (targetSection) {
      navButtons.forEach((b) => b.classList.remove("active"));
      sections.forEach((s) => s.classList.remove("active"));

      btn.classList.add("active");
      targetSection.classList.add("active");
    }
  });
});

// =========================================================================
// 6. FITUR LOG OUT ADMIN VIA AVATAR PROFILE
// =========================================================================
const tombolLogOut = document.querySelector(".profile-avatar");

if (tombolLogOut) {
  tombolLogOut.style.cursor = "pointer";
  tombolLogOut.setAttribute("title", "Klik untuk Keluar dari Admin");

  tombolLogOut.addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin keluar dari akun Admin?")) {
      signOut(auth)
        .then(() => {
          alert("Anda telah keluar. Halaman akan dimuat ulang ke mode Umum.");
          window.location.reload();
        })
        .catch((error) => {
          console.error("Gagal Log Out: ", error);
          alert("Terjadi kesalahan saat mencoba keluar.");
        });
    }
  });
}
