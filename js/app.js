(function () {
  "use strict";

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  const TRACK_ICON = '<svg class="track-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';

  // --- Shared player -------------------------------------------------

  const Player = (function () {
    const audio = document.getElementById("player-audio");
    const bar = document.getElementById("player-bar");
    const toggleBtn = document.getElementById("player-toggle");
    const iconPlay = document.getElementById("icon-play");
    const iconPause = document.getElementById("icon-pause");
    const titleEl = document.getElementById("player-title");
    const seekEl = document.getElementById("player-seek");
    const currentEl = document.getElementById("player-current");
    const durationEl = document.getElementById("player-duration");

    let activeBtn = null;
    let activePlaylist = null; // array of {url, btn} for auto-advance
    let activeIndex = -1;
    let seeking = false;

    function setPlayingIcon(isPlaying) {
      iconPlay.hidden = isPlaying;
      iconPause.hidden = !isPlaying;
      toggleBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    }

    function clearActive() {
      if (activeBtn) activeBtn.classList.remove("playing");
      activeBtn = null;
    }

    function playItem(url, label, btn, playlist, index) {
      if (activeBtn === btn) {
        // same track: just toggle
        togglePlayPause();
        return;
      }
      clearActive();
      activeBtn = btn;
      activePlaylist = playlist;
      activeIndex = index;
      activeBtn.classList.add("playing");

      bar.hidden = false;
      titleEl.textContent = label;
      audio.src = url;
      audio.currentTime = 0;
      audio.play();
    }

    function togglePlayPause() {
      if (!audio.src) return;
      if (audio.paused) audio.play();
      else audio.pause();
    }

    function playNext() {
      if (!activePlaylist || activeIndex < 0) return;
      for (let i = activeIndex + 1; i < activePlaylist.length; i++) {
        const next = activePlaylist[i];
        if (next.url) {
          playItem(next.url, next.label, next.btn, activePlaylist, i);
          return;
        }
      }
      clearActive();
      setPlayingIcon(false);
    }

    toggleBtn.addEventListener("click", togglePlayPause);
    audio.addEventListener("play", () => setPlayingIcon(true));
    audio.addEventListener("pause", () => setPlayingIcon(false));
    audio.addEventListener("ended", playNext);
    audio.addEventListener("loadedmetadata", () => {
      durationEl.textContent = formatTime(audio.duration);
    });
    audio.addEventListener("timeupdate", () => {
      if (seeking) return;
      currentEl.textContent = formatTime(audio.currentTime);
      if (audio.duration) {
        seekEl.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
      }
    });
    seekEl.addEventListener("input", () => {
      seeking = true;
      currentEl.textContent = formatTime((seekEl.value / 1000) * (audio.duration || 0));
    });
    seekEl.addEventListener("change", () => {
      if (audio.duration) audio.currentTime = (seekEl.value / 1000) * audio.duration;
      seeking = false;
    });

    return { playItem };
  })();

  // --- Rendering -------------------------------------------------

  function buildUnitJump(units, catalogId) {
    const nav = el("nav", { class: "unit-jump" });
    units.forEach((u) => {
      const a = el("a", { href: `#${catalogId}-${slugify(u.unit)}`, text: u.unit });
      nav.appendChild(a);
    });
    return nav;
  }

  function buildTrackList(items, links, missingCounter) {
    const list = el("ul", { class: "track-list" });
    const playlist = []; // parallel to items, for auto-advance within this unit

    items.forEach((item, index) => {
      const url = links[item.filename];
      const li = el("li");

      if (url) {
        const btn = el("button", { type: "button", class: "track" });
        btn.innerHTML = TRACK_ICON;
        btn.appendChild(document.createTextNode(item.label));
        btn.addEventListener("click", () => Player.playItem(url, item.label, btn, playlist, index));
        li.appendChild(btn);
        playlist.push({ url, label: item.label, btn });
      } else {
        missingCounter.count++;
        playlist.push({ url: null, label: item.label, btn: null });
        li.appendChild(el("span", {
          class: "track missing",
          title: "Audio not uploaded yet",
          text: item.label + " (not yet available)"
        }));
      }
      list.appendChild(li);
    });

    return list;
  }

  function buildCatalogBlock(levelId, catalog, links, missingCounter) {
    const catalogId = `${levelId}-${slugify(catalog.catalog)}`;
    const block = el("section", { class: "catalog-block" });
    block.appendChild(el("h2", { text: catalog.catalog }));
    block.appendChild(buildUnitJump(catalog.units, catalogId));

    catalog.units.forEach((u) => {
      const section = el("section", { class: "unit-section", id: `${catalogId}-${slugify(u.unit)}` });
      section.appendChild(el("h3", { text: u.unit }));
      section.appendChild(buildTrackList(u.items, links, missingCounter));
      block.appendChild(section);
    });

    const top = el("div", { class: "top-link" });
    top.appendChild(el("a", { href: "#top", text: "Back to top" }));
    block.appendChild(top);

    return block;
  }

  function buildLevelPanel(level, links, missingCounter) {
    const levelId = slugify(level.level);
    const panel = el("div", { class: "level-panel", id: `panel-${levelId}` });
    level.catalogs.forEach((catalog) => {
      panel.appendChild(buildCatalogBlock(levelId, catalog, links, missingCounter));
    });
    return panel;
  }

  function activateLevel(levelId) {
    document.querySelectorAll(".level-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${levelId}`);
    });
    document.querySelectorAll(".level-tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.level === levelId);
    });
  }

  function render(catalogData, links) {
    const tabsEl = document.getElementById("level-tabs");
    const panelsEl = document.getElementById("level-panels");
    const missingCounter = { count: 0 };

    catalogData.forEach((level, i) => {
      const levelId = slugify(level.level);
      const btn = el("button", { type: "button", "data-level": levelId, text: level.level });
      btn.addEventListener("click", () => activateLevel(levelId));
      tabsEl.appendChild(btn);
      panelsEl.appendChild(buildLevelPanel(level, links, missingCounter));
      if (i === 0) activateLevel(levelId);
    });

    if (missingCounter.count > 0) {
      const banner = el("div", {
        class: "status-banner",
        text: `${missingCounter.count} of ${countAll(catalogData)} tracks are not yet hosted. They'll appear automatically once added to data/links.json.`
      });
      panelsEl.parentNode.insertBefore(banner, panelsEl);
    }
  }

  function countAll(catalogData) {
    let total = 0;
    catalogData.forEach((l) => l.catalogs.forEach((c) => c.units.forEach((u) => { total += u.items.length; })));
    return total;
  }

  Promise.all([
    fetch("data/catalog.json").then((r) => r.json()),
    fetch("data/links.json").then((r) => r.json()).catch(() => ({}))
  ]).then(([catalogData, links]) => {
    render(catalogData, links);
  }).catch((err) => {
    document.getElementById("level-panels").textContent = "Failed to load catalog: " + err;
  });
})();
