const DRIVE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz3lVM3Vac5MvwBQln_Z8Mow3mHiwwAr2HJOi-ABh65YWuPVsJj-Gb_GFCxToTsr0jXgA/exec";

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
const themeToggle = document.getElementById("themeToggle");
const uploadForm = document.getElementById("uploadForm");
const uploadStatus = document.getElementById("uploadStatus");
const photoInput = document.getElementById("photoFiles");
const dropZone = document.getElementById("dropZone");
const uploadPreview = document.getElementById("uploadPreview");
const albumStatus = document.getElementById("albumStatus");
const albumContainer = document.getElementById("albumContainer");
const refreshAlbumBtn = document.getElementById("refreshAlbum");

let pendingFiles = [];
let previewObjectUrls = [];

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
  const files = pendingFiles;

  if (!name) {
    setText(uploadStatus, "Debes iniciar sesion con tu nombre.");
    showLogin();
    return;
  }

  if (!files.length) {
    setText(uploadStatus, "Selecciona al menos una imagen.");
    return;
  }

  if (!DRIVE_WEB_APP_URL) {
    setText(uploadStatus, "Falta configurar DRIVE_WEB_APP_URL en app.js.");
    await saveLocalPhotos(name, files);
    setText(uploadStatus, "Guardadas localmente para prueba. Configura Drive para publicarlas.");
    clearPendingFiles();
    renderAlbumFromLocal();
    return;
  }

  try {
    setText(uploadStatus, "Subiendo imagenes...");
    for (const file of files) {
      const payload = await fileToPayload(name, file);

      const response = await fetch(DRIVE_WEB_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.message || "Error en Apps Script al subir imagen");
      }
    }

    setText(uploadStatus, "Imagenes subidas correctamente.");
    uploadForm.reset();
    guestInput.value = state.currentGuest;
    clearPendingFiles();
    await loadAlbum();
  } catch (error) {
    console.error(error);
    setText(uploadStatus, `No se pudieron subir las imagenes. ${error.message || "Revisa la configuracion de Apps Script."}`);
  }
});

refreshAlbumBtn?.addEventListener("click", async () => {
  await loadAlbum();
});

themeToggle?.addEventListener("click", toggleTheme);

init();

function init() {
  applySavedTheme();
  setupUploadInteractions();
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
    if (!data.ok) throw new Error(data.message || "Error al listar album");
    renderAlbum(data.groups || []);
    setText(albumStatus, data.groups?.length ? "" : "Aun no hay fotos en el album.");
  } catch (error) {
    console.error(error);
    setText(albumStatus, `No fue posible cargar el album desde Drive. ${error.message || ""}`);
  }
}

function renderAlbum(groups) {
  albumContainer.innerHTML = "";

  for (const group of groups) {
    const photos = Array.isArray(group.photos) ? group.photos : [];
    if (!photos.length) continue;

    const card = document.createElement("article");
    card.className = "group";

    const title = document.createElement("h3");
    title.textContent = group.guestName;

    const carousel = document.createElement("div");
    carousel.className = "carousel";

    const prevBtn = document.createElement("button");
    prevBtn.className = "carousel-btn";
    prevBtn.type = "button";
    prevBtn.textContent = "<";
    prevBtn.setAttribute("aria-label", "Imagen anterior");

    const nextBtn = document.createElement("button");
    nextBtn.className = "carousel-btn";
    nextBtn.type = "button";
    nextBtn.textContent = ">";
    nextBtn.setAttribute("aria-label", "Imagen siguiente");

    const img = document.createElement("img");
    img.className = "carousel-image";
    img.loading = "lazy";
    img.alt = `Foto subida por ${group.guestName}`;

    const count = document.createElement("p");
    count.className = "carousel-count";

    let currentIndex = 0;
    const total = photos.length;

    const paintImage = () => {
      const current = photos[currentIndex];
      img.src = current.url;
      img.onerror = () => {
        const driveId = extractDriveFileId(current.url);
        if (!driveId) return;

        const fallback1 = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
        const fallback2 = `https://lh3.googleusercontent.com/d/${driveId}=w1600`;

        if (img.src !== fallback1) {
          img.src = fallback1;
          return;
        }

        if (img.src !== fallback2) {
          img.src = fallback2;
        }
      };
      count.textContent = `Foto ${currentIndex + 1} de ${total}`;
    };

    prevBtn.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + total) % total;
      paintImage();
    });

    nextBtn.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % total;
      paintImage();
    });

    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;

    const onTouchStart = (event) => {
      if (!event.touches || event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      isSwiping = true;
    };

    const onTouchEnd = (event) => {
      if (!isSwiping || !event.changedTouches || !event.changedTouches.length) return;
      isSwiping = false;

      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const deltaX = endX - touchStartX;
      const deltaY = endY - touchStartY;

      // Swipe horizontal: exige distancia minima y evita conflicto con scroll vertical.
      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;

      if (deltaX < 0) {
        currentIndex = (currentIndex + 1) % total;
      } else {
        currentIndex = (currentIndex - 1 + total) % total;
      }
      paintImage();
    };

    img.addEventListener("touchstart", onTouchStart, { passive: true });
    img.addEventListener("touchend", onTouchEnd, { passive: true });

    if (total === 1) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    }

    carousel.append(prevBtn, img, nextBtn);
    paintImage();

    card.append(title, carousel, count);
    albumContainer.appendChild(card);
  }
}

async function fileToPayload(guestName, file) {
  const dataUrl = await readAsDataURL(file);
  const base64 = String(dataUrl).split(",")[1] || "";

  return {
    guestName,
    fileName: file.name || `foto-${Date.now()}.jpg`,
    mimeType: file.type || "image/jpeg",
    dataBase64: base64,
  };
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
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

function extractDriveFileId(url) {
  if (!url) return "";

  const idParam = String(url).match(/[?&]id=([^&]+)/);
  if (idParam && idParam[1]) return idParam[1];

  const pathMatch = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch && pathMatch[1]) return pathMatch[1];

  return "";
}

function setupUploadInteractions() {
  photoInput?.addEventListener("change", () => {
    setPendingFiles(Array.from(photoInput.files || []));
  });

  dropZone?.addEventListener("click", (event) => {
    if (event.target !== photoInput) {
      photoInput?.click();
    }
  });

  dropZone?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      photoInput?.click();
    }
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone?.addEventListener(evt, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropZone?.addEventListener(evt, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone?.addEventListener("drop", (event) => {
    const files = Array.from(event.dataTransfer?.files || []);
    setPendingFiles(files);
  });
}

function setPendingFiles(files) {
  const images = files.filter((file) => file.type.startsWith("image/"));
  pendingFiles = images;
  syncNativeInputFiles();
  renderUploadPreview();
}

function clearPendingFiles() {
  pendingFiles = [];
  syncNativeInputFiles();
  renderUploadPreview();
}

function syncNativeInputFiles() {
  if (!photoInput) return;
  const dt = new DataTransfer();
  pendingFiles.forEach((file) => dt.items.add(file));
  photoInput.files = dt.files;
}

function renderUploadPreview() {
  if (!uploadPreview) return;

  previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  previewObjectUrls = [];
  uploadPreview.innerHTML = "";

  pendingFiles.forEach((file) => {
    const item = document.createElement("div");
    item.className = "preview-item";

    const img = document.createElement("img");
    const objectUrl = URL.createObjectURL(file);
    previewObjectUrls.push(objectUrl);
    img.src = objectUrl;
    img.alt = `Preview ${file.name}`;

    item.appendChild(img);
    uploadPreview.appendChild(item);
  });
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem("xv_theme");
  const darkModeEnabled = savedTheme === "dark";
  document.body.classList.toggle("dark-mode", darkModeEnabled);
  paintThemeButton(darkModeEnabled);
}

function toggleTheme() {
  const darkModeEnabled = !document.body.classList.contains("dark-mode");
  document.body.classList.toggle("dark-mode", darkModeEnabled);
  localStorage.setItem("xv_theme", darkModeEnabled ? "dark" : "light");
  paintThemeButton(darkModeEnabled);
}

function paintThemeButton(darkModeEnabled) {
  if (!themeToggle) return;
  themeToggle.textContent = "☾";
  themeToggle.setAttribute("aria-label", darkModeEnabled ? "Activar modo claro" : "Activar modo oscuro");
}
