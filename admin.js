(function () {
  const loginView = document.getElementById("login-view");
  const adminView = document.getElementById("admin-view");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const uploadStatus = document.getElementById("upload-status");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const homepageSlots = document.getElementById("homepage-slots");
  const photoLibrary = document.getElementById("photo-library");
  const libraryCount = document.getElementById("library-count");
  const libraryFilters = document.getElementById("library-filters");
  const photoLightbox = document.getElementById("photo-lightbox");
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxClose = document.getElementById("lightbox-close");
  const slotPicker = document.getElementById("slot-picker");
  const slotPickerBackdrop = document.getElementById("slot-picker-backdrop");
  const slotPickerClose = document.getElementById("slot-picker-close");
  const slotPickerTitle = document.getElementById("slot-picker-title");
  const slotPickerGrid = document.getElementById("slot-picker-grid");
  const inquiryList = document.getElementById("inquiry-list");
  const newCount = document.getElementById("new-count");
  const accountForm = document.getElementById("account-form");
  const accountEmail = document.getElementById("account-email");
  const accountStatus = document.getElementById("account-status");
  const adminDropdown = document.getElementById("admin-dropdown");
  const adminDropdownToggle = document.getElementById("admin-dropdown-toggle");
  const adminDropdownMenu = document.getElementById("admin-dropdown-menu");
  const adminDropdownLabel = document.getElementById("admin-dropdown-label");

  const tabLabels = {
    photos: "Photos",
    inquiries: "Inquiries",
    account: "Account",
  };

  const HOMEPAGE_SLOTS = [
    { id: "hero", label: "Hero", hint: "Large image beside headline" },
    { id: "featured-1", label: "Slot 1", hint: "Featured project" },
    { id: "featured-2", label: "Slot 2", hint: "Featured project" },
    { id: "featured-3", label: "Slot 3", hint: "Featured project" },
  ];

  const SLOT_OPTIONS = [
    { value: "gallery", label: "Gallery only" },
    { value: "hero", label: "Homepage hero" },
    { value: "featured-1", label: "Homepage slot 1" },
    { value: "featured-2", label: "Homepage slot 2" },
    { value: "featured-3", label: "Homepage slot 3" },
  ];

  let photos = [];
  let submissions = [];
  let libraryFilter = "all";
  let activeSlotPicker = null;
  const apiBase = window.ADMIN_API_BASE || "";

  async function api(path, options) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options && options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(options && options.headers ? options.headers : {}),
      },
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }

  function showLogin() {
    document.body.classList.remove("admin-authed");
  }

  function showAdmin() {
    document.body.classList.add("admin-authed");
  }

  function showLoginSuccess() {
    return new Promise(function (resolve) {
      const toast = document.createElement("div");
      toast.className = "login-success-toast";
      toast.setAttribute("role", "status");
      toast.innerHTML =
        '<div class="login-success-card"><span class="login-success-icon" aria-hidden="true">✓</span><span>Successfully logged in</span></div>';
      document.body.appendChild(toast);

      requestAnimationFrame(function () {
        toast.classList.add("is-visible");
      });

      window.setTimeout(function () {
        toast.classList.remove("is-visible");
        window.setTimeout(function () {
          toast.remove();
          resolve();
        }, 280);
      }, 1200);
    });
  }

  function setLoginError(message) {
    if (!message) {
      loginError.hidden = true;
      loginError.textContent = "";
      return;
    }
    loginError.hidden = false;
    loginError.textContent = message;
  }

  function setUploadStatus(message, isError) {
    uploadStatus.textContent = message || "";
    uploadStatus.classList.toggle("is-error", Boolean(isError));
  }

  function formatDate(value) {
    return new Date(value).toLocaleString();
  }

  function buildMailto(email, subject, body) {
    const params = new URLSearchParams();
    params.set("subject", subject);
    params.set("body", body);
    return `mailto:${encodeURIComponent(email)}?${params.toString()}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function photoBySlot(slotId) {
    return photos.find(function (photo) {
      return photo.slot === slotId;
    });
  }

  function filteredPhotos() {
    if (libraryFilter === "homepage") {
      return photos.filter(function (photo) {
        return photo.slot === "hero" || /^featured-[1-3]$/.test(photo.slot);
      });
    }
    if (libraryFilter === "gallery") {
      return photos.filter(function (photo) {
        return photo.slot === "gallery";
      });
    }
    return photos.slice();
  }

  function openLightbox(photo) {
    lightboxImage.src = photo.url;
    lightboxImage.alt = photo.title;
    lightboxCaption.textContent = photo.title;
    photoLightbox.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeLightbox() {
    photoLightbox.hidden = true;
    lightboxImage.removeAttribute("src");
    document.body.classList.remove("modal-open");
  }

  function openSlotPicker(slotId, slotLabel) {
    activeSlotPicker = slotId;
    slotPickerTitle.textContent = `Choose photo for ${slotLabel}`;
    slotPickerGrid.innerHTML = "";

    photos.forEach(function (photo) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-picker-item";
      button.innerHTML = `
        <img src="${photo.url}" alt="${escapeHtml(photo.title)}" />
        <span>${escapeHtml(photo.title)}</span>
      `;
      button.addEventListener("click", async function () {
        await api(`/photos/${photo.id}`, {
          method: "PATCH",
          body: JSON.stringify({ slot: slotId }),
        });
        closeSlotPicker();
        await loadPhotos();
        setUploadStatus(`Assigned to ${slotLabel.toLowerCase()}.`);
      });
      slotPickerGrid.appendChild(button);
    });

    slotPicker.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeSlotPicker() {
    slotPicker.hidden = true;
    activeSlotPicker = null;
    document.body.classList.remove("modal-open");
  }

  function renderHomepageSlots() {
    homepageSlots.innerHTML = "";

    HOMEPAGE_SLOTS.forEach(function (slot) {
      const photo = photoBySlot(slot.id);
      const card = document.createElement("article");
      card.className = "homepage-slot";

      if (photo) {
        card.innerHTML = `
          <div class="homepage-slot-label">
            <strong>${slot.label}</strong>
            <span>${slot.hint}</span>
          </div>
          <button class="homepage-slot-preview" type="button" data-preview="${photo.id}">
            <img src="${photo.url}" alt="${escapeHtml(photo.title)}" />
          </button>
          <label class="homepage-slot-title">Title
            <input type="text" value="${escapeHtml(photo.title)}" data-title="${photo.id}" />
          </label>
          <div class="homepage-slot-actions">
            <button class="btn btn-ghost" type="button" data-change="${slot.id}">Change photo</button>
            <button class="btn btn-ghost" type="button" data-clear="${photo.id}">Move to gallery</button>
          </div>
        `;

        card.querySelector("[data-preview]").addEventListener("click", function () {
          openLightbox(photo);
        });

        const titleInput = card.querySelector("[data-title]");
        titleInput.addEventListener("change", async function () {
          const title = titleInput.value.trim();
          if (!title || title === photo.title) {
            return;
          }
          await api(`/photos/${photo.id}`, {
            method: "PATCH",
            body: JSON.stringify({ title }),
          });
          await loadPhotos();
        });

        card.querySelector("[data-change]").addEventListener("click", function () {
          openSlotPicker(slot.id, slot.label);
        });

        card.querySelector("[data-clear]").addEventListener("click", async function () {
          await api(`/photos/${photo.id}`, {
            method: "PATCH",
            body: JSON.stringify({ slot: "gallery" }),
          });
          await loadPhotos();
          setUploadStatus(`${slot.label} cleared — photo moved to gallery.`);
        });
      } else {
        card.innerHTML = `
          <div class="homepage-slot-label">
            <strong>${slot.label}</strong>
            <span>${slot.hint}</span>
          </div>
          <div class="homepage-slot-empty">No photo assigned</div>
          <button class="btn btn-primary" type="button" data-choose="${slot.id}">Choose photo</button>
        `;
        card.querySelector("[data-choose]").addEventListener("click", function () {
          openSlotPicker(slot.id, slot.label);
        });
      }

      homepageSlots.appendChild(card);
    });
  }

  function renderPhotoLibrary() {
    const visiblePhotos = filteredPhotos().sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    libraryCount.textContent = `${photos.length} photo${photos.length === 1 ? "" : "s"} total · showing ${visiblePhotos.length}`;

    photoLibrary.innerHTML = "";

    if (!visiblePhotos.length) {
      photoLibrary.innerHTML = '<p class="empty-state">No photos match this filter yet.</p>';
      return;
    }

    visiblePhotos.forEach(function (photo) {
      const card = document.createElement("article");
      card.className = "library-card";
      const options = SLOT_OPTIONS.map(function (option) {
        const selected = photo.slot === option.value ? " selected" : "";
        return `<option value="${option.value}"${selected}>${option.label}</option>`;
      }).join("");

      card.innerHTML = `
        <button class="library-thumb" type="button" data-preview="${photo.id}">
          <img src="${photo.url}" alt="${escapeHtml(photo.title)}" loading="lazy" />
        </button>
        <div class="library-card-body">
          <label>Title
            <input type="text" value="${escapeHtml(photo.title)}" data-title="${photo.id}" />
          </label>
          <label>Show on
            <select data-slot="${photo.id}">${options}</select>
          </label>
          <div class="library-card-actions">
            <button class="btn btn-ghost" type="button" data-view="${photo.id}">View full size</button>
            <button class="btn btn-danger" type="button" data-delete="${photo.id}">Delete</button>
          </div>
        </div>
      `;

      card.querySelector("[data-preview]").addEventListener("click", function () {
        openLightbox(photo);
      });

      card.querySelector("[data-view]").addEventListener("click", function () {
        openLightbox(photo);
      });

      const titleInput = card.querySelector("[data-title]");
      titleInput.addEventListener("change", async function () {
        const title = titleInput.value.trim();
        if (!title || title === photo.title) {
          return;
        }
        await api(`/photos/${photo.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title }),
        });
        await loadPhotos();
      });

      card.querySelector("[data-slot]").addEventListener("change", async function (event) {
        const slot = event.target.value;
        await api(`/photos/${photo.id}`, {
          method: "PATCH",
          body: JSON.stringify({ slot }),
        });
        await loadPhotos();
        setUploadStatus("Photo placement updated.");
      });

      card.querySelector("[data-delete]").addEventListener("click", async function () {
        if (!window.confirm(`Delete "${photo.title}"? This cannot be undone.`)) {
          return;
        }
        await api(`/photos/${photo.id}`, { method: "DELETE" });
        await loadPhotos();
        setUploadStatus("Photo deleted.");
      });

      photoLibrary.appendChild(card);
    });
  }

  function renderPhotos() {
    renderHomepageSlots();
    renderPhotoLibrary();
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []).filter(function (file) {
      return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
    });

    if (!files.length) {
      setUploadStatus("Choose one or more image files.", true);
      return;
    }

    setUploadStatus(`Uploading ${files.length} photo${files.length === 1 ? "" : "s"}...`);

    const formData = new FormData();
    files.forEach(function (file) {
      formData.append("images", file);
    });
    formData.append("slot", "gallery");

    try {
      const data = await api("/photos/bulk", {
        method: "POST",
        body: formData,
      });
      fileInput.value = "";
      await loadPhotos();
      setUploadStatus(`Added ${data.count} photo${data.count === 1 ? "" : "s"} to the library.`);
    } catch (error) {
      setUploadStatus(error.message, true);
    }
  }

  function setupDropzone() {
    dropzone.addEventListener("click", function () {
      fileInput.click();
    });

    dropzone.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener("change", function () {
      uploadFiles(fileInput.files);
    });

    ["dragenter", "dragover"].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", function (event) {
      uploadFiles(event.dataTransfer && event.dataTransfer.files);
    });
  }

  function setupLibraryFilters() {
    libraryFilters.addEventListener("click", function (event) {
      const button = event.target.closest("[data-filter]");
      if (!button) {
        return;
      }
      libraryFilter = button.dataset.filter;
      libraryFilters.querySelectorAll(".filter-btn").forEach(function (item) {
        item.classList.toggle("is-active", item === button);
      });
      renderPhotoLibrary();
    });
  }

  function renderSubmissions() {
    inquiryList.innerHTML = "";
    const freshCount = submissions.filter(function (item) {
      return item.status === "new";
    }).length;

    if (freshCount > 0) {
      newCount.hidden = false;
      newCount.textContent = String(freshCount);
    } else {
      newCount.hidden = true;
    }

    if (!submissions.length) {
      inquiryList.innerHTML = '<p class="empty-state">No contact requests yet.</p>';
      return;
    }

    submissions.forEach(function (submission) {
      const card = document.createElement("article");
      card.className = "inquiry-card";
      card.innerHTML = `
        <div class="inquiry-meta">
          <div>
            <strong>${submission.name}</strong>
            <div class="inquiry-details">${submission.email} · ${submission.project_type}</div>
          </div>
          <div>
            <span class="status-pill is-${submission.status}">${submission.status}</span>
            <div class="inquiry-details">${formatDate(submission.created_at)}</div>
          </div>
        </div>
        <p class="inquiry-message">${submission.message}</p>
        <div class="inquiry-reply">
          <label>Reply message
            <textarea data-reply-body placeholder="Write your response..."></textarea>
          </label>
          <div class="photo-card-actions">
            <a class="btn btn-primary" data-reply-link href="#" target="_blank" rel="noopener">Open email to respond</a>
            <button class="btn btn-ghost" type="button" data-mark-read>Mark read</button>
            <button class="btn btn-ghost" type="button" data-mark-responded>Mark responded</button>
          </div>
        </div>
      `;

      const bodyField = card.querySelector("[data-reply-body]");
      const replyLink = card.querySelector("[data-reply-link]");
      const defaultBody = `Hi ${submission.name},\n\nThank you for reaching out to Cotton Elder Construction about your ${submission.project_type.toLowerCase()} project.\n\n`;
      bodyField.value = defaultBody;

      function updateReplyLink() {
        replyLink.href = buildMailto(
          submission.email,
          `Re: Your Cotton Elder Construction inquiry`,
          bodyField.value
        );
      }

      bodyField.addEventListener("input", updateReplyLink);
      updateReplyLink();

      card.querySelector("[data-mark-read]").addEventListener("click", async function () {
        await api(`/submissions/${submission.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "read" }),
        });
        await loadSubmissions();
      });

      card.querySelector("[data-mark-responded]").addEventListener("click", async function () {
        await api(`/submissions/${submission.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "responded" }),
        });
        await loadSubmissions();
      });

      replyLink.addEventListener("click", async function () {
        if (submission.status === "new") {
          await api(`/submissions/${submission.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "read" }),
          });
          await loadSubmissions();
        }
      });

      inquiryList.appendChild(card);
    });
  }

  async function loadPhotos() {
    const data = await api("/photos");
    photos = data.photos;
    renderPhotos();
  }

  async function loadSubmissions() {
    const data = await api("/submissions");
    submissions = data.submissions;
    renderSubmissions();
  }

  async function loadAccount() {
    const data = await api("/account");
    if (accountEmail) {
      accountEmail.value = data.email;
    }
  }

  async function bootAdmin() {
    await loadPhotos();
    await loadSubmissions();
    await loadAccount();
    showAdmin();
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setLoginError("");
    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginForm.email.value,
          password: loginForm.password.value,
        }),
      });
      await showLoginSuccess();
      loginForm.reset();
      await bootAdmin();
    } catch (error) {
      setLoginError(error.message);
    }
  });

  logoutBtn.addEventListener("click", async function () {
    await api("/logout", { method: "POST" }).catch(function () {});
    showLogin();
  });

  if (accountForm) {
    accountForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      accountStatus.textContent = "Saving...";
      const payload = {
        email: accountForm.email.value.trim(),
        current_password: accountForm.current_password.value,
      };
      if (accountForm.new_password.value.trim()) {
        payload.new_password = accountForm.new_password.value;
      }
      try {
        const data = await api("/account", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        accountForm.current_password.value = "";
        accountForm.new_password.value = "";
        accountEmail.value = data.email;
        accountStatus.textContent = "Account updated.";
      } catch (error) {
        accountStatus.textContent = error.message;
      }
    });
  }

  function closeAdminDropdown() {
    if (!adminDropdownToggle || !adminDropdownMenu) {
      return;
    }
    adminDropdownToggle.setAttribute("aria-expanded", "false");
    adminDropdownMenu.hidden = true;
  }

  function openAdminDropdown() {
    if (!adminDropdownToggle || !adminDropdownMenu) {
      return;
    }
    adminDropdownToggle.setAttribute("aria-expanded", "true");
    adminDropdownMenu.hidden = false;
  }

  function switchAdminTab(tabName) {
    document.querySelectorAll(".admin-dropdown-option").forEach(function (option) {
      option.classList.toggle("is-active", option.dataset.tab === tabName);
    });
    document.querySelectorAll(".admin-panel").forEach(function (panel) {
      panel.classList.remove("is-active");
    });
    const panel = document.getElementById(`${tabName}-panel`);
    if (panel) {
      panel.classList.add("is-active");
    }
    if (adminDropdownLabel && tabLabels[tabName]) {
      adminDropdownLabel.textContent = tabLabels[tabName];
    }
    closeAdminDropdown();
  }

  if (adminDropdownToggle && adminDropdownMenu) {
    adminDropdownToggle.addEventListener("click", function () {
      const isOpen = adminDropdownToggle.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeAdminDropdown();
      } else {
        openAdminDropdown();
      }
    });

    document.querySelectorAll(".admin-dropdown-option").forEach(function (option) {
      option.addEventListener("click", function () {
        switchAdminTab(option.dataset.tab);
      });
    });

    document.addEventListener("click", function (event) {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!adminDropdown.contains(event.target)) {
        closeAdminDropdown();
      }
    });
  }

  lightboxClose.addEventListener("click", closeLightbox);
  photoLightbox.addEventListener("click", function (event) {
    if (event.target === photoLightbox) {
      closeLightbox();
    }
  });
  slotPickerClose.addEventListener("click", closeSlotPicker);
  slotPickerBackdrop.addEventListener("click", closeSlotPicker);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeLightbox();
      closeSlotPicker();
    }
  });

  setupDropzone();
  setupLibraryFilters();
  showLogin();

  api("/session")
    .then(bootAdmin)
    .catch(showLogin);
})();
