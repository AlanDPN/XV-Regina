const DRIVE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz3lVM3Vac5MvwBQln_Z8Mow3mHiwwAr2HJOi-ABh65YWuPVsJj-Gb_GFCxToTsr0jXgA/exec";

// ID de implementacion: AKfycbz3lVM3Vac5MvwBQln_Z8Mow3mHiwwAr2HJOi - ABh65YWuPVsJj - Gb_GFCxToTsr0jXgA

const state = {
  currentGuest: localStorage.getItem("xv_guest_name") || "",
};

const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const loginGuestName = document.getElementById("loginGuestName");
const loginStatus = document.getElementById("loginStatus");

const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const sections = Array.from(document.querySelectorAll(".view"));
const guestInput = document.getElementById("guestName");
const guestBadge = document.getElementById("guestBadge");
const uploadForm = document.getElementById("uploadForm");
const uploadStatus = document.getElementById("uploadStatus");
const albumStatus = document.getElementById("albumStatus");
const albumContainer = document.getElementById("albumContainer");
const refreshAlbumBtn = document.getElementById("refreshAlbum");

navLinks.forEach((btn) => {
  btn.addEventListener("click", () => showSection(btn.dataset.section));
});

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = loginGuestName.value.trim();

  if (!name) {
    setText(loginStatus, "Escribe tu nombre para entrar.");
    return;
  }

  setGuest(name);
  hideLogin();
});

uploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = (guestInput.value || "").trim();
  const files = document.getElementById("photoFiles").files;

  if (!name) {
    setText(uploadStatus, "Debes iniciar sesion con tu nombre.");
    showLogin();
    return;
  }

  if (!files || files.length === 0) {
    setText(uploadStatus, "Selecciona al menos una imagen.");
    return;
  }

  if (!DRIVE_WEB_APP_URL) {
    setText(uploadStatus, "Falta configurar DRIVE_WEB_APP_URL en app.js.");
    await saveLocalPhotos(name, files);
    setText(uploadStatus, "Guardadas localmente para prueba. Configura Drive para publicarlas.");
    renderAlbumFromLocal();
    return;
  }

  try {
    setText(uploadStatus, "Subiendo imagenes...");
    for (const file of files) {
      const fd = new FormData();
      fd.append("guestName", name);
      fd.append("photo", file);

      const response = await fetch(DRIVE_WEB_APP_URL, {
        method: "POST",
        body: fd,
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }
    }

    setText(uploadStatus, "Imagenes subidas correctamente.");
    uploadForm.reset();
    guestInput.value = state.currentGuest;
    await loadAlbum();
  } catch (error) {
    console.error(error);
    setText(uploadStatus, "No se pudieron subir las imagenes. Revisa la configuracion de Apps Script.");
  }
});

refreshAlbumBtn?.addEventListener("click", async () => {
  await loadAlbum();
});

init();

function init() {
  showSection("inicio");
  loadAlbum();

  if (state.currentGuest) {
    applyGuestUI(state.currentGuest);
    hideLogin();
  } else {
    showLogin();
  }
}

function showSection(sectionId) {
  navLinks.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.section === sectionId));
  sections.forEach((section) => section.classList.toggle("is-active", section.id === sectionId));
}

function setGuest(name) {
  state.currentGuest = name;
  localStorage.setItem("xv_guest_name", name);
  applyGuestUI(name);
}

function applyGuestUI(name) {
  if (guestInput) guestInput.value = name;
  if (guestBadge) guestBadge.textContent = `Invitado: ${name}`;
}

function showLogin() {
  loginOverlay?.classList.remove("hidden");
}

function hideLogin() {
  loginOverlay?.classList.add("hidden");
}

async function loadAlbum() {
  if (!DRIVE_WEB_APP_URL) {
    setText(albumStatus, "Modo local activo. Configura DRIVE_WEB_APP_URL para leer desde Google Drive.");
    renderAlbumFromLocal();
    return;
  }

  try {
    setText(albumStatus, "Cargando album...");
    const response = await fetch(`${DRIVE_WEB_APP_URL}?action=list`, { method: "GET" });
    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);

    const data = await response.json();
    renderAlbum(data.groups || []);
    setText(albumStatus, data.groups?.length ? "" : "Aun no hay fotos en el album.");
  } catch (error) {
    console.error(error);
    setText(albumStatus, "No fue posible cargar el album desde Drive.");
  }
}

function renderAlbum(groups) {
  albumContainer.innerHTML = "";

  for (const group of groups) {
    const card = document.createElement("article");
    card.className = "group";

    const title = document.createElement("h3");
    title.textContent = group.guestName;

    const photos = document.createElement("div");
    photos.className = "photos";

    for (const photo of group.photos) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = photo.url;
      img.alt = `Foto subida por ${group.guestName}`;
      photos.appendChild(img);
    }

    card.append(title, photos);
    albumContainer.appendChild(card);
  }
}

async function saveLocalPhotos(guestName, files) {
  const store = JSON.parse(localStorage.getItem("xv_local_photos") || "[]");

  const readers = Array.from(files).map(
    (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ guestName, url: reader.result });
        reader.readAsDataURL(file);
      })
  );

  const items = await Promise.all(readers);
  const next = store.concat(items);
  localStorage.setItem("xv_local_photos", JSON.stringify(next));
}

function renderAlbumFromLocal() {
  const flat = JSON.parse(localStorage.getItem("xv_local_photos") || "[]");
  const map = new Map();

  for (const item of flat) {
    if (!map.has(item.guestName)) {
      map.set(item.guestName, []);
    }
    map.get(item.guestName).push({ url: item.url });
  }

  const groups = Array.from(map.entries()).map(([guestName, photos]) => ({
    guestName,
    photos,
  }));

  renderAlbum(groups);
  setText(albumStatus, groups.length ? "" : "Aun no hay fotos cargadas.");
}

function setText(el, text) {
  if (el) el.textContent = text;
}
