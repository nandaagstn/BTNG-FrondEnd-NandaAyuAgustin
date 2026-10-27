// ===== Konfigurasi & state =====
const API_URL = "https://api-web.dnccudinus.org/api/mobil";
const FALLBACK_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#1e2450"/><text x="400" y="260" fill="#a3a9cf" font-family="sans-serif" font-size="28" text-anchor="middle">Foto tidak tersedia</text></svg>'
);

let cars = [];

const $ = (id) => document.getElementById(id);
const grid = $("carGrid");
const modal = $("carModal");
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

// ===== Helper DOM =====
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusLabel(status) {
  return status === "tersedia" ? "Tersedia" : "Terjual";
}

// ===== Ambil data dari API =====
async function loadCars() {
  showSkeleton();
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Server menjawab dengan status " + response.status);
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) throw new Error("Format data tidak sesuai");

    cars = result.data;
    fillFilters();
    updateStats();
    render();
  } catch (error) {
    console.error("Gagal mengambil data mobil:", error);
    showMessage("Data mobil belum bisa dimuat", "Periksa koneksi internet kamu, lalu coba lagi.", true);
    $("resultInfo").textContent = "Gagal memuat data.";
  }
}

// ===== Tampilan status =====
function showSkeleton() {
  grid.replaceChildren(...Array.from({ length: 6 }, () => el("div", "skeleton")));
}

function showMessage(title, text, withRetry = false) {
  const box = el("div", "message");
  box.append(el("h3", "", title), el("p", "", text));
  if (withRetry) {
    const btn = el("button", "btn", "Coba lagi");
    btn.addEventListener("click", loadCars);
    box.append(btn);
  }
  grid.replaceChildren(box);
}

// ===== Filter, urutan, dan render =====
function fillFilters() {
  const uniq = (key) => [...new Set(cars.map((c) => c[key]))].sort();
  const addOptions = (select, values) => values.forEach((v) => select.append(new Option(v, v)));
  addOptions($("brandFilter"), uniq("brand"));
  addOptions($("fuelFilter"), uniq("bahan_bakar"));
}

function getVisibleCars() {
  const keyword = $("searchInput").value.trim().toLowerCase();
  const brand = $("brandFilter").value;
  const fuel = $("fuelFilter").value;
  const readyOnly = $("readyOnly").checked;
  const favOnly = $("favOnly").checked;
  const sort = $("sortSelect").value;

  const list = cars.filter((c) =>
    (!keyword || (c.nama + " " + c.brand).toLowerCase().includes(keyword)) &&
    (!brand || c.brand === brand) &&
    (!fuel || c.bahan_bakar === fuel) &&
    (!readyOnly || c.status === "tersedia") &&
    (!favOnly || favorites.has(c.id))
  );

  if (sort === "termurah") list.sort((a, b) => a.harga - b.harga);
  else if (sort === "termahal") list.sort((a, b) => b.harga - a.harga);
  else list.sort((a, b) => b.id - a.id);
  return list;
}

function render() {
  const list = getVisibleCars();
  $("resultInfo").textContent = list.length + " dari " + cars.length + " mobil ditampilkan";

  if (!list.length) {
    showMessage("Mobil tidak ditemukan", "Coba ubah kata kunci atau hapus beberapa filter.");
    return;
  }
  grid.replaceChildren(...list.map(createCard));
}

function createCard(car, index) {
  const card = el("article", "card" + (car.status === "tersedia" ? "" : " is-sold"));
  card.style.animationDelay = Math.min(index, 8) * 60 + "ms";
  card.tabIndex = 0;
  card.setAttribute("aria-label", "Lihat detail " + car.nama);

  const imgWrap = el("div", "card-img");
  const img = el("img");
  img.src = car.foto;
  img.alt = car.nama;
  img.loading = "lazy";
  img.addEventListener("error", () => { img.src = FALLBACK_IMG; }, { once: true });
  imgWrap.append(img, el("span", "badge " + car.status, statusLabel(car.status)), favButton(car));

  const specs = el("ul", "specs");
  [car.tahun, car.transmisi, car.bahan_bakar].forEach((s) => specs.append(el("li", "", s)));

  const foot = el("div", "card-foot");
  foot.append(el("span", "price", rupiah.format(car.harga)), compareButton(car));

  const body = el("div", "card-body");
  body.append(el("span", "card-brand", car.brand), el("h3", "card-title", car.nama), specs, foot);
  card.append(imgWrap, body);

  const open = () => openModal(car);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  return card;
}

// ===== Modal detail =====
function openModal(car) {
  const img = el("img", "modal-img");
  img.src = car.foto;
  img.alt = car.nama;
  img.addEventListener("error", () => { img.src = FALLBACK_IMG; }, { once: true });

  const detail = el("dl", "detail");
  [["Merek", car.brand], ["Tahun", car.tahun], ["Transmisi", car.transmisi], ["Bahan bakar", car.bahan_bakar], ["Status", statusLabel(car.status)], ["Harga", rupiah.format(car.harga)]]
    .forEach(([label, value]) => {
      const box = el("div");
      box.append(el("dt", "", label), el("dd", "", String(value)));
      detail.append(box);
    });

  const title = el("h3", "", car.nama);
  title.id = "modalTitle";
  const sold = car.status !== "tersedia";
  const action = el("button", "btn", sold ? "Unit sudah terjual" : "Pesan mobil ini");
  action.type = "button";
  action.disabled = sold;
  action.addEventListener("click", () => openOrder(car));

  const content = el("div", "modal-content");
  content.append(title, detail, action);
  $("modalBody").replaceChildren(img, content);
  modal.showModal();
}

$("modalClose").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

// ===== Statistik hero (angka berjalan, easeOutCubic) =====
function countUp(node, target, { decimals = 0, suffix = "", delay = 0, duration = 1500 }) {
  setTimeout(() => {
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const value = target * (1 - Math.pow(1 - p, 3));
      node.textContent = value.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, delay);
}

function updateStats() {
  const ready = cars.filter((c) => c.status === "tersedia").length;
  const minPrice = Math.min(...cars.map((c) => c.harga)) / 1e6;
  const items = [
    ["statTotal", cars.length, { suffix: "" }],
    ["statReady", (ready / cars.length) * 100, { suffix: "%" }],
    ["statBrand", new Set(cars.map((c) => c.brand)).size, { suffix: "" }],
    ["statPrice", minPrice, { suffix: " Jt" }],
  ];
  const box = document.querySelector(".stats");
  const observer = new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    items.forEach(([id, target, opts], i) =>
      countUp($(id), target, { ...opts, delay: 480 + i * 90, duration: 1500 + i * 80 }));
  }, { threshold: 0.25 });
  observer.observe(box);
}

// ===== Event listener =====
["searchInput", "brandFilter", "fuelFilter", "sortSelect", "readyOnly", "favOnly"].forEach((id) => {
  $(id).addEventListener(id === "searchInput" ? "input" : "change", render);
});

const navToggle = $("navToggle");
const navLinks = $("navLinks");
const overlay = $("menuOverlay");

function setMenu(open) {
  navLinks.classList.toggle("open", open);
  overlay.classList.toggle("show", open);
  document.body.classList.toggle("menu-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
}

navToggle.addEventListener("click", () => setMenu(!navLinks.classList.contains("open")));
overlay.addEventListener("click", () => setMenu(false));
navLinks.addEventListener("click", (e) => { if (e.target.tagName === "A") setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
window.addEventListener("resize", () => { if (window.innerWidth > 720) setMenu(false); });

// Tandai menu aktif sesuai bagian yang sedang dilihat
const sections = ["beranda", "katalog", "keunggulan", "kontak"];
const menuLinks = navLinks.querySelectorAll("a:not(.sheet-cta)");
const spy = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    menuLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
sections.forEach((id) => spy.observe($(id)));

// ===== Penyimpanan lokal =====
const store = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* abaikan */ } },
};

// ===== Notifikasi kecil =====
function toast(message) {
  const node = el("div", "toast", message);
  $("toastBox").append(node);
  setTimeout(() => node.remove(), 2600);
}

// ===== Favorit =====
const favorites = new Set(store.read("borcelle-fav", []));

function updateFavCount() {
  $("favCount").textContent = favorites.size;
}

function favButton(car) {
  const btn = el("button", "fav-btn" + (favorites.has(car.id) ? " on" : ""));
  btn.type = "button";
  btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
  btn.setAttribute("aria-label", "Favoritkan " + car.nama);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const on = !favorites.has(car.id);
    if (on) favorites.add(car.id); else favorites.delete(car.id);
    store.write("borcelle-fav", [...favorites]);
    btn.classList.toggle("on", on);
    updateFavCount();
    toast(on ? car.nama + " masuk favorit" : "Dihapus dari favorit");
    if ($("favOnly").checked) render();
  });
  return btn;
}

$("favNav").addEventListener("click", () => {
  $("favOnly").checked = !$("favOnly").checked;
  render();
  $("katalog").scrollIntoView({ behavior: "smooth" });
});

// ===== Bandingkan harga (maks. 3 mobil) =====
const MAX_COMPARE = 3;
let compareList = [];

function compareButton(car) {
  const picked = compareList.includes(car.id);
  const btn = el("button", "cmp-btn" + (picked ? " on" : ""), picked ? "Dipilih" : "Bandingkan");
  btn.type = "button";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const index = compareList.indexOf(car.id);
    if (index >= 0) compareList.splice(index, 1);
    else if (compareList.length >= MAX_COMPARE) return toast("Maksimal " + MAX_COMPARE + " mobil");
    else compareList.push(car.id);
    btn.classList.toggle("on", index < 0);
    btn.textContent = index < 0 ? "Dipilih" : "Bandingkan";
    renderCompareBar();
  });
  return btn;
}

function renderCompareBar() {
  const picked = compareList.map((id) => cars.find((c) => c.id === id));
  $("compareBar").classList.toggle("show", picked.length > 0);
  $("compareThumbs").replaceChildren(...picked.map((c) => {
    const img = el("img");
    img.src = c.foto;
    img.alt = c.nama;
    return img;
  }));
  $("compareGo").disabled = picked.length < 2;
  $("compareGo").textContent = picked.length < 2 ? "Pilih minimal 2 mobil" : "Bandingkan " + picked.length + " mobil";
}

$("compareClear").addEventListener("click", () => {
  compareList = [];
  grid.querySelectorAll(".cmp-btn.on").forEach((b) => { b.classList.remove("on"); b.textContent = "Bandingkan"; });
  renderCompareBar();
});

$("compareGo").addEventListener("click", () => {
  const picked = compareList.map((id) => cars.find((c) => c.id === id));
  const cheapest = Math.min(...picked.map((c) => c.harga));
  const priciest = Math.max(...picked.map((c) => c.harga));

  const columns = picked.map((c) => {
    const img = el("img");
    img.src = c.foto;
    img.alt = c.nama;
    img.addEventListener("error", () => { img.src = FALLBACK_IMG; }, { once: true });

    const bar = el("div", "cmp-bar");
    const fill = el("span");
    fill.style.setProperty("--w", (c.harga / priciest) * 100 + "%");
    bar.append(fill);

    const isBest = c.harga === cheapest;
    const diff = isBest ? "Paling murah" : "+" + rupiah.format(c.harga - cheapest) + " dari yang termurah";

    const specs = el("dl", "cmp-specs");
    [["Tahun", c.tahun], ["Transmisi", c.transmisi], ["Bahan bakar", c.bahan_bakar], ["Status", statusLabel(c.status)]]
      .forEach(([label, value]) => {
        const row = el("div");
        row.append(el("dt", "", label), el("dd", "", String(value)));
        specs.append(row);
      });

    const col = el("article", "cmp-col");
    col.append(img, el("span", "card-brand", c.brand), el("h4", "", c.nama),
      el("p", "cmp-price", rupiah.format(c.harga)), bar, el("p", "cmp-diff" + (isBest ? " best" : ""), diff), specs);
    return col;
  });

  $("compareBody").style.setProperty("--n", picked.length);
  $("compareBody").replaceChildren(...columns);
  $("compareDialog").showModal();
});

// ===== Pesan mobil =====
let orderCar = null;

function openOrder(car) {
  orderCar = car;
  $("orderCar").textContent = car.nama + " - " + rupiah.format(car.harga);
  $("orderDate").min = new Date().toISOString().slice(0, 10);
  modal.close();
  $("orderDialog").showModal();
}

$("orderForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const order = { id: Date.now(), mobil: orderCar.nama, nama: data.get("nama"), hp: data.get("hp"), jenis: data.get("jenis"), tanggal: data.get("tanggal") };
  store.write("borcelle-pesanan", [...store.read("borcelle-pesanan", []), order]);

  const text = "Halo Borcelle Showroom, saya " + order.nama + " ingin " + order.jenis.toLowerCase() + " " + order.mobil +
    " (" + rupiah.format(orderCar.harga) + ") pada " + order.tanggal + ". No. HP: " + order.hp;
  window.open("https://wa.me/6282189001185?text=" + encodeURIComponent(text), "_blank", "noopener");

  e.target.reset();
  $("orderDialog").close();
  toast("Pesanan terkirim, kami hubungi lewat WhatsApp");
});

// ===== Dialog: tombol tutup & klik latar =====
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

// ===== Efek miring kartu mengikuti kursor =====
grid.addEventListener("pointermove", (e) => {
  const card = e.target.closest(".card");
  if (!card || e.pointerType !== "mouse") return;
  const r = card.getBoundingClientRect();
  card.style.setProperty("--rx", ((e.clientY - r.top) / r.height - .5) * -8 + "deg");
  card.style.setProperty("--ry", ((e.clientX - r.left) / r.width - .5) * 8 + "deg");
});
grid.addEventListener("pointerout", (e) => {
  const card = e.target.closest(".card");
  if (card) { card.style.removeProperty("--rx"); card.style.removeProperty("--ry"); }
});

// ===== Kartu keunggulan muncul saat di-scroll =====
const reveal = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); reveal.unobserve(en.target); } });
}, { threshold: 0.4 });
document.querySelectorAll(".feature-list article").forEach((a, i) => { a.style.transitionDelay = i * 120 + "ms"; reveal.observe(a); });

updateFavCount();

loadCars();


// ===== Video latar bergantian (video_1 dan video_2) dengan crossfade =====
const bgClips = [...document.querySelectorAll(".bg-video")];
let bgIndex = 0;
let bgSwitching = false;

function nextClip() {
  if (bgSwitching || bgClips.length < 2) return;
  bgSwitching = true;
  const outgoing = bgClips[bgIndex];
  bgIndex = (bgIndex + 1) % bgClips.length;
  const incoming = bgClips[bgIndex];
  incoming.currentTime = 0;
  incoming.play().catch(() => {});
  incoming.classList.add("on");
  outgoing.classList.remove("on");
  setTimeout(() => { outgoing.pause(); bgSwitching = false; }, 1300);
}

bgClips.forEach((clip) => {
  clip.addEventListener("timeupdate", () => {
    // Mulai pindah 1 detik sebelum video habis agar transisinya halus
    if (clip === bgClips[bgIndex] && clip.duration && clip.duration - clip.currentTime < 1) nextClip();
  });
  clip.addEventListener("ended", nextClip);
});

// ===== Kolom pencarian: tombol hapus dan pintasan "/" =====
const searchBox = document.querySelector(".search");
const searchInput = $("searchInput");

searchInput.addEventListener("input", () => searchBox.classList.toggle("has-text", searchInput.value !== ""));
$("searchClear").addEventListener("click", () => {
  searchInput.value = "";
  searchInput.dispatchEvent(new Event("input"));
  searchInput.focus();
});
document.addEventListener("keydown", (e) => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
  if (e.key === "/" && !typing && !document.querySelector("dialog[open]")) {
    e.preventDefault();
    searchInput.focus();
    searchInput.scrollIntoView({ block: "center", behavior: "smooth" });
  }
});
