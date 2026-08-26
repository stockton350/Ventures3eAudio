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
    items.forEach((item) => {
      const url = links[item.filename];
      const li = el("li");
      if (url) {
        li.appendChild(el("a", { class: "track", href: url, target: "_blank", rel: "noopener", text: item.label }));
      } else {
        missingCounter.count++;
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
