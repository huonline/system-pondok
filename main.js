import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyClHDzTGncpd_5-Gnc4zmL3JVrXX1tiGKQ",
  authDomain: "admin-hu-874c2.firebaseapp.com",
  projectId: "admin-hu-874c2",
  storageBucket: "admin-hu-874c2.firebasestorage.app",
  messagingSenderId: "419870283564",
  appId: "1:419870283564:web:18054f24b31b52eb7b7e89"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===== ANIMASI BACKGROUND =====
const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

function getCorners() {
  const W = canvas.width, H = canvas.height;
  return [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: 0, y: H },
    { x: W, y: H },
  ];
}

function drawCornerLines(cx, cy, tx, ty, prog, alpha) {
  const ex = cx + (tx - cx) * prog;
  const ey = cy + (ty - cy) * prog;
  const layers = [
    { width: 28, cs: `rgba(0,80,255,${alpha*0.08})`,   ce: `rgba(220,0,0,${alpha*0.04})` },
    { width: 16, cs: `rgba(220,0,0,${alpha*0.15})`,    ce: `rgba(0,100,255,${alpha*0.1})` },
    { width: 8,  cs: `rgba(120,0,255,${alpha*0.25})`,  ce: `rgba(0,160,255,${alpha*0.2})` },
    { width: 3,  cs: `rgba(255,60,60,${alpha*0.7})`,   ce: `rgba(60,140,255,${alpha*0.7})` },
    { width: 1,  cs: `rgba(255,180,180,${alpha*0.9})`, ce: `rgba(180,210,255,${alpha*0.9})` },
  ];
  layers.forEach(l => {
    const grad = ctx.createLinearGradient(cx, cy, ex, ey);
    grad.addColorStop(0, l.cs);
    grad.addColorStop(1, l.ce);
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth   = l.width;
    ctx.lineCap     = 'round';
    ctx.shadowColor = 'rgba(180,60,255,0.3)';
    ctx.shadowBlur  = l.width * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
  });
}

function drawScene(gAlpha, lProg) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const corners = getCorners();
  corners.forEach((c, i) => {
    const r   = W * 0.62;
    const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    if (i % 2 === 0) {
      grd.addColorStop(0,    `rgba(200,0,0,${gAlpha*0.5})`);
      grd.addColorStop(0.35, `rgba(100,0,180,${gAlpha*0.2})`);
      grd.addColorStop(0.6,  `rgba(0,60,200,${gAlpha*0.1})`);
      grd.addColorStop(1,    'rgba(0,0,0,0)');
    } else {
      grd.addColorStop(0,    `rgba(0,80,255,${gAlpha*0.5})`);
      grd.addColorStop(0.35, `rgba(80,0,200,${gAlpha*0.2})`);
      grd.addColorStop(0.6,  `rgba(180,0,0,${gAlpha*0.1})`);
      grd.addColorStop(1,    'rgba(0,0,0,0)');
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  });
  const tx = W * 0.5, ty = H * 0.5;
  corners.forEach(c => drawCornerLines(c.x, c.y, tx, ty, lProg, gAlpha));
}

let phase     = 'in';
let startTime = null;
const ANIM_IN = 2.0;

function animate(ts) {
  if (!startTime) startTime = ts;
  const elapsed = (ts - startTime) / 1000;
  if (phase === 'in') {
    const gAlpha = Math.min(elapsed / ANIM_IN, 1);
    const lProg  = Math.min(elapsed / ANIM_IN, 0.46);
    drawScene(gAlpha, lProg);
    if (elapsed >= ANIM_IN) {
      phase = 'idle';
      document.getElementById('content').classList.add('visible');
    }
  } else {
    const pulse = 0.82 + 0.18 * Math.sin(ts / 1200);
    drawScene(pulse, 0.46);
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ===== LOGIN =====
const btnMasuk    = document.getElementById('btnMasuk');
const inputEmail  = document.getElementById('inputEmail');
const inputPass   = document.getElementById('inputPassword');
const errorMsg    = document.getElementById('errorMsg');

btnMasuk.addEventListener('click', async () => {
  const email    = inputEmail.value.trim();
  const password = inputPass.value.trim();
  errorMsg.textContent = '';

  if (!email || !password) {
    errorMsg.textContent = '⚠ Email dan password wajib diisi';
    return;
  }

  btnMasuk.disabled     = true;
  btnMasuk.textContent  = 'MEMVERIFIKASI...';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'dashboard.html';
  } catch (err) {
    btnMasuk.disabled    = false;
    btnMasuk.textContent = '▶ MASUK';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      errorMsg.textContent = '⚠ Email atau password salah';
    } else if (err.code === 'auth/invalid-email') {
      errorMsg.textContent = '⚠ Format email tidak valid';
    } else if (err.code === 'auth/too-many-requests') {
      errorMsg.textContent = '⚠ Terlalu banyak percobaan, coba lagi nanti';
    } else {
      errorMsg.textContent = '⚠ Login gagal, coba lagi';
    }
  }
});

// Enter key support
inputPass.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnMasuk.click();
});
