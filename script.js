(function () {
  const nav = document.getElementById("site-nav");
  const toggle = document.querySelector(".nav-toggle");
  const year = document.getElementById("year");
  const form = document.querySelector(".contact-form");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  if (toggle && nav) {
    const backdrop = document.getElementById("nav-backdrop");

    function setMenuOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("nav-open", open);
      if (backdrop) {
        backdrop.classList.toggle("is-open", open);
        backdrop.setAttribute("aria-hidden", open ? "false" : "true");
      }
    }

    toggle.addEventListener("click", function () {
      setMenuOpen(!nav.classList.contains("is-open"));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenuOpen(false);
      });
    });

    document.addEventListener("click", function (event) {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!nav.classList.contains("is-open")) {
        return;
      }
      if (nav.contains(event.target) || toggle.contains(event.target)) {
        return;
      }
      setMenuOpen(false);
    });

    if (backdrop) {
      backdrop.addEventListener("click", function () {
        setMenuOpen(false);
      });
    }
  }

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealItems.length) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealItems.forEach(function (item) {
      observer.observe(item);
    });
  } else {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const original = button.textContent;
      button.textContent = "Sending...";
      button.disabled = true;

      const payload = {
        name: form.name.value,
        email: form.email.value,
        project: form.project.value,
        message: form.message.value,
      };

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error("Unable to send request.");
        }
        button.textContent = "Thanks — we'll be in touch";
        form.reset();
      } catch (_error) {
        button.textContent = "Something went wrong — try again";
      }

      window.setTimeout(function () {
        button.textContent = original;
        button.disabled = false;
      }, 2800);
    });
  }

  const gallerySection = document.getElementById("gallery-section");
  const galleryGrid = document.getElementById("gallery-grid");
  const galleryScroller = document.getElementById("gallery-scroller");
  const galleryStatus = document.getElementById("gallery-status");
  const galleryPrev = document.getElementById("gallery-prev");
  const galleryNext = document.getElementById("gallery-next");
  const galleryCounter = document.getElementById("gallery-counter");
  const galleryHint = document.getElementById("gallery-hint");
  const galleryLightbox = document.getElementById("gallery-lightbox");
  const galleryLightboxImg = document.getElementById("gallery-lightbox-img");
  const galleryLightboxCaption = document.getElementById("gallery-lightbox-caption");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");
  let lightboxIndex = 0;

  function createGalleryCard(item) {
    const figure = document.createElement("figure");
    figure.className = "gallery-card";
    figure.innerHTML = `
      <img src="${item.url}" alt="${item.title}" loading="lazy" decoding="async" />
      <figcaption>${item.title}</figcaption>
    `;
    return figure;
  }

  function getGalleryCards(track) {
    return Array.from(track.querySelectorAll(".gallery-card"));
  }

  function getCenteredCardIndex(track) {
    const list = getGalleryCards(track);
    const centered = list.findIndex(function (card) {
      return card.classList.contains("is-centered");
    });
    return centered >= 0 ? centered : 0;
  }

  function openLightbox(track, index) {
    const list = getGalleryCards(track);
    const card = list[index];
    if (!card || !galleryLightbox || !galleryLightboxImg) {
      return;
    }
    const img = card.querySelector("img");
    const caption = card.querySelector("figcaption");
    lightboxIndex = index;
    galleryLightboxImg.src = img ? img.src : "";
    galleryLightboxImg.alt = img ? img.alt : "";
    if (galleryLightboxCaption) {
      galleryLightboxCaption.textContent = caption ? caption.textContent : "";
    }
    galleryLightbox.hidden = false;
    galleryLightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("nav-open");
  }

  function closeLightbox() {
    if (!galleryLightbox) {
      return;
    }
    galleryLightbox.hidden = true;
    galleryLightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("nav-open");
  }

  function stepLightbox(track, delta) {
    const list = getGalleryCards(track);
    if (!list.length) {
      return;
    }
    const nextIndex = (lightboxIndex + delta + list.length) % list.length;
    openLightbox(track, nextIndex);
    smoothScrollToCard(track, list[nextIndex]);
  }

  function smoothScrollToCard(track, card, onDone) {
    const easeInOutCubic = function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    if (!track._scrollAnimation) {
      track._scrollAnimation = null;
    }

    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const target = cardCenter - track.clientWidth / 2;
    const start = track.scrollLeft;
    const distance = target - start;
    const duration = 850;
    let startTime = null;

    if (track._scrollAnimation) {
      window.cancelAnimationFrame(track._scrollAnimation);
      track._scrollAnimation = null;
    }

    function step(timestamp) {
      if (startTime === null) {
        startTime = timestamp;
      }
      const progress = Math.min(1, (timestamp - startTime) / duration);
      track.scrollLeft = start + distance * easeInOutCubic(progress);
      if (track._scheduleUpdate) {
        track._scheduleUpdate();
      }
      if (progress < 1) {
        track._scrollAnimation = window.requestAnimationFrame(step);
      } else {
        track._scrollAnimation = null;
        if (onDone) {
          onDone();
        }
      }
    }

    track._scrollAnimation = window.requestAnimationFrame(step);
  }

  function initGalleryScroller(track) {
    if (!track) {
      return;
    }

    if (track.dataset.galleryReady === "true") {
      if (track._scheduleUpdate) {
        track._scheduleUpdate();
      }
      return;
    }
    track.dataset.galleryReady = "true";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scrollFrame = null;
    let scrollEndTimer = null;
    let autoplayTimer = null;
    let idleTimer = null;

    function cards() {
      return getGalleryCards(track);
    }

    function pauseAutoplay() {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }

    function scheduleAutoplay() {
      if (reducedMotion || cards().length < 2) {
        return;
      }
      pauseAutoplay();
      idleTimer = window.setTimeout(function () {
        autoplayTimer = window.setInterval(function () {
          const list = cards();
          const index = getCenteredCardIndex(track);
          const next = list[(index + 1) % list.length];
          if (next) {
            smoothScrollToCard(track, next);
          }
        }, 4200);
      }, 5000);
    }

    function updateMeta() {
      const list = cards();
      const index = getCenteredCardIndex(track);
      if (galleryCounter && list.length) {
        galleryCounter.textContent = String(index + 1) + " / " + String(list.length);
      }
    }

    function updateCenteredCard() {
      const trackRect = track.getBoundingClientRect();
      const centerX = trackRect.left + trackRect.width / 2;

      cards().forEach(function (card) {
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const offset = (cardCenter - centerX) / Math.max(rect.width * 0.72, 1);
        const distance = Math.abs(offset);
        const isCentered = distance < 0.22;

        card.classList.toggle("is-centered", isCentered);

        const rotateY = Math.max(-3, Math.min(3, offset)) * -20;
        const rotateZ = Math.max(-3, Math.min(3, offset)) * 6.5;
        const scale = 0.84 - Math.min(distance * 0.07, 0.12);
        const blur = Math.min(8 + distance * 7, 20);
        const opacity = 1 - Math.min(distance * 0.3, 0.62);
        const depth = -Math.min(distance * 42, 110);
        const zIndex = Math.round(30 - distance * 8);

        card.style.setProperty("--stack-rotate-y", rotateY.toFixed(2) + "deg");
        card.style.setProperty("--stack-rotate-z", rotateZ.toFixed(2) + "deg");
        card.style.setProperty("--stack-scale", scale.toFixed(3));
        card.style.setProperty("--stack-blur", blur.toFixed(2) + "px");
        card.style.setProperty("--stack-opacity", opacity.toFixed(3));
        card.style.setProperty("--stack-translate-z", depth.toFixed(1) + "px");
        card.style.setProperty("--stack-z", String(zIndex));
      });

      updateMeta();
    }

    function scheduleUpdate() {
      if (scrollFrame) {
        return;
      }
      scrollFrame = window.requestAnimationFrame(function () {
        scrollFrame = null;
        updateCenteredCard();
      });
    }
    track._scheduleUpdate = scheduleUpdate;

    function snapToNearestCard() {
      const trackRect = track.getBoundingClientRect();
      const centerX = trackRect.left + trackRect.width / 2;
      let closestCard = null;
      let closestDistance = Infinity;

      cards().forEach(function (card) {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - centerX);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestCard = card;
        }
      });

      if (closestCard && closestDistance > 4) {
        smoothScrollToCard(track, closestCard);
      }
    }

    function stepGallery(delta) {
      pauseAutoplay();
      if (galleryHint) {
        galleryHint.classList.add("is-hidden");
      }
      const list = cards();
      const index = getCenteredCardIndex(track);
      const next = list[(index + delta + list.length) % list.length];
      if (next) {
        smoothScrollToCard(track, next, scheduleAutoplay);
      }
    }

    track.addEventListener("scroll", scheduleUpdate, { passive: true });
    track.addEventListener(
      "scroll",
      function () {
        pauseAutoplay();
        if (galleryHint) {
          galleryHint.classList.add("is-hidden");
        }
        window.clearTimeout(scrollEndTimer);
        scrollEndTimer = window.setTimeout(function () {
          snapToNearestCard();
          scheduleAutoplay();
        }, 180);
      },
      { passive: true }
    );
    window.addEventListener("resize", scheduleUpdate);

    track.addEventListener("pointerdown", function () {
      track.classList.add("is-dragging");
      pauseAutoplay();
    });
    track.addEventListener("pointerup", function () {
      track.classList.remove("is-dragging");
      scheduleAutoplay();
    });
    track.addEventListener("pointercancel", function () {
      track.classList.remove("is-dragging");
    });

    cards().forEach(function (card) {
      card.addEventListener("click", function () {
        pauseAutoplay();
        if (galleryHint) {
          galleryHint.classList.add("is-hidden");
        }
        if (card.classList.contains("is-centered")) {
          openLightbox(track, getCenteredCardIndex(track));
          return;
        }
        smoothScrollToCard(track, card, scheduleAutoplay);
      });
    });

    if (galleryPrev) {
      galleryPrev.addEventListener("click", function () {
        stepGallery(-1);
      });
    }
    if (galleryNext) {
      galleryNext.addEventListener("click", function () {
        stepGallery(1);
      });
    }

    if (galleryLightbox) {
      galleryLightbox.querySelectorAll("[data-lightbox-close]").forEach(function (node) {
        node.addEventListener("click", closeLightbox);
      });
    }
    if (lightboxPrev) {
      lightboxPrev.addEventListener("click", function () {
        stepLightbox(track, -1);
      });
    }
    if (lightboxNext) {
      lightboxNext.addEventListener("click", function () {
        stepLightbox(track, 1);
      });
    }

    document.addEventListener("keydown", function (event) {
      if (!galleryLightbox || galleryLightbox.hidden) {
        return;
      }
      if (event.key === "Escape") {
        closeLightbox();
      }
      if (event.key === "ArrowLeft") {
        stepLightbox(track, -1);
      }
      if (event.key === "ArrowRight") {
        stepLightbox(track, 1);
      }
    });

    updateCenteredCard();
    scheduleAutoplay();
  }

  function mountAdminStar(adminPath) {
    if (!adminPath || document.querySelector(".admin-star")) {
      return;
    }

    const link = document.createElement("a");
    link.className = "admin-star";
    link.href = adminPath;
    link.setAttribute("aria-label", "Site manager");
    link.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.55 5.98 6.45.52-4.88 4.2 1.48 6.3L12 16.9l-5.6 2.6 1.48-6.3-4.88-4.2 6.45-.52L12 2.5z"/></svg>';
    document.body.appendChild(link);
  }

  function initGalleryIfReady() {
    if (!galleryGrid || !galleryGrid.querySelector(".gallery-card")) {
      return;
    }
    if (galleryStatus) {
      galleryStatus.hidden = true;
    }
    if (galleryScroller) {
      galleryScroller.hidden = false;
    }
    initGalleryScroller(galleryGrid);
  }

  initGalleryIfReady();

  async function loadSiteContent() {
    try {
      const response = await fetch("/api/content");
      if (!response.ok) {
        return;
      }
      const content = await response.json();

      mountAdminStar(content.adminPath);

      if (galleryGrid && gallerySection) {
        const hasExistingCards = galleryGrid.querySelector(".gallery-card");
        if (!hasExistingCards) {
          galleryGrid.innerHTML = "";
        }
        if (content.gallery.length) {
          if (!hasExistingCards) {
            content.gallery.forEach(function (item) {
              galleryGrid.appendChild(createGalleryCard(item));
            });
          }
          if (galleryStatus) {
            galleryStatus.hidden = true;
          }
          if (galleryScroller) {
            galleryScroller.hidden = false;
          }
          initGalleryScroller(galleryGrid);
        } else if (!hasExistingCards && galleryStatus) {
          galleryStatus.hidden = false;
          galleryStatus.textContent =
            "Project photos are being prepared. Check back soon or contact us for recent work examples.";
          if (galleryScroller) {
            galleryScroller.hidden = true;
          }
        }
      }

      const dynamicRevealItems = document.querySelectorAll("#gallery-section .reveal");
      if ("IntersectionObserver" in window && dynamicRevealItems.length) {
        const observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        );
        dynamicRevealItems.forEach(function (item) {
          observer.observe(item);
        });
      }
    } catch (_error) {
      if (!galleryGrid?.querySelector(".gallery-card") && galleryStatus) {
        galleryStatus.hidden = false;
        galleryStatus.textContent =
          "Unable to load project photos right now. Refresh the page or try again in a moment.";
      }
    }
  }

  loadSiteContent();
})();
