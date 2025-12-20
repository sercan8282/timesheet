// ========== ADMIN MODULE ==========
(function () {
  "use strict";
  console.log("[ADMIN] Admin module loading");

  // Global state
  var currentAdminTab = "users";
  let allUsers = [];
  let allCompanies = [];
  let currentSubmissions = [];

  // Leave management state
  let allLeaveBalances = [];
  let filteredLeaveBalances = [];
  let leaveBalancesPage = 1;
  let allLeaveRequests = [];
  let filteredLeaveRequests = [];
  let leaveRequestsPage = 1;

  // Translation helper with safe fallback
  function adminTr(key, fallback) {
    try {
      if (window.t) {
        // Prefer admin namespace, then fallback to ui
        let res = window.t("admin", key);
        if (res && typeof res === "string") return res;
        res = window.t("ui", key);
        if (res && typeof res === "string") return res;
      }
    } catch (_) {}
    return fallback || key;
  }

  // Translate known fleet placeholder notes safely
  function translateFleetNote(note) {
    if (typeof note === "string" && note.trim() === "fleet.no_maintenance") {
      return adminTr("fleet.no_maintenance", "No maintenance records");
    }
    return note || "-";
  }

  async function switchAdminTab(tab) {
    currentAdminTab = tab;

    // Update nav active state
    document.querySelectorAll("#adminNavTabs .nav-link").forEach((el) => {
      if (el.dataset.tab === tab) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });

    const container = document.getElementById("adminContent");
    if (container) {
      container.innerHTML =
        '<div class="text-center py-4"><div class="spinner-border"></div></div>';
    }

    switch (tab) {
      case "users":
        await loadAdminUsers();
        break;
      case "companies":
        await loadCompaniesManagement();
        break;
      case "submissions":
        await loadAdminSubmissions();
        break;
      case "hours-report":
        await loadHoursReport();
        break;
      case "leave":
        await loadLeaveManagement();
        break;
      case "fleet":
        await loadFleetManagement();
        break;
      case "planning":
        await loadPlanningManagement();
        break;
      case "smtp":
        await loadSMTPSettings();
        break;
      case "branding":
        await loadBrandingSettings();
        break;
      case "menu":
        await loadMenuManagement();
        break;
      case "translations":
        await loadTranslationsManagement();
        break;
      default:
        if (container) {
          container.innerHTML = '<div class="alert alert-info">Module not found</div>';
        }
    }
  }

  // ===== Menu Management =====
  async function loadMenuManagement() {
    const container = document.getElementById("adminContent");
    container.innerHTML = `
      <div class="admin-hero">
        <div>
          <h5 class="mb-1"><span data-i18n="ui:admin.menu_management">Menu Management</span></h5>
          <small data-i18n="ui:menu.description">Arrange navigation, translations, and visibility.</small>
          <div class="pill-group mt-2">
            <span class="pill" data-i18n="ui:menu.drag_reorder">Drag to reorder</span>
            <span class="pill" data-i18n="ui:menu.live_preview">Live after save</span>
          </div>
        </div>
        <div class="text-end">
          <span class="badge-soft" id="menuStatusBadge" data-i18n="ui:menu.workspace">Workspace</span>
        </div>
      </div>

      <div class="glass-card p-3 shadow-soft" id="menuEditor">
        <div class="text-center py-4"><div class="spinner-border"></div></div>
      </div>
    `;

    try {
      const items = await api.getUiMenu();
      renderMenuEditor(items);
    } catch (error) {
      document.getElementById(
        "menuEditor"
      ).innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }

  function renderMenuEditor(items) {
    const wrapper = document.getElementById("menuEditor");
    if (!items) items = [];
    wrapper.innerHTML = `
      <div class="toolbar-card mb-3 d-flex flex-wrap align-items-center gap-2 justify-content-between">
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <select id="menuLocaleSelect" class="form-select form-select-sm w-auto">
            <option value="en">English</option>
            <option value="nl">Nederlands</option>
            <option value="de">Deutsch</option>
          </select>
          <div class="input-chip d-flex align-items-center gap-2">
            <input id="menuLocaleAddInput" class="form-control form-control-sm" placeholder="add locale (e.g. fr)" style="max-width:120px" />
            <button id="menuLocaleAddBtn" class="btn btn-sm btn-outline-secondary"><span data-i18n="ui:add">Add</span></button>
          </div>
          <button id="loadMenuTranslationsBtn" class="btn btn-sm btn-outline-secondary"><span data-i18n="ui:load_translations">Load Translations</span></button>
          <button id="saveMenuTranslationsBtn" class="btn btn-sm btn-primary"><span data-i18n="ui:save_translations">Save Translations</span></button>
          <button id="exportMenuTemplateBtn" class="btn btn-sm btn-outline-secondary"><span data-i18n="ui:export_template_csv">Export Template (CSV)</span></button>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-success" id="saveMenuBtn"><span data-i18n="ui:save">Save</span></button>
        </div>
      </div>

      <div class="menu-grid">
        <div class="menu-table-wrapper">
          <table class="table table-sm align-middle menu-table">
            <thead>
              <tr>
                <th style="width:50px;" data-i18n="ui:menu.order">#</th>
                <th style="width:140px;" data-i18n="ui:menu.page_key">Page Key</th>
                <th data-i18n="ui:menu.label">Label</th>
                <th data-i18n="ui:menu.translation">Translation</th>
                <th style="width:120px;" data-i18n="ui:menu.visible">Visible</th>
                <th style="width:120px;" data-i18n="ui:menu.actions">Actions</th>
              </tr>
            </thead>
            <tbody id="menuTableBody">
              ${items
                .map(
                  (it, idx) => `
                <tr class="menu-row" data-index="${idx}">
                  <td><span class="badge-soft text-uppercase">${idx + 1}</span></td>
                  <td>
                    <input type="hidden" class="page-key" value="${it.page_key}" />
                    <span class="text-monospace">${it.page_key}</span>
                  </td>
                  <td>
                    <input class="form-control form-control-sm label" value="${it.label}" />
                  </td>
                  <td>
                    <input class="form-control form-control-sm translation-input" data-key="${it.page_key}" value="" placeholder="(not loaded)" />
                  </td>
                  <td>
                    <div class="form-check form-switch">
                      <input class="form-check-input visible" type="checkbox" ${it.visible ? "checked" : ""} />
                    </div>
                  </td>
                  <td>
                    <div class="btn-group" role="group">
                      <button class="btn btn-sm btn-outline-secondary move-up" ${idx === 0 ? "disabled" : ""}><i class="bi bi-chevron-up"></i></button>
                      <button class="btn btn-sm btn-outline-secondary move-down" ${idx === items.length - 1 ? "disabled" : ""}><i class="bi bi-chevron-down"></i></button>
                    </div>
                  </td>
                </tr>
                `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Hook up move buttons
    wrapper.querySelectorAll(".move-up").forEach((btn) => {
      btn.onclick = (e) => {
        const item = e.target.closest(".menu-row");
        const tbody = item?.parentElement;
        if (!item || !tbody) return;
        const idx = parseInt(item.getAttribute("data-index"), 10);
        if (idx <= 0) return;
        const above = tbody.querySelector(`[data-index="${idx - 1}"]`);
        if (!above) return;
        tbody.insertBefore(item, above);
        reindexMenuList();
      };
    });
    wrapper.querySelectorAll(".move-down").forEach((btn) => {
      btn.onclick = (e) => {
        const item = e.target.closest(".menu-row");
        const tbody = item?.parentElement;
        if (!item || !tbody) return;
        const idx = parseInt(item.getAttribute("data-index"), 10);
        const below = tbody.querySelector(`[data-index="${idx + 1}"]`);
        if (!below) return;
        tbody.insertBefore(below, item);
        reindexMenuList();
      };
    });

    const saveMenuBtn = document.getElementById("saveMenuBtn");
    if (saveMenuBtn) {
      saveMenuBtn.onclick = saveMenuConfig;
    }

    // Apply translations to any newly rendered elements
    try {
      if (
        window.app &&
        typeof window.app.applyTranslationsToDom === "function"
      ) {
        window.app.applyTranslationsToDom();
      }
    } catch (err) {
      // ignore
    }

    // Translation buttons
    const loadBtn = document.getElementById("loadMenuTranslationsBtn");
    const saveTransBtn = document.getElementById("saveMenuTranslationsBtn");
    const localeSelect = document.getElementById("menuLocaleSelect");

    if (loadBtn) {
      loadBtn.onclick = async () => {
        const locale = localeSelect.value;
        loadBtn.disabled = true;
        try {
          const trans = await api.getTranslations(locale, "menu");
          const map = {};
          (trans || []).forEach((t) => {
            map[t.key] = t.text;
          });
          wrapper.querySelectorAll(".translation-input").forEach((inp) => {
            const key = inp.getAttribute("data-key");
            inp.value = map[key] || "";
          });
          showToast(
            adminTr("loaded_translations", "Loaded translations"),
            "success"
          );
        } catch (err) {
          console.error("Error loading translations", err);
          showToast(
            adminTr("error_loading_translations", "Error loading translations"),
            "danger"
          );
        } finally {
          loadBtn.disabled = false;
        }
      };
    }

    if (saveTransBtn) {
      saveTransBtn.onclick = async () => {
        const locale = localeSelect.value;
        const items = Array.from(
          wrapper.querySelectorAll(".translation-input")
        ).map((inp) => ({
          namespace: "menu",
          key: inp.getAttribute("data-key"),
          locale,
          text: inp.value || "",
        }));
        try {
          await api.updateTranslations(items);
          showToast(
            adminTr("translations_saved", "Translations saved"),
            "success"
          );
          // ensure locale is selectable in the locales select if newly added via save
          ensureLocaleInSelect(localeSelect, locale);
          // Reload translations to refresh cache
          if (window.app && typeof window.app.loadTranslations === "function") {
            try {
              await window.app.loadTranslations(window.app.locale);
              await window.app.loadAndRenderMenu();
              console.log("✓ Menu translations cache refreshed");
            } catch (err) {
              console.error("Failed to refresh menu translations:", err);
            }
          }
        } catch (err) {
          console.error("Error saving translations", err);
          showToast("Error saving translations", "danger");
        }
      };
    }

    // add locale to select
    const addLocaleBtn = document.getElementById("menuLocaleAddBtn");
    const addLocaleInput = document.getElementById("menuLocaleAddInput");
    addLocaleBtn.onclick = () => {
      const l = (addLocaleInput.value || "").trim().toLowerCase();
      if (!l) return;
      ensureLocaleInSelect(localeSelect, l);
      addLocaleInput.value = "";
      showToast(adminTr("added_locale", "Added locale") + " " + l, "success");
    };

    document.getElementById("exportMenuTemplateBtn").onclick = async () => {
      const ns = "menu";
      const locale = document.getElementById("menuLocaleSelect").value;
      try {
        const keys = await api.getTranslationKeys(ns);
        const header = "namespace,key,locale,text";
        const lines = [header].concat(
          (keys || []).map((k) => `${ns},${escapeCsv(k)},${locale},`)
        );
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `translations-template-${ns}-${locale}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(adminTr("exported_template", "Exported template"), "success");
      } catch (err) {
        console.error("Export template error", err);
        showToast(
          adminTr("error_exporting_template", "Error exporting template"),
          "danger"
        );
      }
    };
  }

  function reindexMenuList() {
    const list = document.getElementById("menuTableBody");
    if (!list) return;
    Array.from(list.querySelectorAll(".menu-row")).forEach((el, idx) => {
      el.setAttribute("data-index", idx);
      // enable/disable arrows
      const up = el.querySelector(".move-up");
      const down = el.querySelector(".move-down");
      if (up) up.disabled = idx === 0;
      if (down)
        down.disabled = idx === list.querySelectorAll(".menu-row").length - 1;
    });
  }

  async function saveMenuConfig() {
    const list = document.getElementById("menuTableBody");
    if (!list) return;
    const rows = Array.from(list.querySelectorAll(".menu-row"));
    const items = rows.map((el, idx) => {
      const pageInput = el.querySelector(".page-key");
      const visibleInput = el.querySelector(".visible");
      return {
        page_key: pageInput ? pageInput.value : "",
        label: el.querySelector(".label")?.value || "",
        visible: !!(visibleInput && visibleInput.checked),
        sort_order: idx,
      };
    });

    try {
      await api.updateUiMenu(items);
      // Re-render frontend menu immediately
      await app.loadAndRenderMenu();
      document.getElementById("menuEditor").innerHTML =
        '<div class="alert alert-success">Saved!</div>';
      setTimeout(() => loadMenuManagement(), 800);
    } catch (error) {
      document.getElementById(
        "menuEditor"
      ).innerHTML = `<div class="alert alert-danger">Error saving: ${error.message}</div>`;
    }
  }

  // ===== Translations Management =====
  async function loadTranslationsManagement() {
    const container = document.getElementById("adminContent");
    container.innerHTML = `
      <div class="admin-hero">
        <div>
          <h5 class="mb-1"><span data-i18n="ui:admin.translations">Translations</span></h5>
          <small data-i18n="ui:translations.subtitle">Manage UI copy across locales with live preview.</small>
          <div class="pill-group mt-2">
            <span class="pill">CSV / JSON</span>
            <span class="pill" data-i18n="ui:translations.live_preview">Live preview ready</span>
            <span class="pill" data-i18n="ui:translations.bulk_edit">Bulk edit friendly</span>
          </div>
        </div>
        <div class="text-end">
          <span class="badge-soft" id="translationsStatusBadge" data-i18n="ui:translations.workspace">Workspace</span>
        </div>
      </div>

      <div class="glass-card p-3 shadow-soft" id="translationsEditor">
        <div class="toolbar-card mb-3 d-flex flex-wrap align-items-center justify-content-between">
          <div>
            <button class="btn btn-sm btn-outline-secondary" id="exportTranslationsJson"><span data-i18n="ui:export_json">Export JSON</span></button>
            <button class="btn btn-sm btn-outline-secondary" id="exportTranslationsCsv"><span data-i18n="ui:export_csv">Export CSV</span></button>
            <button class="btn btn-sm btn-outline-secondary" id="exportTranslationsTemplate"><span data-i18n="ui:export_template_csv">Export Template (CSV)</span></button>
            <input type="file" id="importTranslationsFile" style="display:none" accept="application/json,text/json,text/csv" />
            <button class="btn btn-sm btn-outline-secondary" id="importTranslationsBtn"><span data-i18n="ui:import">Import</span></button>
            <button class="btn btn-sm btn-primary" id="saveTranslationsBtn"><span data-i18n="ui:save">Save</span></button>
          </div>
          <div class="text-muted small" data-i18n="ui:translations.toolbar_hint">Import/export or bulk edit below.</div>
        </div>

        <div class="toolbar-card mb-3">
          <div class="toolbar-filters">
            <div>
              <label class="form-label" data-i18n="ui:namespace">Namespace</label>
              <select id="translationsNamespace" class="form-select form-select-sm">
                <option value="menu">menu</option>
                <option value="ui">ui</option>
                <option value="field">field</option>
                <option value="branding">branding</option>
              </select>
            </div>
            <div>
              <label class="form-label" data-i18n="ui:locale">Locale</label>
              <div class="input-chip d-flex align-items-center gap-2">
                <select id="translationsLocale" class="form-select form-select-sm" style="min-width:90px">
                  <option value="en">en</option>
                  <option value="nl">nl</option>
                  <option value="de">de</option>
                </select>
                <input id="translationsLocaleAdd" class="form-control form-control-sm" placeholder="add locale (fr)" style="max-width:90px" />
                <button id="translationsLocaleAddBtn" class="btn btn-sm btn-outline-secondary"><span data-i18n="ui:add">Add</span></button>
              </div>
            </div>
            <div>
              <label class="form-label" data-i18n="ui:translations.source_locale">Source locale</label>
              <select id="translationsSourceLocale" class="form-select form-select-sm" style="min-width:90px">
                <option value="en">en</option>
                <option value="nl">nl</option>
                <option value="de">de</option>
              </select>
            </div>
            <div>
              <label class="form-label" data-i18n="ui:translations.provider">Provider</label>
              <select id="translationsProvider" class="form-select form-select-sm" style="min-width:110px">
                <option value="deepl" data-i18n="ui:translations.provider.deepl">DeepL</option>
                <option value="google" data-i18n="ui:translations.provider.google">Google</option>
              </select>
              <div class="text-muted small" data-i18n="ui:translations.auto_translate_hint">Fill empty texts using the selected provider.</div>
            </div>
            <div class="flex-grow-1">
              <label class="form-label" data-i18n="ui:translations.filter">Filter</label>
              <input id="translationsSearch" class="form-control form-control-sm" data-i18n-placeholder="ui:translations.filter_placeholder" placeholder="Filter by key or text" />
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" id="loadTranslationsBtn"><span data-i18n="ui:load">Load</span></button>
              <button class="btn btn-sm btn-primary" id="addTranslationBtn"><span data-i18n="ui:add">Add</span></button>
              <button class="btn btn-sm btn-success" id="autoTranslateBtn"><span data-i18n="ui:translations.auto_translate">Auto-translate missing</span></button>
            </div>
          </div>
        </div>

        <div class="translations-table-wrapper" id="translationsTableWrapper">
          <div class="text-center py-4"><div class="spinner-border"></div></div>
        </div>
      </div>
    `;

    document.getElementById("loadTranslationsBtn").onclick = async () => {
      await loadTranslationsForSelected();
    };

    document.getElementById("addTranslationBtn").onclick = () => {
      appendTranslationRow({
        namespace: document.getElementById("translationsNamespace").value,
        key: "",
        locale: document.getElementById("translationsLocale").value,
        text: "",
      });
    };

    document.getElementById("saveTranslationsBtn").onclick = async () => {
      await saveTranslationsFromTable();
    };
    document.getElementById("translationsLocaleAddBtn").onclick = () => {
      const val = (document.getElementById("translationsLocaleAdd").value || "")
        .trim()
        .toLowerCase();
      if (!val) return;
      ensureLocaleInSelect(document.getElementById("translationsLocale"), val);
      document.getElementById("translationsLocaleAdd").value = "";
      showToast(adminTr("added_locale", "Added locale"), "success");
    };

    // auto-refresh when namespace or locale changes
    document.getElementById("translationsNamespace").onchange = async () => {
      await loadTranslationsForSelected();
    };
    document.getElementById("translationsLocale").onchange = async () => {
      await loadTranslationsForSelected();
    };

    document.getElementById("autoTranslateBtn").onclick = async () => {
      await autoTranslateMissing();
    };
    document.getElementById("translationsSearch").oninput = () => {
      const q = (
        document.getElementById("translationsSearch").value || ""
      ).toLowerCase();
      document.querySelectorAll("#translationsTableBody tr").forEach((tr) => {
        const keyElement = tr.querySelector(".trans-key");
        const key = (
          keyElement.textContent ||
          keyElement.value ||
          ""
        ).toLowerCase();
        const text = (
          tr.querySelector(".trans-text").value || ""
        ).toLowerCase();
        tr.style.display =
          !q || key.includes(q) || text.includes(q) ? "" : "none";
      });
    };

    document.getElementById("exportTranslationsJson").onclick = () => {
      exportTranslationsJson();
    };

    document.getElementById("exportTranslationsCsv").onclick = () => {
      exportTranslationsCsv();
    };

    document.getElementById("exportTranslationsTemplate").onclick =
      async () => {
        const ns = document.getElementById("translationsNamespace").value;
        const locale = document.getElementById("translationsLocale").value;
        try {
          const keys = await api.getTranslationKeys(ns);
          const header = "namespace,key,locale,text";
          const lines = [header].concat(
            (keys || []).map((k) => `${ns},${escapeCsv(k)},${locale},`)
          );
          const blob = new Blob([lines.join("\n")], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `translations-template-${ns}-${locale}.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          showToast(
            adminTr("exported_template", "Exported template"),
            "success"
          );
        } catch (err) {
          console.error("Export template error", err);
          showToast(
            adminTr("error_exporting_template", "Error exporting template"),
            "danger"
          );
        }
      };

    document.getElementById("importTranslationsBtn").onclick = () => {
      document.getElementById("importTranslationsFile").click();
    };

    document.getElementById("importTranslationsFile").onchange = async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        // Try JSON first
        let items = null;
        try {
          items = JSON.parse(text);
        } catch (err) {
          items = null;
        }
        if (!items) {
          // Parse CSV robustly (handles quoted fields).
          const rows = parseCsv(text)
            .map((r) => r.map((c) => (typeof c === "string" ? c.trim() : c)))
            .filter((r) => r.length > 0);
          // If header present, map by header names
          let mapped = [];
          const header =
            rows[0] && rows[0].map((h) => (h || "").toString().toLowerCase());
          if (
            header &&
            header.includes("namespace") &&
            header.includes("key") &&
            header.includes("locale")
          ) {
            const idxNamespace = header.indexOf("namespace");
            const idxKey = header.indexOf("key");
            const idxLocale = header.indexOf("locale");
            const idxText = header.indexOf("text");
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r || r.length === 0) continue;
              mapped.push({
                namespace: r[idxNamespace] || "",
                key: r[idxKey] || "",
                locale: (r[idxLocale] || "").toLowerCase(),
                text: r[idxText] || "",
              });
            }
          } else {
            // assume columns: namespace,key,locale,text
            mapped = rows.map((r) => ({
              namespace: r[0] || "",
              key: r[1] || "",
              locale: (r[2] || "").toLowerCase(),
              text: r.slice(3).join(",") || "",
            }));
          }
          items = mapped.filter((it) => it.key || it.text);
        }
        // If multiple namespaces present but current selection differs, adjust or filter
        const nsSelect = document.getElementById("translationsNamespace");
        const localesAdded = new Set();
        const namespaces = Array.from(
          new Set(
            (items || [])
              .map((it) => (it.namespace || "").trim())
              .filter(Boolean)
          )
        );
        if (namespaces.length === 1) {
          nsSelect.value = namespaces[0];
        } else if (namespaces.length > 1) {
          // Keep current selection but filter to it
          const sel = nsSelect.value;
          items = items.filter((it) => (it.namespace || "") === sel);
          if (items.length === 0) {
            showToast(
              "Imported file contains multiple namespaces; no rows match the selected namespace",
              "warning"
            );
          } else {
            showToast(
              "Imported file contains multiple namespaces; rows filtered to the selected namespace",
              "warning"
            );
          }
        }
        // Ensure any imported locales are shown in locale select
        (items || []).forEach((it) => {
          if (it.locale) localesAdded.add(it.locale);
        });
        localesAdded.forEach((l) =>
          ensureLocaleInSelect(document.getElementById("translationsLocale"), l)
        );

        // Show preview modal for import validation and confirm
        showImportPreviewModal(items);
      } catch (err) {
        console.error("Import error", err);
        showToast("Failed to import file", "danger");
      }
    };

    // initial load for defaults
    await loadTranslationsForSelected();

    try {
      if (
        window.app &&
        typeof window.app.applyTranslationsToDom === "function"
      ) {
        window.app.applyTranslationsToDom();
      }
    } catch (err) {
      // ignore
    }
  }

  // ===== Leave Balance Management =====
  async function loadLeaveManagement() {
    const container = document.getElementById("adminContent");
    if (!container) return;
    
    container.innerHTML = `
      <div class="row">
        <!-- Compact Leave Balances Section -->
        <div class="col-md-4">
          <div class="card">
            <div class="card-header bg-primary text-white">
              <h6 class="mb-2"><i class="bi bi-people"></i> Verlofsaldo Beheer</h6>
              <div class="input-group input-group-sm">
                <input type="text" class="form-control form-control-sm" id="searchLeaveBalances" placeholder="Zoek medewerker..." />
                <button class="btn btn-light btn-sm" id="refreshLeaveBalances"><i class="bi bi-arrow-clockwise"></i></button>
              </div>
            </div>
            <div class="card-body p-0" style="max-height: 500px; overflow-y: auto;" id="leaveBalancesWrapper">
              <div class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></div>
            </div>
          </div>
        </div>

        <!-- Leave Requests Section -->
        <div class="col-md-8">
          <div class="card">
            <div class="card-header bg-primary text-white">
              <h6 class="mb-2"><i class="bi bi-calendar-check"></i> Verlofaanvragen</h6>
              <div class="input-group input-group-sm">
                <input type="text" class="form-control form-control-sm" id="searchLeaveRequests" placeholder="Zoek medewerker..." />
                <button class="btn btn-light btn-sm" id="refreshLeaveRequests"><i class="bi bi-arrow-clockwise"></i></button>
              </div>
            </div>
            <div class="card-body p-0" style="max-height: 500px; overflow-y: auto;" id="leaveRequestsWrapper">
              <div class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("refreshLeaveBalances").onclick = loadLeaveManagement;
    document.getElementById("refreshLeaveRequests").onclick = loadLeaveManagement;

    // Setup search for leave balances
    document.getElementById("searchLeaveBalances").oninput = (e) => {
      const query = e.target.value.toLowerCase();
      filteredLeaveBalances = allLeaveBalances.filter(item => {
        const name = (item.full_name || item.username || "").toLowerCase();
        return name.includes(query);
      });
      leaveBalancesPage = 1;
      renderLeaveBalancesTable(filteredLeaveBalances, leaveBalancesPage);
    };

    // Setup search for leave requests
    document.getElementById("searchLeaveRequests").oninput = (e) => {
      const query = e.target.value.toLowerCase();
      filteredLeaveRequests = allLeaveRequests.filter(req => {
        const name = (req.full_name || req.username || "").toLowerCase();
        return name.includes(query);
      });
      leaveRequestsPage = 1;
      renderLeaveRequestsTable(filteredLeaveRequests, leaveRequestsPage);
    };

    try {
      const rows = await api.getLeaveBalances();
      allLeaveBalances = rows || [];
      filteredLeaveBalances = allLeaveBalances;
      renderLeaveBalancesTable(filteredLeaveBalances, leaveBalancesPage);
    } catch (err) {
      console.error("Error loading leave balances:", err);
      document.getElementById("leaveBalancesWrapper").innerHTML = `<div class="alert alert-danger m-2">${err.message || "Failed to load"}</div>`;
    }

    try {
      const requests = await api.getLeaveRequestsAdmin();
      allLeaveRequests = requests || [];
      filteredLeaveRequests = allLeaveRequests;
      renderLeaveRequestsTable(filteredLeaveRequests, leaveRequestsPage);
    } catch (err) {
      console.error("Error loading leave requests:", err);
      document.getElementById("leaveRequestsWrapper").innerHTML = `<div class="alert alert-danger m-2">${err.message || "Failed to load"}</div>`;
    }

    try {
      if (window.app && typeof window.app.applyTranslationsToDom === "function") {
        window.app.applyTranslationsToDom();
      }
    } catch (e) {}
  }

  function renderLeaveBalancesTable(items, page = 1) {
    const wrapper = document.getElementById("leaveBalancesWrapper");
    if (!items || items.length === 0) {
      wrapper.innerHTML = `<div class="alert alert-info m-2">Geen gebruikers gevonden</div>`;
      return;
    }

    const itemsPerPage = 10;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageItems = items.slice(startIdx, endIdx);

    const rowsHtml = pageItems.map((it) => {
      const disabled = it.is_blocked ? "disabled" : "";
      const name = escapeHtml(it.full_name || it.username || "");
      return `
        <tr data-user-id="${it.user_id}" style="font-size: 0.875rem;">
          <td class="py-2">${name}${it.is_blocked ? ' <span class="badge bg-secondary">blocked</span>' : ''}</td>
          <td class="py-2" style="width: 80px;">
            <input type="number" step="0.25" min="0" class="form-control form-control-sm vacation-hours" value="${Number(it.vacation_hours || 0).toFixed(2)}" ${disabled} style="font-size: 0.75rem;" />
          </td>
          <td class="py-2" style="width: 80px;">
            <input type="number" step="0.25" min="0" class="form-control form-control-sm overtime-hours" value="${Number(it.overtime_hours || 0).toFixed(2)}" ${disabled} style="font-size: 0.75rem;" />
          </td>
          <td class="py-2" style="width: 60px;">
            <button class="btn btn-sm btn-primary save-leave px-2" ${disabled} title="Opslaan"><i class="bi bi-save"></i></button>
          </td>
        </tr>`;
    }).join("");

    // Pagination controls
    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = `
        <div class="d-flex justify-content-between align-items-center p-2 border-top bg-light">
          <small class="text-muted">${items.length} gebruikers</small>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" id="leaveBalancesPrev" ${page === 1 ? 'disabled' : ''}>
              <i class="bi bi-chevron-left"></i>
            </button>
            <button class="btn btn-outline-secondary disabled">${page} / ${totalPages}</button>
            <button class="btn btn-outline-secondary" id="leaveBalancesNext" ${page === totalPages ? 'disabled' : ''}>
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      `;
    }

    wrapper.innerHTML = `
      <table class="table table-sm table-hover mb-0">
        <thead class="table-light sticky-top">
          <tr style="font-size: 0.75rem;">
            <th>Gebruiker</th>
            <th style="width: 80px;">Verlof (u)</th>
            <th style="width: 80px;">Overuren (u)</th>
            <th style="width: 60px;"></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${paginationHtml}
    `;

    // Attach pagination event listeners
    if (totalPages > 1) {
      const prevBtn = document.getElementById("leaveBalancesPrev");
      const nextBtn = document.getElementById("leaveBalancesNext");
      if (prevBtn) {
        prevBtn.onclick = () => {
          leaveBalancesPage--;
          renderLeaveBalancesTable(filteredLeaveBalances, leaveBalancesPage);
        };
      }
      if (nextBtn) {
        nextBtn.onclick = () => {
          leaveBalancesPage++;
          renderLeaveBalancesTable(filteredLeaveBalances, leaveBalancesPage);
        };
      }
    }

    wrapper.querySelectorAll(".save-leave").forEach((btn) => {
      btn.onclick = async (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;
        const userId = tr.getAttribute("data-user-id");
        const vacation = parseFloat(tr.querySelector(".vacation-hours").value || "0");
        const overtime = parseFloat(tr.querySelector(".overtime-hours").value || "0");
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        try {
          await api.updateLeaveBalance(userId, { vacationHours: vacation, overtimeHours: overtime });
          showToast("Opgeslagen", "success");
        } catch (err) {
          console.error("Failed to save leave balance:", err);
          showToast(err.message || "Opslaan mislukt", "danger");
        } finally {
          btn.innerHTML = original;
          btn.disabled = false;
        }
      };
    });
  }

  function renderLeaveRequestsTable(requests, page = 1) {
    const wrapper = document.getElementById("leaveRequestsWrapper");
    if (!requests || requests.length === 0) {
      wrapper.innerHTML = `<div class="alert alert-info m-2">Geen verlofaanvragen</div>`;
      return;
    }

    const itemsPerPage = 10;
    const totalPages = Math.ceil(requests.length / itemsPerPage);
    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageItems = requests.slice(startIdx, endIdx);

    const badge = (status) => {
      switch (status) {
        case "approved": return "bg-success";
        case "rejected": return "bg-danger";
        default: return "bg-warning text-dark";
      }
    };

    const rowsHtml = pageItems.map((req) => {
      const period = `${new Date(req.start_date).toLocaleDateString("nl-NL")} - ${new Date(req.end_date).toLocaleDateString("nl-NL")}`;
      const canAct = req.status === "pending";
      const typeLabel = req.balance_type === "overtime" ? "Overuren" : "Verlof";

      return `
        <tr style="font-size: 0.875rem;">
          <td class="py-2">${escapeHtml(req.full_name || req.username || "-")}</td>
          <td class="py-2">${typeLabel}</td>
          <td class="py-2">${period}</td>
          <td class="py-2 text-end"><strong>${parseFloat(req.hours_requested || 0).toFixed(2)} u</strong></td>
          <td class="py-2 text-center"><span class="badge ${badge(req.status)}">${req.status}</span></td>
          <td class="py-2">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-success btn-sm" ${canAct ? "" : "disabled"} onclick="adminDecideLeave(${req.id}, 'approved')" title="Goedkeuren"><i class="bi bi-check"></i></button>
              <button class="btn btn-danger btn-sm" ${canAct ? "" : "disabled"} onclick="adminDecideLeave(${req.id}, 'rejected')" title="Afwijzen"><i class="bi bi-x"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Pagination controls
    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = `
        <div class="d-flex justify-content-between align-items-center p-2 border-top bg-light">
          <small class="text-muted">${requests.length} aanvragen</small>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" id="leaveRequestsPrev" ${page === 1 ? 'disabled' : ''}>
              <i class="bi bi-chevron-left"></i>
            </button>
            <button class="btn btn-outline-secondary disabled">${page} / ${totalPages}</button>
            <button class="btn btn-outline-secondary" id="leaveRequestsNext" ${page === totalPages ? 'disabled' : ''}>
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      `;
    }

    wrapper.innerHTML = `
      <table class="table table-sm table-hover mb-0">
        <thead class="table-light sticky-top">
          <tr style="font-size: 0.75rem;">
            <th>Gebruiker</th>
            <th>Type</th>
            <th>Periode</th>
            <th class="text-end">Uren</th>
            <th class="text-center">Status</th>
            <th class="text-center">Acties</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${paginationHtml}
    `;

    // Attach pagination event listeners
    if (totalPages > 1) {
      const prevBtn = document.getElementById("leaveRequestsPrev");
      const nextBtn = document.getElementById("leaveRequestsNext");
      if (prevBtn) {
        prevBtn.onclick = () => {
          leaveRequestsPage--;
          renderLeaveRequestsTable(filteredLeaveRequests, leaveRequestsPage);
        };
      }
      if (nextBtn) {
        nextBtn.onclick = () => {
          leaveRequestsPage++;
          renderLeaveRequestsTable(filteredLeaveRequests, leaveRequestsPage);
        };
      }
    }
  }

  async function loadTranslationsForSelected() {
    const ns = document.getElementById("translationsNamespace").value;
    const locale = document.getElementById("translationsLocale").value;
    const wrapper = document.getElementById("translationsTableWrapper");
    wrapper.innerHTML =
      '<div class="text-center py-4"><div class="spinner-border"></div></div>';
    try {
      const items = await api.getTranslations(locale, ns);
      renderTranslationsTable(items || []);
      const badge = document.getElementById("translationsStatusBadge");
      if (badge)
        badge.textContent = `${ns.toUpperCase()} · ${locale.toUpperCase()}`;
      try {
        if (
          window.app &&
          typeof window.app.applyTranslationsToDom === "function"
        ) {
          window.app.applyTranslationsToDom();
        }
      } catch (err) {
        // ignore
      }
      showToast(
        adminTr("loaded_translations", "Loaded translations"),
        "success"
      );
    } catch (err) {
      console.error("Error loading translations", err);
      wrapper.innerHTML = `<div class="alert alert-danger">Error loading translations: ${err.message}</div>`;
    }
  }

  function renderTranslationsTable(items) {
    const wrapper = document.getElementById("translationsTableWrapper");
    wrapper.innerHTML = `
      <div class="translations-table-wrapper">
        <table class="table table-sm translations-table">
          <thead>
            <tr>
              <th style="width:40px;" data-i18n="ui:menu.order">#</th>
              <th style="width:180px;" data-i18n="ui:key">Key</th>
              <th style="width:80px;" data-i18n="ui:locale">Locale</th>
              <th data-i18n="ui:text">Text</th>
              <th style="width:70px;" data-i18n="ui:menu.actions">Actions</th>
            </tr>
          </thead>
          <tbody id="translationsTableBody"></tbody>
        </table>
      </div>
    `;
    const body = document.getElementById("translationsTableBody");
    (items || []).forEach((it, idx) => appendTranslationRow(it, idx + 1));
  }

  function appendTranslationRow(it, rowNum) {
    const body = document.getElementById("translationsTableBody");
    const tr = document.createElement("tr");
    tr.className = "trans-row";
    const localeVal = (
      it.locale ||
      document.getElementById("translationsLocale")?.value ||
      ""
    ).toLowerCase();
    tr.dataset.namespace =
      it.namespace || document.getElementById("translationsNamespace").value;
    tr.innerHTML = `
      <td><span class="badge-soft text-uppercase">${rowNum || ""}</span></td>
      <td>
        <div class="trans-key" style="font-family:monospace;font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(
          it.key || ""
        )}</div>
      </td>
      <td>
        <input class="form-control form-control-sm trans-locale" value="${escapeHtml(
          localeVal
        )}" readonly />
      </td>
      <td>
        <input type="text" class="form-control form-control-sm trans-text" placeholder="Enter translation..." value="${escapeHtml(
          it.text || ""
        )}" />
      </td>
      <td>
        <button class="btn btn-sm btn-outline-danger remove-row"><i class="bi bi-trash"></i></button>
      </td>
    `;
    body.appendChild(tr);
    tr.querySelector(".remove-row").onclick = () => tr.remove();
  }

  async function autoTranslateMissing() {
    const target = document.getElementById("translationsLocale").value;
    const source =
      document.getElementById("translationsSourceLocale").value || "en";
    const provider =
      document.getElementById("translationsProvider").value || "deepl";
    const namespace = document.getElementById("translationsNamespace").value;
    const btn = document.getElementById("autoTranslateBtn");
    const rows = Array.from(
      document.querySelectorAll("#translationsTableBody tr")
    );
    const pending = rows.filter((tr) => {
      const key = tr.querySelector(".trans-key")?.value?.trim();
      const text = tr.querySelector(".trans-text")?.value?.trim();
      return key && !text;
    });

    if (!pending.length) {
      showToast("No empty texts to translate", "info");
      return;
    }

    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = `<span data-i18n="ui:translations.translating">Translating...</span>`;

    // Fetch source-locale texts to translate from
    let sourceMap = {};
    try {
      const srcRows = await api.getTranslations(source, namespace);
      (srcRows || []).forEach((r) => {
        sourceMap[r.key] = r.text;
      });
    } catch (err) {
      console.warn(
        "Could not load source translations; falling back to key",
        err
      );
    }

    for (const tr of pending) {
      const key = tr.querySelector(".trans-key").value.trim();
      const textArea = tr.querySelector(".trans-text");
      try {
        const textToTranslate = sourceMap[key] || key.replace(/_/g, " ");
        const resp = await api.translateText({
          text: textToTranslate,
          target,
          source,
          provider,
        });
        if (resp && resp.text) {
          textArea.value = resp.text;
        }
      } catch (err) {
        console.error("Auto-translate failed for", key, err);
      }
    }

    btn.innerHTML = original;
    btn.disabled = false;
    showToast(
      adminTr("translations.auto_translated", "Auto-translated"),
      "success"
    );

    try {
      if (
        window.app &&
        typeof window.app.applyTranslationsToDom === "function"
      ) {
        window.app.applyTranslationsToDom();
      }
    } catch (err) {
      // ignore
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function ensureLocaleInSelect(selectEl, locale) {
    if (!locale) return;
    const l = String(locale).trim().toLowerCase();
    if (!l) return;
    const existing = Array.from(selectEl.options).some(
      (o) => o.value.toLowerCase() === l
    );
    if (!existing) {
      const opt = document.createElement("option");
      opt.value = l;
      opt.text = l;
      selectEl.appendChild(opt);
    }
    selectEl.value = l;
  }

  // Robust CSV parser: returns array of arrays (rows). Handles quoted fields with commas/newlines
  function parseCsv(text) {
    const rows = [];
    let i = 0;
    const len = text.length;
    let cur = "";
    let row = [];
    let inQuotes = false;
    while (i < len) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            cur += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          cur += ch;
          i++;
          continue;
        }
      } else {
        if (ch === ",") {
          row.push(cur);
          cur = "";
          i++;
          continue;
        } else if (ch === "\r") {
          // ignore, handle with \n
          i++;
          continue;
        } else if (ch === "\n") {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = "";
          i++;
          continue;
        } else if (ch === '"') {
          inQuotes = true;
          i++;
          continue;
        } else {
          cur += ch;
          i++;
          continue;
        }
      }
    }
    // push last
    if (cur !== "" || row.length) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  // Show import preview modal with validation and dry-run/apply
  async function showImportPreviewModal(items) {
    // items: array of {namespace,key,locale,text}
    if (!items || !Array.isArray(items))
      return showToast("No items to import", "warning");

    // normalize and filter empty rows
    items = items
      .map((it) => ({
        namespace: (it.namespace || "").trim(),
        key: (it.key || "").trim(),
        locale: (it.locale || "").trim().toLowerCase(),
        text: it.text || "",
      }))
      .filter((it) => it.namespace || it.key || it.locale || it.text);

    // gather unique namespace/locale pairs to fetch existing translations
    const pairs = {};
    items.forEach((it) => {
      if (it.namespace && it.locale)
        pairs[`${it.namespace}::${it.locale}`] = {
          namespace: it.namespace,
          locale: it.locale,
        };
    });

    const existingMaps = {}; // key: namespace::locale => map key->text
    for (const k of Object.keys(pairs)) {
      try {
        const { namespace, locale } = pairs[k];
        const rows = await api.getTranslations(locale, namespace);
        const m = {};
        (rows || []).forEach((r) => {
          m[r.key] = r.text;
        });
        existingMaps[k] = m;
      } catch (err) {
        existingMaps[k] = {};
      }
    }

    // Build modal HTML
    const modalId = "importPreviewModal";
    const container = document.createElement("div");
    container.className = "modal fade";
    container.id = modalId;
    container.tabIndex = -1;
    container.innerHTML = `
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Import Preview</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="mb-2">
              <label class="form-check form-switch">
                <input class="form-check-input" id="importAllowCreate" type="checkbox" checked>
                <span class="form-check-label">Allow creating new translation keys</span>
              </label>
            </div>
            <div class="table-responsive" style="max-height:420px; overflow:auto;">
              <table class="table table-sm table-striped">
                <thead><tr><th style="width:40px">Use</th><th>Namespace</th><th>Key</th><th>Locale</th><th>Existing Text</th><th>New Text</th><th>Validation</th></tr></thead>
                <tbody id="importPreviewBody"></tbody>
              </table>
            </div>
            <div id="importPreviewSummary" class="mt-2"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" id="importDryRunBtn">Dry Run</button>
            <button type="button" class="btn btn-primary" id="importApplyBtn">Apply</button>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    const body = container.querySelector("#importPreviewBody");

    items.forEach((it, idx) => {
      const pairKey = `${it.namespace}::${it.locale}`;
      const existing = (existingMaps[pairKey] || {})[it.key] || "";
      const tr = document.createElement("tr");
      const valid = !!(it.namespace && it.key && it.locale);
      tr.innerHTML = `
        <td><input type="checkbox" class="importUse" data-idx="${idx}" ${
        valid ? "checked" : ""
      } ${!valid ? "disabled" : ""} /></td>
        <td><input class="form-control form-control-sm import-namespace" value="${escapeHtml(
          it.namespace
        )}" /></td>
        <td><input class="form-control form-control-sm import-key" value="${escapeHtml(
          it.key
        )}" /></td>
        <td><input class="form-control form-control-sm import-locale" value="${escapeHtml(
          it.locale
        )}" /></td>
        <td><div class="text-muted small existing-text">${escapeHtml(
          existing
        )}</div></td>
        <td><textarea class="form-control form-control-sm import-text" rows="1">${escapeHtml(
          it.text
        )}</textarea></td>
        <td class="validation-cell">${
          valid
            ? ""
            : '<span class="text-danger">missing namespace/key/locale</span>'
        }</td>
      `;
      body.appendChild(tr);
    });

    const modal = new bootstrap.Modal(container, { backdrop: "static" });
    modal.show();

    function collectPreviewSelected() {
      const rows = Array.from(
        container.querySelectorAll("#importPreviewBody tr")
      );
      return rows
        .map((r) => ({
          namespace: r.querySelector(".import-namespace").value.trim(),
          key: r.querySelector(".import-key").value.trim(),
          locale: r.querySelector(".import-locale").value.trim().toLowerCase(),
          text: r.querySelector(".import-text").value || "",
          use: r.querySelector(".importUse").checked,
        }))
        .filter((it) => it.use);
    }

    async function doDryRun() {
      const selected = collectPreviewSelected();
      if (!selected.length) return showToast("No rows selected", "warning");
      const allowCreate =
        !!container.querySelector("#importAllowCreate").checked;
      // run dry-run on server
      try {
        const resp = await fetch("/api/admin/i18n?dryRun=1", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${api.getToken()}`,
          },
          body: JSON.stringify(selected),
        });
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || JSON.stringify(data));
        }
        // Summarize
        const s = data.summary || {};
        container.querySelector(
          "#importPreviewSummary"
        ).innerHTML = `<div>Dry run summary: <strong>inserts</strong>=${
          s.insert || 0
        }, <strong>updates</strong>=${s.update || 0}, <strong>noop</strong>=${
          s.noop || 0
        }, <strong>invalid</strong>=${s.invalid || 0}</div>`;
        // Highlight rows that would be inserts when allowCreate is false
        if (!allowCreate && (s.insert || 0) > 0) {
          container.querySelector("#importPreviewSummary").innerHTML +=
            ' <span class="text-danger">(inserts detected; enable "Allow creating new translation keys" to proceed)</span>';
        }
        showToast("Dry run completed", "success");
        return data;
      } catch (err) {
        console.error("Dry run error", err);
        showToast("Dry run failed", "danger");
        return null;
      }
    }

    async function doApply() {
      const selected = collectPreviewSelected();
      if (!selected.length) return showToast("No rows selected", "warning");
      const allowCreate =
        !!container.querySelector("#importAllowCreate").checked;
      // If not allowing create, filter out rows that are inserts (we need to know which)
      // Perform a dry-run first to check what would be inserted
      const dry = await doDryRun();
      if (!dry) return;
      const inserts =
        dry.summary && dry.summary.insert ? dry.summary.insert : 0;
      if (inserts > 0 && !allowCreate) {
        return showToast(
          "Import contains new keys; enable allow create to proceed",
          "danger"
        );
      }

      // Confirm large imports
      if (selected.length > 100) {
        if (
          !confirm(
            `You are about to import ${selected.length} translations. Continue?`
          )
        )
          return;
      }

      try {
        // Apply and request recording of the import (for audit) using filename if available
        const filename =
          (document.getElementById("importTranslationsFile").files &&
            document.getElementById("importTranslationsFile").files[0] &&
            document.getElementById("importTranslationsFile").files[0].name) ||
          null;
        const resp = await fetch(
          `/api/admin/i18n?recordImport=1&filename=${encodeURIComponent(
            filename || ""
          )}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${api.getToken()}`,
            },
            body: JSON.stringify(selected),
          }
        );
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || JSON.stringify(data));
        }
        showToast(`Imported ${selected.length} translations`, "success");
        // Add any new locales to selects
        const localeSet = new Set(
          selected.map((s) => s.locale).filter(Boolean)
        );
        for (const l of localeSet)
          ensureLocaleInSelect(
            document.getElementById("translationsLocale"),
            l
          );
        // Reload translations to refresh cache
        if (window.app && typeof window.app.loadTranslations === "function") {
          try {
            await window.app.loadTranslations(window.app.locale);
            console.log("✓ Translations cache refreshed after import");
          } catch (err) {
            console.error("Failed to refresh translations cache:", err);
          }
        }
        // Close modal and refresh table
        modal.hide();
        // cleanup
        container.remove();
        // reload current view
        await loadTranslationsForSelected();
      } catch (err) {
        console.error("Apply import error", err);
        showToast("Import failed", "danger");
      }
    }

    container.querySelector("#importDryRunBtn").onclick = async () => {
      await doDryRun();
    };
    container.querySelector("#importApplyBtn").onclick = async () => {
      await doApply();
    };

    container.addEventListener("hidden.bs.modal", () => {
      // cleanup DOM
      try {
        container.remove();
      } catch (e) {}
    });
  }

  // Import logs viewer (simple)
  async function loadImportLogs() {
    try {
      const rows = await api.getTranslationImports(50);
      let html = `<div class="card"><div class="card-header bg-secondary text-white">Recent Translation Imports</div><div class="card-body"><table class="table table-sm table-striped"><thead><tr><th>When</th><th>By</th><th>File</th><th>Total</th><th>Inserted</th><th>Updated</th><th>Invalid</th></tr></thead><tbody>`;
      (rows || []).forEach((r) => {
        html += `<tr><td>${r.created_at}</td><td>${
          r.admin_username || r.admin_user_id
        }</td><td>${r.filename || ""}</td><td>${r.total_rows}</td><td>${
          r.inserted
        }</td><td>${r.updated}</td><td>${r.invalid}</td></tr>`;
      });
      html += `</tbody></table></div></div>`;
      // show in admin content area
      const container = document.getElementById("adminContent");
      container.innerHTML = html;
    } catch (err) {
      console.error("Error loading import logs", err);
      showToast("Failed to load import logs", "danger");
    }
  }

  function collectTableTranslations() {
    const rows = Array.from(
      document.querySelectorAll("#translationsTableBody tr")
    );
    const items = rows
      .map((row) => {
        const keyElement = row.querySelector(".trans-key");
        const key = (keyElement.textContent || keyElement.value || "").trim();
        const text = row.querySelector(".trans-text").value;
        const locale = (row.querySelector(".trans-locale").value || "")
          .trim()
          .toLowerCase();
        const namespace =
          row.dataset.namespace ||
          document.getElementById("translationsNamespace").value;
        return { namespace, key, locale, text };
      })
      .filter((it) => it.key);
    return items;
  }

  async function saveTranslationsFromTable() {
    const items = collectTableTranslations();
    if (!items.length) {
      showToast("No translations to save", "warning");
      return;
    }
    try {
      await api.updateTranslations(items);
      showToast("Translations saved", "success");
      // Ensure any locales in saved items are available in select
      const localeSet = new Set(
        items.map((i) => (i.locale || "").toLowerCase()).filter(Boolean)
      );
      for (const l of localeSet) {
        ensureLocaleInSelect(document.getElementById("translationsLocale"), l);
      }
      // Reload translations in the current app locale to refresh the cache
      if (window.app && typeof window.app.loadTranslations === "function") {
        try {
          await window.app.loadTranslations(window.app.locale);
          console.log("✓ Translations cache refreshed after save");
        } catch (err) {
          console.error("Failed to refresh translations cache:", err);
        }
      }
    } catch (err) {
      console.error("Save translations error", err);
      showToast("Error saving translations", "danger");
    }
  }

  function exportTranslationsJson() {
    const items = collectTableTranslations();
    const data = JSON.stringify(items, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translations-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportTranslationsCsv() {
    const items = collectTableTranslations();
    const header = "namespace,key,locale,text";
    const lines = items.map(
      (it) =>
        `${it.namespace},${escapeCsv(it.key)},${it.locale},${escapeCsv(
          it.text
        )}`
    );
    const blob = new Blob([[header].concat(lines).join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translations-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function escapeCsv(s) {
    return '"' + String(s || "").replace(/"/g, '""') + '"';
  }

  async function initAdmin() {
    console.log("[ADMIN] initAdmin called");
    currentAdminTab = "users";
    await new Promise((resolve) => setTimeout(resolve, 100));
    await switchAdminTab("users");
  }

  function showAddUserModal() {
    document.getElementById("addUserForm").reset();
    document.getElementById("addUserAlert").innerHTML = "";
    loadCompaniesForModal("addUserCompany", "addFillInCompany");
    // Populate truck types for user dropdown from fleet (if available)
    populateUserTruckTypeOptions("addMegaKast");
    new bootstrap.Modal(document.getElementById("addUserModal")).show();
  }

  async function submitAddUser() {
    const username = document.getElementById("addUsername").value;
    const password = document.getElementById("addPassword").value;
    const fullName = document.getElementById("addFullName").value;

    if (!username || !password || !fullName) {
      document.getElementById("addUserAlert").innerHTML =
        '<div class="alert alert-danger">Username, Password and Full Name are required</div>';
      return;
    }

    try {
      await api.createUser({
        username,
        password,
        fullName,
        phone: document.getElementById("addPhone").value,
        ritnumber: document.getElementById("addRitnumber").value,
        role: document.getElementById("addRole").value,
        megaKast: document.getElementById("addMegaKast").value,
        adr: document.getElementById("addAdr").value === "1",
        companyId: document.getElementById("addUserCompany").value || null,
        canFillIn: document.getElementById("addCanFillIn").value === "1",
        fillInCompanyId:
          document.getElementById("addFillInCompany").value || null,
      });
      document.getElementById("addUserAlert").innerHTML =
        '<div class="alert alert-success">User created successfully!</div>';
      setTimeout(() => {
        bootstrap.Modal.getInstance(
          document.getElementById("addUserModal")
        ).hide();
        loadAdminUsers();
      }, 1000);
    } catch (error) {
      document.getElementById(
        "addUserAlert"
      ).innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  function openEditUserModal(userId) {
    const user = allUsers.find((u) => u.id === userId);
    if (!user) return;

    document.getElementById("editUserId").value = userId;
    document.getElementById("editUsername").value = user.username;
    document.getElementById("editFullName").value = user.full_name;
    document.getElementById("editPhone").value = user.phone || "";
    document.getElementById("editRitnumber").value = user.ritnumber || "";
    document.getElementById("editRole").value = user.role || "user";
    document.getElementById("editMegaKast").value =
      user.mega_kast || "only_mega";
    document.getElementById("editAdr").value = user.adr ? "1" : "0";
    document.getElementById("editCanFillIn").value = user.can_fill_in
      ? "1"
      : "0";

    // Populate truck types and set current value
    populateUserTruckTypeOptions("editMegaKast", user.mega_kast || "only_mega");

    loadCompaniesForModal("editCompany", "editFillInCompany");

    document.getElementById("editFillInCompanyContainer").style.display =
      user.can_fill_in ? "block" : "none";
    document.getElementById("editUserAlert").innerHTML = "";
    new bootstrap.Modal(document.getElementById("editUserModal")).show();
  }

  async function submitEditUser() {
    const userId = document.getElementById("editUserId").value;
    try {
      await api.updateUser(userId, {
        fullName: document.getElementById("editFullName").value,
        phone: document.getElementById("editPhone").value,
        ritnumber: document.getElementById("editRitnumber").value,
        role: document.getElementById("editRole").value,
        megaKast: document.getElementById("editMegaKast").value,
        adr: document.getElementById("editAdr").value === "1",
        companyId: document.getElementById("editCompany").value || null,
        canFillIn: document.getElementById("editCanFillIn").value === "1",
        fillInCompanyId:
          document.getElementById("editFillInCompany").value || null,
      });
      document.getElementById("editUserAlert").innerHTML =
        '<div class="alert alert-success">Saved!</div>';
      setTimeout(() => {
        bootstrap.Modal.getInstance(
          document.getElementById("editUserModal")
        ).hide();
        loadAdminUsers();
      }, 1000);
    } catch (error) {
      document.getElementById(
        "editUserAlert"
      ).innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  function showAddCompanyModal() {
    document.getElementById("addCompanyForm").reset();
    document.getElementById("addCompanyPauseTime").value = "00:30";
    document.getElementById("addCompanyAlert").innerHTML = "";
    new bootstrap.Modal(document.getElementById("addCompanyModal")).show();
  }

  async function submitAddCompany() {
    const name = document.getElementById("addCompanyName").value;
    if (!name) {
      document.getElementById("addCompanyAlert").innerHTML =
        '<div class="alert alert-danger">Company name is required</div>';
      return;
    }

    try {
      await api.createCompany({
        name,
        phone: document.getElementById("addCompanyPhone").value,
        kvk: document.getElementById("addCompanyKvk").value,
        btw: document.getElementById("addCompanyBtw").value,
        address: document.getElementById("addCompanyAddress").value,
        postal_code: document.getElementById("addCompanyPostalCode").value,
        city: document.getElementById("addCompanyCity").value,
        pause_time:
          document.getElementById("addCompanyPauseTime").value || "00:30",
      });
      document.getElementById("addCompanyAlert").innerHTML =
        '<div class="alert alert-success">Company created successfully!</div>';
      setTimeout(() => {
        bootstrap.Modal.getInstance(
          document.getElementById("addCompanyModal")
        ).hide();
        loadCompaniesManagement();
      }, 1000);
    } catch (error) {
      document.getElementById(
        "addCompanyAlert"
      ).innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  function openEditCompanyModal(companyId) {
    const company = allCompanies.find((c) => c.id === companyId);
    if (!company) return;

    document.getElementById("editCompanyId").value = companyId;
    document.getElementById("editCompanyName").value = company.name;
    document.getElementById("editCompanyPhone").value = company.phone || "";
    document.getElementById("editCompanyKvk").value = company.kvk || "";
    document.getElementById("editCompanyBtw").value = company.btw || "";
    document.getElementById("editCompanyAddress").value = company.address || "";
    document.getElementById("editCompanyPostalCode").value =
      company.postal_code || "";
    document.getElementById("editCompanyCity").value = company.city || "";
    document.getElementById("editCompanyPauseTime").value =
      company.pause_time || "00:30";
    document.getElementById("editCompanyAlert").innerHTML = "";
    new bootstrap.Modal(document.getElementById("editCompanyModal")).show();
  }

  async function submitEditCompany() {
    const companyId = document.getElementById("editCompanyId").value;
    try {
      await api.updateCompany(companyId, {
        name: document.getElementById("editCompanyName").value,
        phone: document.getElementById("editCompanyPhone").value,
        kvk: document.getElementById("editCompanyKvk").value,
        btw: document.getElementById("editCompanyBtw").value,
        address: document.getElementById("editCompanyAddress").value,
        postal_code: document.getElementById("editCompanyPostalCode").value,
        city: document.getElementById("editCompanyCity").value,
        pause_time: document.getElementById("editCompanyPauseTime").value,
      });
      document.getElementById("editCompanyAlert").innerHTML =
        '<div class="alert alert-success">Saved!</div>';
      setTimeout(() => {
        bootstrap.Modal.getInstance(
          document.getElementById("editCompanyModal")
        ).hide();
        loadCompaniesManagement();
      }, 1000);
    } catch (error) {
      document.getElementById(
        "editCompanyAlert"
      ).innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  function toggleAddFillInCompany() {
    const container = document.getElementById("addFillInCompanyContainer");
    const value = document.getElementById("addCanFillIn").value;
    container.style.display = value === "1" ? "block" : "none";
  }

  function toggleEditFillInCompany() {
    const container = document.getElementById("editFillInCompanyContainer");
    const value = document.getElementById("editCanFillIn").value;
    container.style.display = value === "1" ? "block" : "none";
  }

  async function loadCompaniesForModal(
    selectId,
    fillInSelectId,
    selectedCompanyId = null,
    selectedFillInCompanyId = null
  ) {
    try {
      const companies = await api.getCompanies();
      const select = document.getElementById(selectId);
      const fillInSelect = document.getElementById(fillInSelectId);

      if (!select || !fillInSelect) return;

      const options = companies
        .map(
          (c) =>
            `<option value="${c.id}" ${
              c.id === selectedCompanyId ? "selected" : ""
            }>${c.name}</option>`
        )
        .join("");
      const fillInOptions = companies
        .map(
          (c) =>
            `<option value="${c.id}" ${
              c.id === selectedFillInCompanyId ? "selected" : ""
            }>${c.name}</option>`
        )
        .join("");

      select.innerHTML = '<option value="">No company</option>' + options;
      fillInSelect.innerHTML =
        '<option value="">Select company</option>' + fillInOptions;
    } catch (error) {
      console.error("[ADMIN] Error loading companies for modal:", error);
    }
  }
  async function populateUserTruckTypeOptions(selectId, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = "";
    try {
      const types = await api.getFleetTypes();
      if (types && types.length > 0) {
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "(No selection)";
        select.appendChild(emptyOpt);
        types.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t;
          opt.textContent = t;
          if (t === selectedValue) opt.selected = true;
          select.appendChild(opt);
        });
      } else {
        const fallback = [
          { v: "only_mega", t: "Mega Only" },
          { v: "mega_and_kast", t: "Mega + Kast" },
          { v: "nvt", t: "N.v.t." },
        ];
        fallback.forEach((f) => {
          const opt = document.createElement("option");
          opt.value = f.v;
          opt.textContent = f.t;
          if (f.v === selectedValue) opt.selected = true;
          select.appendChild(opt);
        });
      }
    } catch (error) {
      console.error("Error loading truck types:", error);
    }
  }

  // ========== RENDER ADMIN PORTAL ==========

  function renderAdmin() {
    return `
    <div class="container-fluid mt-3">
      <div class="row">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-header bg-primary text-white">
              <h5 class="mb-0"><i class="bi bi-gear"></i> Admin Portal</h5>
            </div>
            <div class="card-body">
              <ul class="nav nav-tabs mb-3" role="tablist">
                <li class="nav-item">
                  <a class="nav-link active" href="#" data-tab="users" onclick="switchAdminTab('users'); return false;">
                    <i class="bi bi-people"></i> Users
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="companies" onclick="switchAdminTab('companies'); return false;">
                    <i class="bi bi-building"></i> Companies
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="submissions" onclick="switchAdminTab('submissions'); return false;">
                    <i class="bi bi-file-earmark-text"></i> Submissions
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="hours-report" onclick="switchAdminTab('hours-report'); return false;">
                    <i class="bi bi-bar-chart"></i> Hours Report
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="leave" onclick="switchAdminTab('leave'); return false;">
                    <i class="bi bi-airplane"></i> Leave
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="fleet" onclick="switchAdminTab('fleet'); return false;">
                    <i class="bi bi-truck"></i> Fleet
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="planning" onclick="switchAdminTab('planning'); return false;">
                    <i class="bi bi-calendar-week"></i> Planning
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="smtp" onclick="switchAdminTab('smtp'); return false;">
                    <i class="bi bi-envelope"></i> SMTP
                  </a>
                </li>
                <li class="nav-item">
                  <a class="nav-link" href="#" data-tab="branding" onclick="switchAdminTab('branding'); return false;">
                    <i class="bi bi-palette"></i> Branding
                  </a>
                </li>
                <!-- Menu tab intentionally hidden for now; functionality retained for future use -->
                <!-- Translations tab intentionally hidden for now; functionality kept for future use -->
              </ul>
              <div id="adminContent"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <div class="modal fade" id="addUserModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add New User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div id="addUserAlert"></div>
            <form id="addUserForm">
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.username">Username *</label>
                    <input type="text" class="form-control" id="addUsername" required>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.password">Password *</label>
                    <input type="password" class="form-control" id="addPassword" required>
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label" data-i18n="field:users.fullName">Full Name *</label>
                <input type="text" class="form-control" id="addFullName" required>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.phone">Phone Number</label>
                    <input type="tel" class="form-control" id="addPhone">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.ritnumber">Rit Number</label>
                    <input type="text" class="form-control" id="addRitnumber">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.role">Role</label>
                    <select class="form-select" id="addRole">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.truckType">Truck Type</label>
                    <select class="form-select" id="addMegaKast">
                      <option value="only_mega">Mega Only</option>
                      <option value="mega_and_kast">Mega + Kast</option>
                      <option value="nvt">N.v.t.</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.adr">ADR</label>
                    <select class="form-select" id="addAdr">
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.company">Company</label>
                    <select class="form-select" id="addUserCompany">
                      <option value="">No company</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.canFillIn">Can Fill In (Invallen)</label>
                    <select class="form-select" id="addCanFillIn" onchange="toggleAddFillInCompany()">
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3" id="addFillInCompanyContainer" style="display: none;">
                    <label class="form-label" data-i18n="field:users.fillInCompany">Fill In Company</label>
                    <select class="form-select" id="addFillInCompany">
                      <option value="">Select company</option>
                    </select>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitAddUser()">Create User</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div class="modal fade" id="editUserModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div id="editUserAlert"></div>
            <form id="editUserForm">
              <input type="hidden" id="editUserId">
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.username">Username</label>
                    <input type="text" class="form-control" id="editUsername" readonly>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.fullName">Full Name</label>
                    <input type="text" class="form-control" id="editFullName" required>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.phone">Phone Number</label>
                    <input type="tel" class="form-control" id="editPhone">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.ritnumber">Rit Number</label>
                    <input type="text" class="form-control" id="editRitnumber">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.role">Role</label>
                    <select class="form-select" id="editRole">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.truckType">Truck Type</label>
                    <select class="form-select" id="editMegaKast">
                      <option value="only_mega">Mega Only</option>
                      <option value="mega_and_kast">Mega + Kast</option>
                      <option value="nvt">N.v.t.</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label" data-i18n="field:users.adr">ADR</label>
                    <select class="form-select" id="editAdr">
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Company</label>
                    <select class="form-select" id="editCompany">
                      <option value="">No company</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Can Fill In (Invallen)</label>
                    <select class="form-select" id="editCanFillIn" onchange="toggleEditFillInCompany()">
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3" id="editFillInCompanyContainer" style="display: none;">
                    <label class="form-label">Fill In Company</label>
                    <select class="form-select" id="editFillInCompany">
                      <option value="">Select company</option>
                    </select>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEditUser()">Save</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Company Modal -->
    <div class="modal fade" id="addCompanyModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add New Company</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div id="addCompanyAlert"></div>
            <form id="addCompanyForm">
              <div class="mb-3">
                <label class="form-label">Company Name *</label>
                <input type="text" class="form-control" id="addCompanyName" required>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" class="form-control" id="addCompanyPhone">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">KvK Number</label>
                    <input type="text" class="form-control" id="addCompanyKvk">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">BTW Number</label>
                    <input type="text" class="form-control" id="addCompanyBtw">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Pause Time (HH:MM)</label>
                    <input type="text" class="form-control" id="addCompanyPauseTime" value="00:30">
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Address</label>
                <input type="text" class="form-control" id="addCompanyAddress">
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Postal Code</label>
                    <input type="text" class="form-control" id="addCompanyPostalCode">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">City</label>
                    <input type="text" class="form-control" id="addCompanyCity">
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitAddCompany()">Create Company</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Company Modal -->
    <div class="modal fade" id="editCompanyModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Company</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div id="editCompanyAlert"></div>
            <form id="editCompanyForm">
              <input type="hidden" id="editCompanyId">
              <div class="mb-3">
                <label class="form-label">Company Name *</label>
                <input type="text" class="form-control" id="editCompanyName" required>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" class="form-control" id="editCompanyPhone">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">KvK Number</label>
                    <input type="text" class="form-control" id="editCompanyKvk">
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">BTW Number</label>
                    <input type="text" class="form-control" id="editCompanyBtw">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Pause Time (HH:MM)</label>
                    <input type="text" class="form-control" id="editCompanyPauseTime">
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Address</label>
                <input type="text" class="form-control" id="editCompanyAddress">
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">Postal Code</label>
                    <input type="text" class="form-control" id="editCompanyPostalCode">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label class="form-label">City</label>
                    <input type="text" class="form-control" id="editCompanyCity">
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEditCompany()">Save</button>
          </div>
        </div>
      </div>
    </div>
  `;
  }

  // ========== USERS MANAGEMENT ==========

  async function loadAdminUsers() {
    const container = document.getElementById("adminContent");
    if (!container) return;
    container.innerHTML =
      '<div class="text-center"><div class="spinner-border"></div></div>';

    try {
      allUsers = await api.getUsers();
      // Fetch current admin MFA status to decide which actions to show
      let adminMfaEnabled = false;
      try {
        const resp = await fetch(`${API_BASE_URL}/mfa/status`, {
          headers: { Authorization: `Bearer ${api.getToken()}` },
        });
        if (resp.ok) {
          const json = await resp.json();
          adminMfaEnabled = !!json.mfaEnabled;
        }
      } catch (e) {
        console.warn("Could not fetch admin MFA status:", e);
      }

      renderAdminUsers(allUsers, adminMfaEnabled);
    } catch (error) {
      container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }

  function renderAdminUsers(users, adminMfaEnabled = false) {
    const container = document.getElementById("adminContent");
    container.innerHTML = `
    <div class="mb-3 d-flex flex-wrap gap-2">
      <button class="btn btn-primary" onclick="showAddUserModal()">
        <i class="bi bi-plus-circle"></i> Add User
      </button>
    </div>
    <div class="table-responsive">
      <table class="table table-striped table-hover table-sm" id="usersTable">
        <thead class="table-dark">
          <tr>
            <th style="width: 20px;" class="d-md-none"></th>
            <th>ID</th>
            <th>Username</th>
            <th>Full Name</th>
            <th>Company</th>
            <th>Role</th>
            <th>ADR</th>
            <th>Admin</th>
            <th class="text-center d-none d-md-table-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (user) => `
            <tr class="user-row" data-user-id="${user.id}">
              <td class="text-center d-md-none" style="cursor: pointer; padding: 0.4rem 0.3rem;">
                <i class="bi bi-chevron-down toggle-details" onclick="toggleUserDetails(${user.id})" style="font-size: 0.8rem;"></i>
              </td>
              <td><small>${user.id}</small></td>
              <td><small>${user.username}</small></td>
              <td><small>${user.full_name}</small></td>
              <td><small>${user.company_name || "-"}</small></td>
              <td><span class="badge bg-info" style="font-size: 0.75rem;">${user.role || "user"}</span></td>
              <td><span class="badge ${user.adr ? 'bg-success' : 'bg-secondary'}" style="font-size: 0.75rem;">${user.adr ? 'Yes' : 'No'}</span></td>
              <td><span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-secondary'}" style="font-size: 0.75rem;">${user.role === 'admin' ? 'Yes' : 'No'}</span></td>
              <td class="text-center d-none d-md-table-cell">
                <div class="d-flex justify-content-center gap-1">
                  <button class="btn btn-warning btn-sm px-2" onclick="openEditUserModal(${user.id})" title="Edit">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-outline-danger btn-sm px-2" onclick="openResetMfaModal(${user.id}, '${user.username}')" title="Reset MFA">
                    <i class="bi bi-shield-lock"></i>
                  </button>
                  ${adminMfaEnabled ? `<button class="btn btn-outline-primary btn-sm px-2" onclick="openResetPasswordModal(${user.id}, '${user.username}')" title="Reset Password"><i class="bi bi-key"></i></button>` : ''}
                </div>
              </td>
            </tr>
            <tr class="user-details-row d-none" id="details-${user.id}">
              <td colspan="9" style="padding: 0;">
                <div class="p-3 bg-light border-top">
                  <h6 class="mb-3">${user.full_name} - ${user.username}</h6>
                  <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-warning btn-sm px-2 flex-grow-1" onclick="openEditUserModal(${user.id})">
                      <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-outline-danger btn-sm px-2 flex-grow-1" onclick="openResetMfaModal(${user.id}, '${user.username}')">
                      <i class="bi bi-shield-lock"></i> Reset MFA
                    </button>
                    ${adminMfaEnabled ? `<button class="btn btn-outline-primary btn-sm px-2 flex-grow-1" onclick="openResetPasswordModal(${user.id}, '${user.username}')"><i class="bi bi-key"></i> Reset Wachtwoord</button>` : ''}
                  </div>
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
  
    // Attach event listeners untuk toggle details
    const detailsRows = container.querySelectorAll('.user-row');
    detailsRows.forEach(row => {
      row.addEventListener('click', function(e) {
        if (e.target.closest('.toggle-details')) return;
        const userId = this.getAttribute('data-user-id');
        toggleUserDetails(userId);
      });
    });
  }
  
  function toggleUserDetails(userId) {
    const detailsRow = document.getElementById(`details-${userId}`);
    if (detailsRow) {
      detailsRow.classList.toggle('d-none');
      // Scroll ke detail row
      if (!detailsRow.classList.contains('d-none')) {
        setTimeout(() => {
          detailsRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
  }

  // ========== MFA RESET (ADMIN) ==========
  let resetMfaUserId = null;

  function ensureResetMfaModal() {
    if (document.getElementById("resetMfaModal")) return;

    const modalHTML = `
      <div class="modal fade" id="resetMfaModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-shield-lock"></i> Reset MFA</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div id="resetMfaAlert"></div>
              <p class="text-muted">${adminTr(
                "mfa.reset_confirm",
                "Confirm with your own MFA code to reset this user's MFA"
              )}</p>
              <div class="mb-3">
                <label class="form-label">${adminTr(
                  "mfa.admin_code",
                  "Admin MFA code"
                )}</label>
                <input type="text" class="form-control text-center" id="resetMfaToken" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" placeholder="000000">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${adminTr(
                "cancel",
                "Cancel"
              )}</button>
              <button type="button" class="btn btn-danger" onclick="submitResetMfa()">
                <i class="bi bi-shield-lock"></i> Reset MFA
              </button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
  }

  // ========== RESET USER PASSWORD (ADMIN) ==========
  let resetPasswordUserId = null;

  function ensureResetPasswordModal() {
    if (document.getElementById("resetPasswordModal")) return;

    const modalHTML = `
      <div class="modal fade" id="resetPasswordModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-key"></i> Reset Wachtwoord</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div id="resetPasswordAlert"></div>
              <p class="text-muted">Voer jouw eigen MFA-code ter bevestiging en kies een nieuw wachtwoord of genereer een tijdelijk wachtwoord.</p>
              <div class="mb-3">
                <label class="form-label">Admin MFA code</label>
                <input type="text" class="form-control text-center" id="resetPasswordMfaToken" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" placeholder="000000">
              </div>
              <div class="mb-3">
                <label class="form-label">Nieuw wachtwoord (optioneel)</label>
                <input type="text" class="form-control" id="resetPasswordNew" placeholder="Laat leeg om tijdelijk wachtwoord te genereren">
                <div class="form-text">Laat leeg om automatisch een tijdelijk wachtwoord te genereren en (optioneel) naar de gebruiker te e-mailen.</div>
              </div>
              <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="resetPasswordShow" checked>
                <label class="form-check-label" for="resetPasswordShow">Toon tijdelijk wachtwoord na reset</label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
              <button type="button" class="btn btn-primary" onclick="submitResetPassword()">
                <i class="bi bi-key"></i> Reset wachtwoord
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
  }

  function openResetPasswordModal(userId, username) {
    resetPasswordUserId = userId;
    ensureResetPasswordModal();
    document.getElementById("resetPasswordAlert").innerHTML = "";
    document.getElementById("resetPasswordMfaToken").value = "";
    document.getElementById("resetPasswordNew").value = "";
    document.getElementById("resetPasswordShow").checked = true;

    const modalEl = document.getElementById("resetPasswordModal");
    modalEl.querySelector(
      ".modal-title"
    ).innerHTML = `<i class="bi bi-key"></i> Reset wachtwoord voor <strong>${username}</strong>`;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  async function submitResetPassword() {
    const alertDiv = document.getElementById("resetPasswordAlert");
    const mfaToken = document
      .getElementById("resetPasswordMfaToken")
      .value.trim();
    const newPassword = document.getElementById("resetPasswordNew").value;
    const showPassword = !!document.getElementById("resetPasswordShow").checked;

    if (!mfaToken || mfaToken.length !== 6) {
      alertDiv.innerHTML =
        '<div class="alert alert-warning">Voer een geldige 6-cijferige admin MFA-code in.</div>';
      return;
    }

    alertDiv.innerHTML =
      '<div class="alert alert-info">Bezig met resetten...</div>';

    try {
      const resp = await api.resetUserPassword(resetPasswordUserId, {
        newPassword: newPassword || undefined,
        showPassword,
        mfaToken,
      });

      if (resp && resp.tempPassword) {
        alertDiv.innerHTML = `<div class="alert alert-success">Wachtwoord gereset. Tijdelijk wachtwoord: <code>${resp.tempPassword}</code></div>`;
      } else if (resp && resp.emailed) {
        alertDiv.innerHTML = `<div class="alert alert-success">Wachtwoord gereset en naar de gebruiker gemaild.</div>`;
      } else {
        alertDiv.innerHTML = `<div class="alert alert-success">Wachtwoord gereset.</div>`;
      }

      setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("resetPasswordModal")
        );
        if (modal) modal.hide();
        loadAdminUsers();
      }, 2200);
    } catch (error) {
      alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  function openResetMfaModal(userId, username) {
    resetMfaUserId = userId;
    ensureResetMfaModal();
    document.getElementById("resetMfaAlert").innerHTML = "";
    document.getElementById("resetMfaToken").value = "";

    const modalEl = document.getElementById("resetMfaModal");
    modalEl.querySelector(
      ".modal-title"
    ).innerHTML = `<i class="bi bi-shield-lock"></i> Reset MFA voor <strong>${username}</strong>`;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  async function submitResetMfa() {
    const alertDiv = document.getElementById("resetMfaAlert");
    const token = document.getElementById("resetMfaToken").value.trim();

    if (!token || token.length !== 6) {
      alertDiv.innerHTML = `<div class="alert alert-warning">${adminTr(
        "mfa.invalid_code",
        "Enter a valid 6-digit code"
      )}</div>`;
      return;
    }

    try {
      await api.resetUserMfa(resetMfaUserId, token);
      alertDiv.innerHTML = `<div class="alert alert-success">${adminTr(
        "mfa.reset_success",
        "MFA reset. User must setup MFA again at next login."
      )}</div>`;
      setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("resetMfaModal")
        );
        modal.hide();
        loadAdminUsers();
      }, 1200);
    } catch (error) {
      alertDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  // ========== COMPANIES MANAGEMENT ==========

  async function loadCompaniesManagement() {
    const container = document.getElementById("adminContent");
    if (!container) return;
    container.innerHTML =
      '<div class="text-center"><div class="spinner-border"></div></div>';

    try {
      allCompanies = await api.getCompanies();
      renderCompaniesManagement(allCompanies);
    } catch (error) {
      container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }

  function renderCompaniesManagement(companies) {
    const container = document.getElementById("adminContent");

    container.innerHTML = `
    <div class="mb-3 d-flex flex-wrap gap-2">
      <button class="btn btn-primary" onclick="showAddCompanyModal()">
        <i class="bi bi-plus-circle"></i> Add Company
      </button>
    </div>
    <div class="table-responsive">
      <table class="table table-striped table-hover table-sm" id="companiesTable">
        <thead class="table-dark">
          <tr>
            <th style="width: 20px;" class="d-md-none"></th>
            <th>Name</th>
            <th>City</th>
            <th>Phone</th>
            <th>KvK</th>
            <th>BTW</th>
            <th class="text-center d-none d-md-table-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${companies
            .map(
              (company) => `
            <tr class="company-row" data-company-id="${company.id}">
              <td class="text-center d-md-none" style="cursor: pointer; padding: 0.4rem 0.3rem;">
                <i class="bi bi-chevron-down toggle-details" onclick="toggleCompanyDetails(${company.id})" style="font-size: 0.8rem;"></i>
              </td>
              <td><small><strong>${company.name}</strong></small></td>
              <td><small>${company.city || "-"}</small></td>
              <td><small>${company.phone || "-"}</small></td>
              <td><small>${company.kvk || "-"}</small></td>
              <td><small>${company.btw || "-"}</small></td>
              <td class="text-center d-none d-md-table-cell">
                <button class="btn btn-sm btn-warning" onclick="openEditCompanyModal(${company.id})" title="Edit">
                  <i class="bi bi-pencil"></i>
                </button>
              </td>
            </tr>
            <tr class="company-details-row d-none" id="details-company-${company.id}">
              <td colspan="7" style="padding: 0;">
                <div class="p-3 bg-light border-top">
                  <h6 class="mb-3">${company.name}</h6>
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label class="form-label text-muted small">Address</label>
                      <p class="small">${company.address || "-"}</p>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label text-muted small">Postal Code</label>
                      <p class="small">${company.postal_code || "-"}</p>
                    </div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label class="form-label text-muted small">Phone</label>
                      <p class="small">${company.phone || "-"}</p>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label text-muted small">Pause Time</label>
                      <p class="small"><span class="badge bg-info">${company.pause_time || "00:30"}</span></p>
                    </div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <label class="form-label text-muted small">KvK Number</label>
                      <p class="small">${company.kvk || "-"}</p>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label text-muted small">BTW Number</label>
                      <p class="small">${company.btw || "-"}</p>
                    </div>
                  </div>
                  <div class="d-grid gap-2 d-sm-flex gap-2">
                    <button class="btn btn-warning btn-sm flex-grow-1" onclick="openEditCompanyModal(${company.id})">
                      <i class="bi bi-pencil"></i> Edit
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

    // Attach event listeners voor toggle details
    const detailsRows = container.querySelectorAll('.company-row');
    detailsRows.forEach(row => {
      row.addEventListener('click', function(e) {
        if (e.target.closest('.toggle-details')) return;
        const companyId = this.getAttribute('data-company-id');
        toggleCompanyDetails(companyId);
      });
    });
  }

  function toggleCompanyDetails(companyId) {
    const detailsRow = document.getElementById(`details-company-${companyId}`);
    if (detailsRow) {
      detailsRow.classList.toggle('d-none');
      // Scroll ke detail row
      if (!detailsRow.classList.contains('d-none')) {
        setTimeout(() => {
          detailsRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
  }

  // ========== PLACEHOLDER TABS ==========

  async function loadAdminSubmissions() {
    const container = document.getElementById("adminContent");
    if (!container) return;
    container.innerHTML =
      '<div class="text-center"><div class="spinner-border"></div></div>';

    try {
      currentSubmissions = await api.getAdminSubmissions();
      console.log("[ADMIN] Submissions loaded:", currentSubmissions);
      renderAdminSubmissions(currentSubmissions);
    } catch (error) {
      console.error("[ADMIN] Error loading submissions:", error);
      container.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }

  function renderAdminSubmissions(submissions) {
    const container = document.getElementById("adminContent");

    if (!submissions || submissions.length === 0) {
      container.innerHTML =
        '<div class="alert alert-info">No submissions found</div>';
      return;
    }

    container.innerHTML = `
    <div class="table-responsive d-none d-md-block">
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Company</th>
            <th>Weeknummers</th>
            <th>Total Hours</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${submissions
            .map((submission) => {
              let weekStr = "-";
              if (submission.week_numbers) {
                const weeks = submission.week_numbers
                  .split(",")
                  .map((w) => `W${w.trim()}`);
                weekStr = weeks.join(", ");
              }

              let submittedStr = "-";
              if (submission.submission_date) {
                submittedStr = new Date(
                  submission.submission_date
                ).toLocaleDateString("nl-NL");
              }

              return `
            <tr>
              <td>${submission.id}</td>
              <td>${submission.full_name || submission.username || "-"}</td>
              <td>${submission.company_name || "-"}</td>
              <td>${weekStr}</td>
              <td><strong>${
                submission.total_hours
                  ? parseFloat(submission.total_hours).toFixed(2)
                  : "0.00"
              }</strong></td>
              <td>
                <span class="badge ${getSubmissionStatusBadge(
                  submission.status
                )}">
                  ${submission.status || "pending"}
                </span>
              </td>
              <td>${submittedStr}</td>
              <td>
                <button class="btn btn-sm btn-info" onclick="viewSubmissionDetails(${
                  submission.id
                })" title="View details">
                  <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-warning" onclick="editSubmissionHours(${
                  submission.id
                })" title="Edit hours">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-primary" onclick="emailSubmission(${
                  submission.id
                })" title="Send email">
                  <i class="bi bi-envelope"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteSubmission(${
                  submission.id
                })" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="d-md-none">
      <table class="table table-striped table-hover table-sm">
        <thead class="table-dark">
          <tr>
            <th style="width: 20px;"></th>
            <th>User</th>
            <th>Company</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          ${submissions
            .map((submission) => {
              let weekStr = "-";
              if (submission.week_numbers) {
                const weeks = submission.week_numbers
                  .split(",")
                  .map((w) => `W${w.trim()}`);
                weekStr = weeks.join(", ");
              }

              let submittedStr = "-";
              if (submission.submission_date) {
                submittedStr = new Date(
                  submission.submission_date
                ).toLocaleDateString("nl-NL");
              }

              return `
            <tr class="submission-row" data-submission-id="${submission.id}">
              <td class="text-center" style="cursor: pointer; padding: 0.4rem 0.3rem;">
                <i class="bi bi-chevron-down toggle-details" onclick="toggleSubmissionDetails(${submission.id})" style="font-size: 0.8rem;"></i>
              </td>
              <td><small><strong>${submission.full_name || submission.username || "-"}</strong></small></td>
              <td><small>${submission.company_name || "-"}</small></td>
              <td><small><strong>${
                submission.total_hours
                  ? parseFloat(submission.total_hours).toFixed(2)
                  : "0.00"
              }</strong></small></td>
            </tr>
            <tr class="submission-details-row d-none" id="details-submission-${submission.id}">
              <td colspan="4" style="padding: 0;">
                <div class="p-3 bg-light border-top">
                  <h6 class="mb-3">${submission.full_name || submission.username || "-"}</h6>
                  <div class="row mb-3">
                    <div class="col-6">
                      <label class="form-label text-muted small">ID</label>
                      <p class="small">${submission.id}</p>
                    </div>
                    <div class="col-6">
                      <label class="form-label text-muted small">Weeknummers</label>
                      <p class="small">${weekStr}</p>
                    </div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-6">
                      <label class="form-label text-muted small">Status</label>
                      <p class="small">
                        <span class="badge ${getSubmissionStatusBadge(submission.status)}">
                          ${submission.status || "pending"}
                        </span>
                      </p>
                    </div>
                    <div class="col-6">
                      <label class="form-label text-muted small">Submitted</label>
                      <p class="small">${submittedStr}</p>
                    </div>
                  </div>
                  <div class="d-grid gap-2">
                    <button class="btn btn-info btn-sm" onclick="viewSubmissionDetails(${submission.id})">
                      <i class="bi bi-eye"></i> View Details
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="editSubmissionHours(${submission.id})">
                      <i class="bi bi-pencil"></i> Edit Hours
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="emailSubmission(${submission.id})">
                      <i class="bi bi-envelope"></i> Send Email
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSubmission(${submission.id})">
                      <i class="bi bi-trash"></i> Delete
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;

    // Attach event listeners for toggle details
    const detailsRows = container.querySelectorAll('.submission-row');
    detailsRows.forEach(row => {
      row.addEventListener('click', function(e) {
        if (e.target.closest('.toggle-details')) return;
        const submissionId = this.getAttribute('data-submission-id');
        toggleSubmissionDetails(submissionId);
      });
    });
  }

  function toggleSubmissionDetails(submissionId) {
    const detailsRow = document.getElementById(`details-submission-${submissionId}`);
    const icon = document.querySelector(`[data-submission-id="${submissionId}"] .toggle-details`);
    
    if (detailsRow && icon) {
      detailsRow.classList.toggle('d-none');
      icon.classList.toggle('bi-chevron-down');
      icon.classList.toggle('bi-chevron-up');
    }
  }

  function formatDateRange(startDate, endDate) {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate).toLocaleDateString("nl-NL");
    const end = new Date(endDate).toLocaleDateString("nl-NL");
    return `${start} - ${end}`;
  }

  function getSubmissionStatusBadge(status) {
    switch (status) {
      case "pending":
        return "bg-warning";
      case "submitted":
        return "bg-info";
      case "approved":
        return "bg-success";
      case "rejected":
        return "bg-danger";
      default:
        return "bg-secondary";
    }
  }

  async function viewSubmissionDetails(submissionId) {
    try {
      const timesheets = await api.getSubmissionTimesheets(submissionId);
      showSubmissionModal(submissionId, timesheets);
    } catch (error) {
      alert("Error loading submission details: " + error.message);
    }
  }

  function showSubmissionModal(submissionId, timesheets) {
    const submission = currentSubmissions.find((s) => s.id === submissionId);
    if (!submission) return;

    const modalHtml = `
    <div class="modal fade" id="submissionModal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Submission Details - ID ${
              submission.id
            }</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div class="row mb-4">
              <div class="col-md-3">
                <label class="form-label text-muted">User</label>
                <p class="form-control-plaintext"><strong>${
                  submission.user_name || submission.username || "-"
                }</strong></p>
              </div>
              <div class="col-md-3">
                <label class="form-label text-muted">Company</label>
                <p class="form-control-plaintext"><strong>${
                  submission.company_name || "-"
                }</strong></p>
              </div>
              <div class="col-md-3">
                <label class="form-label text-muted">Period</label>
                <p class="form-control-plaintext"><strong>${
                  submission.period ||
                  formatDateRange(submission.start_date, submission.end_date) ||
                  "-"
                }</strong></p>
              </div>
              <div class="col-md-3">
                <label class="form-label text-muted">Status</label>
                <p class="form-control-plaintext">
                  <span class="badge ${getSubmissionStatusBadge(
                    submission.status
                  )}">
                    ${submission.status || "pending"}
                  </span>
                </p>
              </div>
            </div>
            
            <h6 class="mb-3">Timesheets</h6>
            <div class="table-responsive">
              <table class="table table-sm table-striped">
                <thead class="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Break</th>
                    <th>Hours</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${timesheets
                    .map(
                      (ts) => `
                    <tr>
                      <td>${new Date(ts.date).toLocaleDateString("nl-NL")}</td>
                      <td>${getDayName(ts.date)}</td>
                      <td>${ts.start_time || "-"}</td>
                      <td>${ts.end_time || "-"}</td>
                      <td>${ts.break_duration || "-"}</td>
                      <td>${ts.hours || "-"}</td>
                      <td>${ts.notes || "-"}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

    // Remove old modal if exists
    const oldModal = document.getElementById("submissionModal");
    if (oldModal) oldModal.remove();

    // Add and show modal
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    new bootstrap.Modal(document.getElementById("submissionModal")).show();
  }

  function getDayName(dateStr) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const date = new Date(dateStr);
    return days[date.getDay()];
  }

  async function deleteSubmission(submissionId) {
    if (!confirm("Are you sure you want to delete this submission?")) return;

    try {
      await api.deleteSubmission(submissionId);
      alert("Submission deleted successfully");
      loadAdminSubmissions();
    } catch (error) {
      alert("Error deleting submission: " + error.message);
    }
  }

  async function editSubmissionHours(submissionId) {
    try {
      const timesheets = await api.getSubmissionTimesheets(submissionId);
      showEditSubmissionModal(submissionId, timesheets);
    } catch (error) {
      alert("Error loading submission: " + error.message);
    }
  }

  function showEditSubmissionModal(submissionId, timesheets) {
    const submission = currentSubmissions.find((s) => s.id === submissionId);
    if (!submission) return;

    const modalHtml = `
    <div class="modal fade" id="editSubmissionModal" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Submission Hours - ID ${
              submission.id
            }</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
            <div class="row mb-4">
              <div class="col-md-3">
                <label class="form-label text-muted">User</label>
                <p class="form-control-plaintext"><strong>${
                  submission.full_name || submission.username || "-"
                }</strong></p>
              </div>
              <div class="col-md-3">
                <label class="form-label text-muted">Company</label>
                <p class="form-control-plaintext"><strong>${
                  submission.company_name || "-"
                }</strong></p>
              </div>
              <div class="col-md-6">
                <label class="form-label text-muted">Period</label>
                <p class="form-control-plaintext"><strong>${getSubmissionPeriod(
                  submission
                )}</strong></p>
              </div>
            </div>
            
            <h6 class="mb-3">Edit Hours</h6>
            <div class="table-responsive">
              <table class="table table-sm table-striped">
                <thead class="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Pause</th>
                    <th>Total Hours</th>
                    <th>Start KM</th>
                    <th>End KM</th>
                    <th>Ritnumber</th>
                  </tr>
                </thead>
                <tbody id="editTimesheetsBody">
                  ${timesheets
                    .map(
                      (ts) => `
                    <tr>
                      <td>${new Date(ts.date).toLocaleDateString("nl-NL")}</td>
                      <td>${getDayName(ts.date)}</td>
                      <td><input type="time" class="form-control form-control-sm" value="${
                        ts.start_time ?? ""
                      }" data-ts-id="${ts.id}" data-field="startTime"></td>
                      <td><input type="time" class="form-control form-control-sm" value="${
                        ts.end_time ?? ""
                      }" data-ts-id="${ts.id}" data-field="endTime"></td>
                      <td><input type="text" class="form-control form-control-sm" value="${
                        ts.pause_time ?? ts.break_duration ?? ts.pauseTime ?? ""
                      }" data-ts-id="${
                        ts.id
                      }" data-field="pauseTime" placeholder="HH:MM"></td>
                      <td><input type="number" class="form-control form-control-sm" value="${
                        ts.total_hours ?? ts.hours ?? ts.totalHours ?? ""
                      }" data-ts-id="${
                        ts.id
                      }" data-field="totalHours" step="0.25"></td>
                      <td><input type="number" class="form-control form-control-sm" value="${
                        ts.start_km ?? ""
                      }" data-ts-id="${
                        ts.id
                      }" data-field="startKm" step="0.1"></td>
                      <td><input type="number" class="form-control form-control-sm" value="${
                        ts.end_km ?? ""
                      }" data-ts-id="${
                        ts.id
                      }" data-field="endKm" step="0.1"></td>
                      <td><input type="text" class="form-control form-control-sm" value="${
                        ts.ritnumber ?? ""
                      }" data-ts-id="${ts.id}" data-field="ritnumber"></td>
                      <td><input type="hidden" value="${ts.date}" data-ts-id="${
                        ts.id
                      }" data-field="date"></td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="saveEditedSubmission(${submissionId})">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  `;

    const oldModal = document.getElementById("editSubmissionModal");
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML("beforeend", modalHtml);
    new bootstrap.Modal(document.getElementById("editSubmissionModal")).show();
  }

  async function saveEditedSubmission(submissionId) {
    try {
      const inputs = document.querySelectorAll("#editTimesheetsBody input");
      const updates = {};

      inputs.forEach((input) => {
        const timesheetId = input.getAttribute("data-ts-id");
        const field = input.getAttribute("data-field");
        const value = input.value;

        if (!updates[timesheetId]) {
          updates[timesheetId] = {};
        }
        updates[timesheetId][field] = value;
      });

      for (const [timesheetId, data] of Object.entries(updates)) {
        await api.updateAdminTimesheet(timesheetId, data);
      }

      alert("Hours updated successfully");
      bootstrap.Modal.getInstance(
        document.getElementById("editSubmissionModal")
      ).hide();
      loadAdminSubmissions();
    } catch (error) {
      alert("Error saving changes: " + error.message);
    }
  }

  function emailSubmission(submissionId) {
    const submission = currentSubmissions.find((s) => s.id === submissionId);
    if (!submission) return;

    const modalHtml = `
    <div class="modal fade" id="emailSubmissionModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Send Submission Email</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Recipient Email</label>
              <input type="email" class="form-control" id="emailRecipient" value="${
                submission.email || ""
              }" required>
            </div>
            <div class="mb-3">
              <label class="form-label">Subject</label>
              <input type="text" class="form-control" id="emailSubject" value="Timesheet Submission - ${
                submission.full_name || submission.username
              }">
            </div>
            <div class="mb-3">
              <label class="form-label">Format</label>
              <select class="form-select" id="emailFormat">
                <option value="pdf">PDF</option>
                <option value="xlsx">Excel</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="sendEmailSubmission(${submissionId})">Send Email</button>
          </div>
        </div>
      </div>
    </div>
  `;

    const oldModal = document.getElementById("emailSubmissionModal");
    if (oldModal) oldModal.remove();

    document.body.insertAdjacentHTML("beforeend", modalHtml);
    new bootstrap.Modal(document.getElementById("emailSubmissionModal")).show();
  }

  async function sendEmailSubmission(submissionId) {
    try {
      const recipient = document.getElementById("emailRecipient").value;
      const format = document.getElementById("emailFormat").value;

      if (!recipient) {
        alert("Please enter a recipient email");
        return;
      }

      await api.sendCustomSubmissionEmail(submissionId, recipient, format);
      alert("Email sent successfully");
      bootstrap.Modal.getInstance(
        document.getElementById("emailSubmissionModal")
      ).hide();
    } catch (error) {
      alert("Error sending email: " + error.message);
    }
  }

  function getSubmissionPeriod(submission) {
    if (submission.period_start && submission.period_end) {
      const start = new Date(submission.period_start).toLocaleDateString(
        "nl-NL"
      );
      const end = new Date(submission.period_end).toLocaleDateString("nl-NL");
      return `${start} - ${end}`;
    } else if (submission.period) {
      return submission.period;
    }
    return "-";
  }

  async function loadHoursReport() {
    const container = document.getElementById("adminContent");
    container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">Hours Report</h5>
      <button class="btn btn-sm btn-outline-secondary" id="refreshHoursReport">
        <i class="bi bi-arrow-clockwise"></i> Refresh
      </button>
    </div>
    <div id="hoursReportBody">
      <div class="text-center text-muted py-4">
        <div class="spinner-border" role="status"></div>
        <div class="mt-2">Loading hours report...</div>
      </div>
    </div>
  `;

    document.getElementById("refreshHoursReport").onclick = loadHoursReport;

    try {
      const report = await api.getHoursReport();

      if (!report || report.length === 0) {
        document.getElementById("hoursReportBody").innerHTML =
          '<div class="alert alert-info">No data found</div>';
        return;
      }

      const rows = report
        .map(
          (row) => `
      <tr>
        <td>${row.full_name || "-"}</td>
        <td>${row.week_number ?? "-"}</td>
        <td>${row.work_days ?? 0}</td>
        <td>${parseFloat(row.total_hours || 0).toFixed(2)}</td>
        <td>${parseFloat(row.overworked || 0).toFixed(2)}</td>
      </tr>
    `
        )
        .join("");

      document.getElementById("hoursReportBody").innerHTML = `
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th>User</th>
              <th>Week</th>
              <th>Work Days</th>
              <th>Total Hours</th>
              <th>Overworked</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
    } catch (error) {
      console.error("[ADMIN] Error loading hours report:", error);
      document.getElementById(
        "hoursReportBody"
      ).innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }



  window.adminDecideLeave = async function (id, status) {
    try {
      let adminNote = "";
      if (status === "rejected") {
        adminNote = prompt("Reden voor afwijzing (optioneel):", "") || "";
      }
      await api.decideLeaveRequest(id, status, adminNote);
      loadLeaveManagement();
    } catch (error) {
      alert("Error updating leave request: " + error.message);
    }
  };

  async function loadFleetManagement() {
    const container = document.getElementById("adminContent");
    container.innerHTML = `
    <div class="row h-100">
      <div class="col-md-4">
        <div class="card">
          <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Fleet</h6>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-light" id="refreshFleet"><i class="bi bi-arrow-clockwise"></i></button>
              <button class="btn btn-success" id="addFleetBtn"><i class="bi bi-plus-circle"></i></button>
            </div>
          </div>
          <div class="card-body p-0" style="max-height: 600px; overflow-y: auto;" id="fleetListWrapper">
            <div class="text-center py-4"><div class="spinner-border"></div></div>
          </div>
        </div>
      </div>
      <div class="col-md-8" id="fleetDetailWrapper">
        <div class="alert alert-info mt-2">Selecteer een voertuig of voeg er een toe.</div>
      </div>
    </div>
  `;

    document.getElementById("refreshFleet").onclick = loadFleetManagement;
    document.getElementById("addFleetBtn").onclick = showAddVehicleModal;

    try {
      const [vehicles, companies] = await Promise.all([
        api.getFleetVehicles(),
        api.getCompanies(),
      ]);
      window.companies = companies;
      renderFleetList(vehicles);
    } catch (error) {
      document.getElementById(
        "fleetListWrapper"
      ).innerHTML = `<div class="alert alert-danger m-2">Error: ${error.message}</div>`;
    }
  }

  let fleetVehicles = [];
  let fleetMaintenance = [];
  let selectedVehicleId = null;
  let fleetLoadingId = null;

  function renderFleetList(vehicles) {
    fleetVehicles = vehicles || [];
    const wrapper = document.getElementById("fleetListWrapper");
    if (!wrapper) return;

    if (!vehicles || vehicles.length === 0) {
      wrapper.innerHTML = `<div class="p-3 text-muted">${adminTr(
        "fleet.no_vehicles",
        "No vehicles"
      )}</div>`;
      document.getElementById(
        "fleetDetailWrapper"
      ).innerHTML = `<div class="alert alert-info mt-2">${adminTr(
        "fleet.add_first",
        "Add a vehicle first."
      )}</div>`;
      return;
    }

    wrapper.innerHTML = `
    <div class="list-group list-group-flush">
      ${vehicles
        .map(
          (v) => `
        <button type="button" class="list-group-item list-group-item-action ${
          v.id === selectedVehicleId ? "active" : ""
        }" onclick="selectVehicle(${v.id})">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>${v.license_plate}</strong>
              <small class="d-block text-muted">KM: ${v.km ?? 0} | ${
            v.company_name || adminTr("no_company", "No company")
          }</small>
            </div>
            <span class="badge bg-secondary">APK ${
              v.apk_due_date
                ? new Date(v.apk_due_date).toLocaleDateString("nl-NL")
                : "-"
            }</span>
          </div>
        </button>
      `
        )
        .join("")}
    </div>
  `;

    if (selectedVehicleId) {
      selectVehicle(selectedVehicleId);
    } else if (vehicles.length > 0) {
      selectVehicle(vehicles[0].id);
    }
  }

  async function selectVehicle(id) {
    if (fleetLoadingId === id) return; // Prevent duplicate requests
    fleetLoadingId = id;
    selectedVehicleId = id;
    const detail = document.getElementById("fleetDetailWrapper");
    detail.innerHTML =
      '<div class="text-center py-4"><div class="spinner-border"></div></div>';
    try {
      const data = await api.getFleetVehicle(id);
      if (fleetLoadingId === id) {
        // Only render if still the current selection
        fleetMaintenance = data.maintenance || []; // Store maintenance records
        renderVehicleDetail(data.vehicle, data.maintenance || []);
        renderFleetList(fleetVehicles); // refresh active state
      }
    } catch (error) {
      if (fleetLoadingId === id) {
        detail.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
      }
    } finally {
      if (fleetLoadingId === id) fleetLoadingId = null;
    }
  }

  function renderVehicleDetail(vehicle, maintenance) {
    const detail = document.getElementById("fleetDetailWrapper");
    if (!vehicle) {
      detail.innerHTML = `<div class="alert alert-info">${adminTr(
        "fleet.select_vehicle",
        "Select a vehicle"
      )}</div>`;
      return;
    }

    // Normalize placeholder-only maintenance list to render empty-state
    const normalizedMaintenance =
      Array.isArray(maintenance) &&
      maintenance.length === 1 &&
      maintenance[0] &&
      typeof maintenance[0].notes === "string" &&
      maintenance[0].notes.trim() === "fleet.no_maintenance"
        ? []
        : maintenance;

    const maintenanceRows = normalizedMaintenance.length
      ? normalizedMaintenance
          .map(
            (m) => `
        <tr>
          <td>${new Date(m.maintenance_date).toLocaleDateString("nl-NL")}</td>
          <td>${m.km ?? "-"}</td>
          <td>${(m && typeof m.notes === "string" && m.notes.trim() === "fleet.no_maintenance") ? '<span data-i18n="admin:fleet.no_maintenance">No maintenance records</span>' : (m.notes || "-")}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-warning me-1" onclick="showEditMaintenanceModal(${
              m.id
            }, ${m.vehicle_id})"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteMaintenanceRecord(${
              m.id
            })"><i class="bi bi-trash"></i></button>
          </td>
        </tr>
      `
          )
          .join("")
      : `<tr><td colspan="4" class="text-center text-muted" data-i18n="admin:fleet.no_maintenance">No maintenance records</td></tr>`;

    detail.innerHTML = `
    <div class="card">
      <div class="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
        <h6 class="mb-0">${vehicle.license_plate}</h6>
        <button class="btn btn-sm btn-warning" onclick="showEditVehicleModal(${
          vehicle.id
        })"><i class="bi bi-pencil"></i> Edit</button>
      </div>
      <div class="card-body">
        <div class="row mb-4">
          <div class="col-md-6">
            <label class="form-label text-muted small">Kenteken</label>
            <p class="form-control-plaintext"><strong>${
              vehicle.license_plate
            }</strong></p>
          </div>
          <div class="col-md-6">
            <label class="form-label text-muted small">Rit nummer</label>
            <p class="form-control-plaintext">${vehicle.rit_number || "-"}</p>
          </div>
        </div>
        <div class="row mb-4">
          <div class="col-md-6">
            <label class="form-label text-muted small">Truck Type</label>
            <p class="form-control-plaintext">${vehicle.truck_type || "-"}</p>
          </div>
        </div>
        <div class="row mb-4">
          <div class="col-md-6">
            <label class="form-label text-muted small">KM</label>
            <p class="form-control-plaintext">${vehicle.km ?? 0}</p>
          </div>
          <div class="col-md-6">
            <label class="form-label text-muted small">APK geldig tot</label>
            <p class="form-control-plaintext">${
              vehicle.apk_due_date
                ? new Date(vehicle.apk_due_date).toLocaleDateString("nl-NL")
                : "-"
            }</p>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="mb-0">Onderhoud</h6>
          <button class="btn btn-primary btn-sm" onclick="showAddMaintenanceModal(${
            vehicle.id
          })">
            <i class="bi bi-wrench"></i> Nieuw onderhoud
          </button>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-striped">
            <thead class="table-light">
              <tr>
                <th>Datum</th>
                <th>KM</th>
                <th>Toelichting</th>
                <th class="text-end">Acties</th>
              </tr>
            </thead>
            <tbody>
              ${maintenanceRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
    
    // Apply translations to data-i18n elements
    if (window.app && window.app.applyTranslationsToDom) {
      setTimeout(() => window.app.applyTranslationsToDom(), 0);
    }
  }

  function showAddVehicleModal() {
    const modalHtml = `
    <div class="modal fade" id="addVehicleModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Nieuw voertuig</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label" data-i18n="field:fleet.license_plate">Kenteken</label>
              <input type="text" class="form-control" id="vehicleLicense" required>
            </div>
            <div class="mb-3">
              <label class="form-label" data-i18n="field:fleet.company">Bedrijf</label>
              <select class="form-select" id="vehicleCompany">
                <option value="">Geen bedrijf</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label" data-i18n="field:fleet.km">KM</label>
              <input type="number" class="form-control" id="vehicleKm" value="0" step="0.1">
            </div>
            <div class="mb-3">
              <label class="form-label" data-i18n="field:fleet.apk_due_date">APK geldig tot</label>
              <input type="date" class="form-control" id="vehicleApk">
            </div>
            <div class="mb-3">
              <label class="form-label" data-i18n="field:fleet.rit_number">Rit nummer</label>
              <input type="text" class="form-control" id="vehicleRit">
            </div>
            <div class="mb-3">
              <label class="form-label" data-i18n="field:fleet.truck_type">Truck Type</label>
              <input type="text" class="form-control" id="vehicleTruckType" placeholder="E.g. Mega, Mega+Kast, N.v.t.">
            </div>
            <div id="vehicleAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitAddVehicle()">${adminTr(
              "save",
              "Save"
            )}</button>
          </div>
        </div>
      </div>
    </div>
  `;

    const old = document.getElementById("addVehicleModal");
    if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Populate companies dropdown
    const companySelect = document.getElementById("vehicleCompany");
    if (window.companies && window.companies.length > 0) {
      window.companies.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        companySelect.appendChild(opt);
      });
    }

    new bootstrap.Modal(document.getElementById("addVehicleModal")).show();
  }

  async function submitAddVehicle() {
    const license = document.getElementById("vehicleLicense").value.trim();
    if (!license) {
      document.getElementById("vehicleAlert").innerHTML =
        '<div class="alert alert-danger">Kenteken is verplicht</div>';
      return;
    }
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = adminTr("saving", "Saving...");
    try {
      await api.createFleetVehicle({
        license_plate: license,
        company_id: document.getElementById("vehicleCompany").value || null,
        km: parseFloat(document.getElementById("vehicleKm").value || "0"),
        apk_due_date: document.getElementById("vehicleApk").value || null,
        rit_number: document.getElementById("vehicleRit").value || null,
        truck_type: document.getElementById("vehicleTruckType").value || null,
      });
      const modal = document.getElementById("addVehicleModal");
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) bsModal.hide();
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for modal to close
      await loadFleetManagement();
    } catch (error) {
      btn.disabled = false;
      btn.textContent = originalText;
      document.getElementById(
        "vehicleAlert"
      ).innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  function showEditVehicleModal(id) {
    const v = fleetVehicles.find((x) => x.id === id) || {};
    const modalHtml = `
    <div class="modal fade" id="editVehicleModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Bewerk voertuig</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Kenteken</label>
              <input type="text" class="form-control" id="editVehicleLicense" value="${
                v.license_plate || ""
              }">
            </div>
            <div class="mb-3">
              <label class="form-label">Bedrijf</label>
              <select class="form-select" id="editVehicleCompany">
                <option value="">Geen bedrijf</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">KM</label>
              <input type="number" class="form-control" id="editVehicleKm" value="${
                v.km ?? 0
              }" step="0.1">
            </div>
            <div class="mb-3">
              <label class="form-label">APK geldig tot</label>
              <input type="date" class="form-control" id="editVehicleApk" value="${
                v.apk_due_date ? v.apk_due_date.slice(0, 10) : ""
              }">
            </div>
            <div class="mb-3">
              <label class="form-label">Rit nummer</label>
              <input type="text" class="form-control" id="editVehicleRit" value="${
                v.rit_number || ""
              }">
            </div>
            <div class="mb-3">
              <label class="form-label">Truck Type</label>
              <input type="text" class="form-control" id="editVehicleTruckType" value="${
                v.truck_type || ""
              }" placeholder="E.g. Mega, Mega+Kast, N.v.t.">
            </div>
            <div id="editVehicleAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEditVehicle(${id})">${adminTr(
      "save",
      "Save"
    )}</button>
          </div>
        </div>
      </div>
    </div>
  `;
    const old = document.getElementById("editVehicleModal");
    if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Populate companies dropdown
    const companySelect = document.getElementById("editVehicleCompany");
    if (window.companies && window.companies.length > 0) {
      window.companies.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        opt.selected = c.id === v.company_id;
        companySelect.appendChild(opt);
      });
    }

    new bootstrap.Modal(document.getElementById("editVehicleModal")).show();
  }

  async function submitEditVehicle(id) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = adminTr("saving", "Saving...");
    try {
      await api.updateFleetVehicle(id, {
        license_plate:
          document.getElementById("editVehicleLicense").value.trim() || null,
        company_id: document.getElementById("editVehicleCompany").value || null,
        km: parseFloat(document.getElementById("editVehicleKm").value || "0"),
        apk_due_date: document.getElementById("editVehicleApk").value || null,
        rit_number: document.getElementById("editVehicleRit").value || null,
        truck_type:
          document.getElementById("editVehicleTruckType").value || null,
      });
      const modal = document.getElementById("editVehicleModal");
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) bsModal.hide();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await loadFleetManagement();
    } catch (error) {
      btn.disabled = false;
      btn.textContent = originalText;
      document.getElementById(
        "editVehicleAlert"
      ).innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  function showAddMaintenanceModal(vehicleId) {
    const modalHtml = `
    <div class="modal fade" id="addMaintenanceModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Nieuw onderhoud</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Datum onderhoud</label>
              <input type="date" class="form-control" id="maintDate" required>
            </div>
            <div class="mb-3">
              <label class="form-label">KM</label>
              <input type="number" class="form-control" id="maintKm" step="0.1">
            </div>
            <div class="mb-3">
              <label class="form-label">Toelichting</label>
              <textarea class="form-control" id="maintNotes" rows="3"></textarea>
            </div>
            <div id="maintAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitMaintenance(${vehicleId})">${adminTr(
      "save",
      "Save"
    )}</button>
          </div>
        </div>
      </div>
    </div>
  `;
    const old = document.getElementById("addMaintenanceModal");
    if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    new bootstrap.Modal(document.getElementById("addMaintenanceModal")).show();
  }

  async function submitMaintenance(vehicleId) {
    const date = document.getElementById("maintDate").value;
    if (!date) {
      document.getElementById("maintAlert").innerHTML =
        '<div class="alert alert-danger">Datum is verplicht</div>';
      return;
    }
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = adminTr("saving", "Saving...");
    try {
      await api.addFleetMaintenance(vehicleId, {
        maintenance_date: date,
        km: parseFloat(document.getElementById("maintKm").value || "0"),
        notes: document.getElementById("maintNotes").value || null,
      });
      const modal = document.getElementById("addMaintenanceModal");
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) bsModal.hide();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await selectVehicle(vehicleId);
    } catch (error) {
      btn.disabled = false;
      btn.textContent = originalText;
      document.getElementById(
        "maintAlert"
      ).innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  function showEditMaintenanceModal(maintenanceId, vehicleId) {
    console.log(
      "[FLEET] showEditMaintenanceModal called with ID:",
      maintenanceId,
      "Vehicle ID:",
      vehicleId
    );
    console.log("[FLEET] fleetMaintenance array:", fleetMaintenance);
    const maintenance =
      fleetMaintenance.find((m) => m.id === maintenanceId) || {};
    console.log("[FLEET] Found maintenance:", maintenance);
    const modalHtml = `
    <div class="modal fade" id="editMaintenanceModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Bewerk onderhoud</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Datum onderhoud</label>
              <input type="date" class="form-control" id="editMaintDate" value="${
                maintenance.maintenance_date
                  ? maintenance.maintenance_date.slice(0, 10)
                  : ""
              }" required>
            </div>
            <div class="mb-3">
              <label class="form-label">KM</label>
              <input type="number" class="form-control" id="editMaintKm" value="${
                maintenance.km ?? 0
              }" step="0.1">
            </div>
            <div class="mb-3">
              <label class="form-label">Toelichting</label>
              <textarea class="form-control" id="editMaintNotes" rows="3">${
                maintenance.notes || ""
              }</textarea>
            </div>
            <div id="editMaintAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEditMaintenance(${maintenanceId}, ${vehicleId})">${adminTr(
      "save",
      "Save"
    )}</button>
          </div>
        </div>
      </div>
    </div>
  `;
    const old = document.getElementById("editMaintenanceModal");
    if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    new bootstrap.Modal(document.getElementById("editMaintenanceModal")).show();
  }

  async function submitEditMaintenance(maintenanceId, vehicleId) {
    const date = document.getElementById("editMaintDate").value;
    if (!date) {
      document.getElementById("editMaintAlert").innerHTML =
        '<div class="alert alert-danger">Datum is verplicht</div>';
      return;
    }
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = adminTr("saving", "Saving...");
    try {
      await api.updateFleetMaintenance(maintenanceId, {
        maintenance_date: date,
        km: parseFloat(document.getElementById("editMaintKm").value || "0"),
        notes: document.getElementById("editMaintNotes").value || null,
      });
      const modal = document.getElementById("editMaintenanceModal");
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) bsModal.hide();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await selectVehicle(vehicleId);
    } catch (error) {
      btn.disabled = false;
      btn.textContent = originalText;
      document.getElementById(
        "editMaintAlert"
      ).innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  async function deleteMaintenanceRecord(maintenanceId) {
    console.log(
      "[FLEET] deleteMaintenanceRecord called with ID:",
      maintenanceId
    );
    const modalHtml = `
    <div class="modal fade" id="deleteMaintenanceModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title">${adminTr(
              "fleet.delete_maintenance",
              "Delete maintenance"
            )}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>${adminTr(
              "confirm_delete",
              "Are you sure you want to delete? This cannot be undone."
            )}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${adminTr(
              "cancel",
              "Cancel"
            )}</button>
            <button type="button" class="btn btn-danger" onclick="confirmDeleteMaintenance(${maintenanceId})">${adminTr(
      "delete",
      "Delete"
    )}</button>
          </div>
        </div>
      </div>
    </div>
  `;
    const old = document.getElementById("deleteMaintenanceModal");
    if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    new bootstrap.Modal(
      document.getElementById("deleteMaintenanceModal")
    ).show();
  }

  async function confirmDeleteMaintenance(maintenanceId) {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = adminTr("deleting", "Deleting...");
    try {
      await api.deleteFleetMaintenance(maintenanceId);
      // Find the vehicle ID from the current detail
      const vehicleId = selectedVehicleId;
      const modal = document.getElementById("deleteMaintenanceModal");
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) bsModal.hide();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await selectVehicle(vehicleId);
    } catch (error) {
      btn.disabled = false;
      btn.textContent = adminTr("delete", "Delete");
      alert(`Error: ${error.message}`);
    }
  }

  // ========== PLANNING MANAGEMENT ==========
  let currentPlanningWeek = null;

  function getISOWeekNumber(date = new Date()) {
    const tmp = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  }

  async function loadPlanningManagement() {
    const container = document.getElementById("adminContent");
    currentPlanningWeek = currentPlanningWeek || getISOWeekNumber();

    container.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-end mb-3 gap-2">
      <div>
        <label class="form-label mb-1">Weeknummer</label>
        <div class="input-group" style="max-width: 240px;">
          <input type="number" min="1" max="53" class="form-control" id="planningWeekInput" value="${currentPlanningWeek}">
          <button class="btn btn-outline-secondary" id="planningWeekRefresh"><i class="bi bi-arrow-clockwise"></i></button>
        </div>
      </div>
      <div>
        <label class="form-label mb-1">Bedrijf (filter)</label>
        <div class="input-group" style="min-width: 280px;">
          <select class="form-select" id="planningCompanyFilter"><option value="">Alle bedrijven</option></select>
          <button class="btn btn-outline-secondary" id="planningGenerateCompanyBtn" title="Voeg alle chauffeurs toe"><i class="bi bi-person-plus"></i></button>
        </div>
      </div>
      <div class="btn-group d-none d-md-flex">
        <button class="btn btn-primary" id="planningAddBtn"><i class="bi bi-plus-circle"></i> Nieuwe planning</button>
        <button class="btn btn-outline-secondary" id="planningGenerateBtn"><i class="bi bi-magic"></i> Genereer week</button>
        <button class="btn btn-outline-info" id="planningGenerateVehiclesBtn"><i class="bi bi-truck"></i> Gen. per voertuig</button>
        <button class="btn btn-outline-warning" id="planningClearBtn"><i class="bi bi-trash"></i> Wis week</button>
        <button class="btn btn-outline-success" id="planningPdfBtn"><i class="bi bi-file-earmark-pdf"></i> Export PDF</button>
        <button class="btn btn-outline-info" id="planningEmailBtn"><i class="bi bi-envelope"></i> E-mail PDF</button>
      </div>
      <div class="d-md-none w-100">
        <div class="d-grid gap-1">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-primary" id="planningAddBtnMobile"><i class="bi bi-plus-circle"></i></button>
            <button class="btn btn-outline-secondary" id="planningGenerateBtnMobile" title="Genereer week"><i class="bi bi-magic"></i></button>
            <button class="btn btn-outline-info" id="planningGenerateVehiclesBtnMobile" title="Gen. per voertuig"><i class="bi bi-truck"></i></button>
          </div>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-warning" id="planningClearBtnMobile" title="Wis week"><i class="bi bi-trash"></i></button>
            <button class="btn btn-outline-success" id="planningPdfBtnMobile" title="Export PDF"><i class="bi bi-file-earmark-pdf"></i></button>
            <button class="btn btn-outline-info" id="planningEmailBtnMobile" title="E-mail PDF"><i class="bi bi-envelope"></i></button>
          </div>
        </div>
      </div>
    </div>
    <div id="planningList">
      <div class="text-center text-muted py-4">
        <div class="spinner-border" role="status"></div>
        <div class="mt-2">Laden...</div>
      </div>
    </div>
  `;

    document.getElementById("planningWeekRefresh").onclick = () =>
      loadPlanningManagement();
    document.getElementById("planningWeekInput").onchange = async (e) => {
      currentPlanningWeek = Math.max(
        1,
        Math.min(53, parseInt(e.target.value || "1", 10))
      );
      await loadPlanningManagement();
    };
    
    // Desktop buttons
    const addBtn = document.getElementById("planningAddBtn");
    const generateBtn = document.getElementById("planningGenerateBtn");
    const clearBtn = document.getElementById("planningClearBtn");
    const pdfBtn = document.getElementById("planningPdfBtn");
    const emailBtn = document.getElementById("planningEmailBtn");
    
    if (addBtn) addBtn.onclick = () => showAddPlanningModal();
    if (generateBtn) generateBtn.onclick = () => generatePlanning();
    if (clearBtn) clearBtn.onclick = () => clearPlanningWeek();
    if (pdfBtn) pdfBtn.onclick = () => exportPlanningPDF();
    if (emailBtn) emailBtn.onclick = () => emailPlanningPDF();
    
    // Mobile buttons
    const addBtnMobile = document.getElementById("planningAddBtnMobile");
    const generateBtnMobile = document.getElementById("planningGenerateBtnMobile");
    const clearBtnMobile = document.getElementById("planningClearBtnMobile");
    const pdfBtnMobile = document.getElementById("planningPdfBtnMobile");
    const emailBtnMobile = document.getElementById("planningEmailBtnMobile");
    
    if (addBtnMobile) addBtnMobile.onclick = () => showAddPlanningModal();
    if (generateBtnMobile) generateBtnMobile.onclick = () => generatePlanning();
    if (clearBtnMobile) clearBtnMobile.onclick = () => clearPlanningWeek();
    if (pdfBtnMobile) pdfBtnMobile.onclick = () => exportPlanningPDF();
    if (emailBtnMobile) emailBtnMobile.onclick = () => emailPlanningPDF();

    try {
      const companies = await api.getCompanies();
      const filterEl = document.getElementById("planningCompanyFilter");
      if (filterEl) {
        filterEl.innerHTML =
          '<option value="">Alle bedrijven</option>' +
          companies
            .map((c) => `<option value="${c.id}">${c.name}</option>`)
            .join("");
      }

      const data = await api.getPlanningWeek(currentPlanningWeek);
      renderPlanningList(data);

      if (filterEl) {
        filterEl.onchange = () => {
          const cid = filterEl.value;
          const filtered = cid
            ? data.filter((d) => String(d.company_id) === String(cid))
            : data;
          renderPlanningList(filtered);
        };
      }

      const genCompanyBtn = document.getElementById(
        "planningGenerateCompanyBtn"
      );
      if (genCompanyBtn) {
        genCompanyBtn.onclick = async () => {
          const cid = document.getElementById("planningCompanyFilter").value;
          if (!cid) {
            alert(
              "Selecteer eerst een bedrijf om alle chauffeurs toe te voegen."
            );
            return;
          }
          try {
            await api.generateCompanyWeeklyPlanning(currentPlanningWeek, cid);
            await loadPlanningManagement();
          } catch (error) {
            alert("Genereren voor bedrijf mislukt: " + error.message);
          }
        };
      }

      const genVehiclesBtn = document.getElementById(
        "planningGenerateVehiclesBtn"
      );
      if (genVehiclesBtn) {
        genVehiclesBtn.onclick = showGeneratePlanningByVehiclesModal;
      }
      
      const genVehiclesBtnMobile = document.getElementById(
        "planningGenerateVehiclesBtnMobile"
      );
      if (genVehiclesBtnMobile) {
        genVehiclesBtnMobile.onclick = showGeneratePlanningByVehiclesModal;
      }
    } catch (error) {
      document.getElementById(
        "planningList"
      ).innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }

  function renderPlanningList(entries) {
    const wrapper = document.getElementById("planningList");
    if (!entries || entries.length === 0) {
      wrapper.innerHTML = `<div class="alert alert-info">${adminTr(
        "planning.no_planning",
        "No planning for this week"
      )}</div>`;
      return;
    }

    const dayName = (d) =>
      ({
        1: adminTr("day.mon", "Mon"),
        2: adminTr("day.tue", "Tue"),
        3: adminTr("day.wed", "Wed"),
        4: adminTr("day.thu", "Thu"),
        5: adminTr("day.fri", "Fri"),
      }[d] || d);

    // Sort by day then ritnumber ascending
    const sorted = [...entries].sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      const ra = (a.route_number || "").toString();
      const rb = (b.route_number || "").toString();
      return ra.localeCompare(rb, "nl", { numeric: true });
    });

    const rows = sorted
      .map(
        (e) => `
    <tr data-entry-id="${e.id}" data-company-id="${e.company_id}">
      <td>${e.week_number}</td>
      <td>${e.route_number || "-"}</td>
      <td>${dayName(e.day_of_week)}</td>
      <td><select class="form-select form-select-sm" onchange="updatePlanningDriver(${
        e.id
      }, ${e.company_id}, this.value)"><option value="${e.driver_id}">${
          e.driver_name || "-"
        }</option></select></td>
      <td class="adr-cell">${e.adr ? "Ja" : "Nee"}</td>
      <td class="truck-cell">${
        e.mega_kast === "mega_and_kast"
          ? "Mega+Kast"
          : e.mega_kast === "nvt"
          ? "N.v.t."
          : "Mega"
      }</td>
      <td>${e.license_plate || "-"}</td>
      <td class="phone-cell">${e.phone_number || "-"}</td>
      <td>${e.notes || "-"}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-warning me-1" onclick="showEditPlanningModal(${
          e.id
        })"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deletePlanningEntry(${
          e.id
        })"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `
      )
      .join("");

    // Load all company drivers for dropdowns
    (async () => {
      const companyIds = [
        ...new Set(sorted.map((e) => e.company_id).filter(Boolean)),
      ];
      for (const cid of companyIds) {
        try {
          const drivers = await api.getDriversByCompany(cid);
          const rows = document.querySelectorAll(
            `tr[data-company-id="${cid}"]`
          );
          rows.forEach((row) => {
            const select = row.querySelector("select");
            const currentDriverId = parseInt(select.value);
            select.innerHTML = drivers
              .map(
                (d) =>
                  `<option value="${d.id}" ${
                    d.id === currentDriverId ? "selected" : ""
                  }>${d.full_name} ${
                    d.ritnumber ? "(" + d.ritnumber + ")" : ""
                  }</option>`
              )
              .join("");
          });
        } catch (err) {
          console.error("Failed to load drivers for company", cid, err);
        }
      }
    })();

    wrapper.innerHTML = `
    <div class="table-responsive d-none d-md-block">
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>Week</th>
            <th>Ritnummer</th>
            <th>Dag</th>
            <th>Chauffeur</th>
            <th>ADR</th>
            <th>Truck</th>
            <th>Kenteken</th>
            <th>Telefoon</th>
            <th>Notities</th>
            <th>Acties</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="d-md-none">
      <table class="table table-striped table-hover table-sm">
        <thead class="table-dark">
          <tr>
            <th style="width: 20px;"></th>
            <th>Rit</th>
            <th>Dag</th>
            <th>Chauffeur</th>
          </tr>
        </thead>
        <tbody>
          ${sorted
            .map(
              (e) => `
            <tr class="planning-row" data-planning-id="${e.id}">
              <td class="text-center" style="cursor: pointer; padding: 0.4rem 0.3rem;">
                <i class="bi bi-chevron-down toggle-details" onclick="togglePlanningDetails(${e.id})" style="font-size: 0.8rem;"></i>
              </td>
              <td><small><strong>${e.route_number || "-"}</strong></small></td>
              <td><small>${dayName(e.day_of_week)}</small></td>
              <td><small>${e.driver_name || "-"}</small></td>
            </tr>
            <tr class="planning-details-row d-none" id="details-planning-${e.id}">
              <td colspan="4" style="padding: 0;">
                <div class="p-3 bg-light border-top">
                  <h6 class="mb-3">Rit ${e.route_number || "-"} - ${dayName(e.day_of_week)}</h6>
                  <div class="row mb-3">
                    <div class="col-6">
                      <label class="form-label text-muted small">Week</label>
                      <p class="small">${e.week_number}</p>
                    </div>
                    <div class="col-6">
                      <label class="form-label text-muted small">Chauffeur</label>
                      <p class="small">${e.driver_name || "-"}</p>
                    </div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-6">
                      <label class="form-label text-muted small">ADR</label>
                      <p class="small">${e.adr ? "Ja" : "Nee"}</p>
                    </div>
                    <div class="col-6">
                      <label class="form-label text-muted small">Truck Type</label>
                      <p class="small">${
                        e.mega_kast === "mega_and_kast"
                          ? "Mega+Kast"
                          : e.mega_kast === "nvt"
                          ? "N.v.t."
                          : "Mega"
                      }</p>
                    </div>
                  </div>
                  <div class="row mb-3">
                    <div class="col-6">
                      <label class="form-label text-muted small">Kenteken</label>
                      <p class="small">${e.license_plate || "-"}</p>
                    </div>
                    <div class="col-6">
                      <label class="form-label text-muted small">Telefoon</label>
                      <p class="small">${e.phone_number || "-"}</p>
                    </div>
                  </div>
                  ${e.notes ? `
                  <div class="row mb-3">
                    <div class="col-12">
                      <label class="form-label text-muted small">Notities</label>
                      <p class="small">${e.notes}</p>
                    </div>
                  </div>
                  ` : ''}
                  <div class="d-grid gap-2 d-sm-flex gap-2">
                    <button class="btn btn-warning btn-sm flex-grow-1" onclick="showEditPlanningModal(${e.id})">
                      <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm flex-grow-1" onclick="deletePlanningEntry(${e.id})">
                      <i class="bi bi-trash"></i> Delete
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

    // Attach event listeners for toggle details
    const detailsRows = wrapper.querySelectorAll('.planning-row');
    detailsRows.forEach(row => {
      row.addEventListener('click', function(e) {
        if (e.target.closest('.toggle-details')) return;
        const planningId = this.getAttribute('data-planning-id');
        togglePlanningDetails(planningId);
      });
    });
  }

  function togglePlanningDetails(planningId) {
    const detailsRow = document.getElementById(`details-planning-${planningId}`);
    const icon = document.querySelector(`[data-planning-id="${planningId}"] .toggle-details`);
    
    if (detailsRow && icon) {
      detailsRow.classList.toggle('d-none');
      icon.classList.toggle('bi-chevron-down');
      icon.classList.toggle('bi-chevron-up');
    }
  }

  async function updatePlanningDriver(entryId, companyId, newDriverId) {
    try {
      // Get driver details
      const drivers = await api.getDriversByCompany(companyId);
      const driver = drivers.find((d) => d.id === parseInt(newDriverId));
      if (!driver) return;

      // Update backend
      await api.updatePlanningEntry(entryId, {
        driver_id: driver.id,
        adr: driver.adr || false,
        mega_kast: driver.mega_kast || "only_mega",
        phone_number: driver.phone || "",
      });

      // Update UI cells
      const row = document.querySelector(`tr[data-entry-id="${entryId}"]`);
      if (row) {
        row.querySelector(".adr-cell").textContent = driver.adr ? "Ja" : "Nee";
        row.querySelector(".truck-cell").textContent =
          driver.mega_kast === "mega_and_kast"
            ? "Mega+Kast"
            : driver.mega_kast === "nvt"
            ? "N.v.t."
            : "Mega";
        row.querySelector(".phone-cell").textContent = driver.phone || "-";
      }

      showToast("Chauffeur bijgewerkt", "success");
    } catch (error) {
      showToast("Update mislukt: " + error.message, "danger");
    }
  }

  function showAddPlanningModal() {
    const html = `
    <div class="modal fade" id="addPlanningModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Nieuwe planning (week ${currentPlanningWeek})</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Bedrijf</label>
              <select class="form-select" id="plCompany"></select>
            </div>
            <div class="mb-3">
              <label class="form-label">Dag</label>
              <select class="form-select" id="plDay">
                <option value="1">Maandag</option>
                <option value="2">Dinsdag</option>
                <option value="3">Woensdag</option>
                <option value="4">Donderdag</option>
                <option value="5">Vrijdag</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">Chauffeur</label>
              <select class="form-select" id="plDriver"><option value="">Selecteer bedrijf eerst</option></select>
            </div>
            <div class="mb-3">
              <label class="form-label">Route nummer</label>
              <input type="text" class="form-control" id="plRoute">
            </div>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">ADR</label>
                <select class="form-select" id="plAdr"><option value="0">Nee</option><option value="1">Ja</option></select>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label">Truck</label>
                <select class="form-select" id="plMega">
                  <option value="only_mega">Mega</option>
                  <option value="mega_and_kast">Mega+Kast</option>
                  <option value="nvt">N.v.t.</option>
                </select>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Telefoon</label>
              <input type="text" class="form-control" id="plPhone">
            </div>
            <div class="mb-3">
              <label class="form-label">Notities</label>
              <textarea class="form-control" id="plNotes" rows="2"></textarea>
            </div>
            <div id="plAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
            <button type="button" class="btn btn-primary" onclick="submitAddPlanning()">Opslaan</button>
          </div>
        </div>
      </div>
    </div>`;

    const old = document.getElementById("addPlanningModal");
    if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", html);
    const modalEl = document.getElementById("addPlanningModal");
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    (async () => {
      try {
        const companies = await api.getCompanies();
        document.getElementById("plCompany").innerHTML =
          '<option value="">Selecteer bedrijf</option>' +
          (companies || [])
            .map((c) => `<option value="${c.id}">${c.name}</option>`)
            .join("");
        document.getElementById("plCompany").onchange = async (e) => {
          const cid = e.target.value;
          const drivers = cid ? await api.getDriversByCompany(cid) : [];
          document.getElementById("plDriver").innerHTML =
            (drivers.length
              ? ""
              : '<option value="">Geen chauffeurs</option>') +
            drivers
              .map(
                (d) =>
                  `<option value="${d.id}">${d.full_name} ${
                    d.ritnumber ? "(" + d.ritnumber + ")" : ""
                  }</option>`
              )
              .join("");
        };
      } catch (err) {
        document.getElementById(
          "plAlert"
        ).innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
      }
    })();
  }

  async function submitAddPlanning() {
    const alertDiv = document.getElementById("plAlert");
    const weekNumber = currentPlanningWeek;
    const companyId = document.getElementById("plCompany").value;
    const dayOfWeek = parseInt(
      document.getElementById("plDay").value || "1",
      10
    );
    const driverId = document.getElementById("plDriver").value;
    const routeNumber = document.getElementById("plRoute").value.trim();
    const adr = document.getElementById("plAdr").value === "1";
    const megaKast = document.getElementById("plMega").value;
    const phoneNumber = document.getElementById("plPhone").value.trim();
    const notes = document.getElementById("plNotes").value.trim();

    if (!companyId || !driverId || !routeNumber) {
      alertDiv.innerHTML =
        '<div class="alert alert-warning">Selecteer bedrijf, chauffeur en vul route in.</div>';
      return;
    }

    try {
      await api.createPlanningEntry({
        weekNumber,
        dayOfWeek,
        routeNumber,
        driverId: parseInt(driverId, 10),
        vehicleId: null,
        companyId: parseInt(companyId, 10),
        adr,
        megaKast,
        phoneNumber,
        notes,
      });
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addPlanningModal")
      );
      if (modal) modal.hide();
      await loadPlanningManagement();
    } catch (error) {
      alertDiv.innerHTML = `<div class=\"alert alert-danger\">${error.message}</div>`;
    }
  }

  async function showEditPlanningModal(id) {
    try {
      const entries = await api.getPlanningWeek(currentPlanningWeek);
      const entry = (entries || []).find((e) => e.id === id);
      if (!entry) return;
      const html = `
      <div class="modal fade" id="editPlanningModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Bewerk planning</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Route nummer</label>
                <input type="text" class="form-control" id="editPlRoute" value="${
                  entry.route_number || ""
                }">
              </div>
              <div class="mb-3">
                <label class="form-label">Chauffeur</label>
                <select class="form-select" id="editPlDriver"><option value="${
                  entry.driver_id || ""
                }">${entry.driver_name || "-"}</option></select>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">ADR</label>
                  <select class="form-select" id="editPlAdr"><option value="0" ${
                    entry.adr ? "" : "selected"
                  }>Nee</option><option value="1" ${
        entry.adr ? "selected" : ""
      }>Ja</option></select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Truck</label>
                  <select class="form-select" id="editPlMega">
                    <option value="only_mega" ${
                      entry.mega_kast === "only_mega" ? "selected" : ""
                    }>Mega</option>
                    <option value="mega_and_kast" ${
                      entry.mega_kast === "mega_and_kast" ? "selected" : ""
                    }>Mega+Kast</option>
                    <option value="nvt" ${
                      entry.mega_kast === "nvt" ? "selected" : ""
                    }>N.v.t.</option>
                  </select>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Telefoon</label>
                <input type="text" class="form-control" id="editPlPhone" value="${
                  entry.phone_number || ""
                }">
              </div>
              <div class="mb-3">
                <label class="form-label">Notities</label>
                <textarea class="form-control" id="editPlNotes" rows="2">${
                  entry.notes || ""
                }</textarea>
              </div>
              <div id="editPlAlert"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
              <button type="button" class="btn btn-primary" onclick="submitEditPlanning(${
                entry.id
              }, ${entry.company_id || 0})">Opslaan</button>
            </div>
          </div>
        </div>
      </div>`;

      const old = document.getElementById("editPlanningModal");
      if (old) old.remove();
      document.body.insertAdjacentHTML("beforeend", html);
      const modalEl = document.getElementById("editPlanningModal");
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();

      if (entry.company_id) {
        const drivers = await api.getDriversByCompany(entry.company_id);
        document.getElementById("editPlDriver").innerHTML = (drivers || [])
          .map(
            (d) =>
              `<option value="${d.id}" ${
                d.id === entry.driver_id ? "selected" : ""
              }>${d.full_name} ${
                d.ritnumber ? "(" + d.ritnumber + ")" : ""
              }</option>`
          )
          .join("");
      }
    } catch (error) {
      alert("Kon planning niet laden: " + error.message);
    }
  }

  async function submitEditPlanning(id, companyId) {
    const payload = {
      route_number: document.getElementById("editPlRoute").value.trim() || null,
      driver_id:
        parseInt(document.getElementById("editPlDriver").value || "0", 10) ||
        null,
      adr: document.getElementById("editPlAdr").value === "1",
      mega_kast: document.getElementById("editPlMega").value,
      phone_number: document.getElementById("editPlPhone").value.trim() || null,
      notes: document.getElementById("editPlNotes").value.trim() || null,
    };
    const alertDiv = document.getElementById("editPlAlert");
    try {
      await api.updatePlanningEntry(id, payload);
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("editPlanningModal")
      );
      if (modal) modal.hide();
      await loadPlanningManagement();
    } catch (error) {
      alertDiv.innerHTML = `<div class=\"alert alert-danger\">${error.message}</div>`;
    }
  }

  async function deletePlanningEntry(id) {
    if (!confirm("Weet je zeker dat je deze planning wilt verwijderen?"))
      return;
    try {
      await api.deletePlanningEntry(id);
      await loadPlanningManagement();
    } catch (error) {
      alert("Verwijderen mislukt: " + error.message);
    }
  }

  async function generatePlanning() {
    try {
      await api.generateWeeklyPlanning(currentPlanningWeek);
      await loadPlanningManagement();
    } catch (error) {
      alert("Genereren mislukt: " + error.message);
    }
  }

  async function clearPlanningWeek() {
    const companyId = document.getElementById("planningCompanyFilter")?.value;
    if (!companyId) {
      showToast(
        "Selecteer eerst een bedrijf om de planning te wissen",
        "warning"
      );
      return;
    }
    if (!confirm("Planning voor dit bedrijf in deze week wissen?")) return;
    try {
      await api.clearWeekPlanning(currentPlanningWeek, companyId);
      await loadPlanningManagement();
      showToast("Planning gewist", "success");
    } catch (error) {
      showToast("Wissen mislukt: " + error.message, "danger");
    }
  }

  async function exportPlanningPDF() {
    try {
      const blob = await api.exportPlanningPDF(currentPlanningWeek);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `planning-week-${currentPlanningWeek}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      alert("PDF export mislukt: " + error.message);
    }
  }

  function emailPlanningPDF() {
    const html = `
    <div class="modal fade" id="emailPlanningModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">E-mail Planning PDF (week ${currentPlanningWeek})</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Ontvangers (comma-separated)</label>
              <input type="text" class="form-control" id="plEmailRecipients" placeholder="a@b.nl, c@d.nl">
            </div>
            <div class="mb-3">
              <label class="form-label">Onderwerp</label>
              <input type="text" class="form-control" id="plEmailSubject" value="Weekplanning Week ${currentPlanningWeek}">
            </div>
            <div class="mb-3">
              <label class="form-label">Bericht</label>
              <textarea class="form-control" id="plEmailMessage" rows="3">Beste,\nBijgevoegd de weekplanning.\nMet vriendelijke groet.</textarea>
            </div>
            <div id="plEmailAlert"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
            <button type="button" class="btn btn-primary" onclick="submitEmailPlanning()">Versturen</button>
          </div>
        </div>
      </div>
    </div>`;
    const old = document.getElementById("emailPlanningModal");
    if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", html);
    new bootstrap.Modal(document.getElementById("emailPlanningModal")).show();
  }

  async function submitEmailPlanning() {
    const alertDiv = document.getElementById("plEmailAlert");
    const recipientsStr = document
      .getElementById("plEmailRecipients")
      .value.trim();
    if (!recipientsStr) {
      alertDiv.innerHTML =
        '<div class="alert alert-warning">Vul minimaal één ontvanger in.</div>';
      return;
    }
    const recipients = recipientsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const subject = document.getElementById("plEmailSubject").value.trim();
    const message = document.getElementById("plEmailMessage").value;
    try {
      await api.emailPlanningPDF(
        currentPlanningWeek,
        recipients,
        subject,
        message
      );
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("emailPlanningModal")
      );
      if (modal) modal.hide();
      showToast("E-mail verzonden", "success");
    } catch (error) {
      alertDiv.innerHTML = `<div class=\"alert alert-danger\">${error.message}</div>`;
    }
  }

  async function loadSMTPSettings() {
    const container = document.getElementById("adminContent");
    container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h5>SMTP Instellingen</h5>
      </div>
      <div class="card-body">
        <div class="alert alert-info">
          <strong>SMTP Configuratie:</strong> Configureer hier de mailserver instellingen voor het versturen van e-mails.
        </div>
        
        <form id="smtpForm">
          <div class="mb-3">
            <label class="form-label">Authenticatietype</label>
            <select class="form-select" id="smtpAuthType">
              <option value="basic">Basic (gebruikersnaam/wachtwoord)</option>
              <option value="oauth2">OAuth2 (Microsoft 365)</option>
            </select>
            <small class="form-text text-muted">Kies het type authenticatie voor je mailserver.</small>
          </div>

          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label">SMTP Host</label>
              <input type="text" class="form-control" id="smtpHost" placeholder="smtp.gmail.com">
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label">SMTP Port</label>
              <input type="number" class="form-control" id="smtpPort" placeholder="587" min="1" max="65535">
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">Gebruikersnaam / Email</label>
            <input type="text" class="form-control" id="smtpUser" placeholder="jouw-email@gmail.com">
          </div>

          <div class="mb-3">
            <label class="form-label">Wachtwoord / Token</label>
            <input type="password" class="form-control" id="smtpPass" placeholder="••••••••">
            <small class="form-text text-muted">Voor Gmail: gebruik een App Password. Voor Microsoft 365: gebruik Client Secret.</small>
          </div>

          <div id="oauthSection" style="display:none;">
            <div class="alert alert-warning">
              <strong>OAuth2 Instellingen:</strong> Voer de Microsoft 365 Azure AD gegevens in.
            </div>
            <div class="mb-3">
              <label class="form-label">Tenant ID</label>
              <input type="text" class="form-control" id="oauthTenantId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
            </div>
            <div class="mb-3">
              <label class="form-label">Client ID</label>
              <input type="text" class="form-control" id="oauthClientId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
            </div>
            <div class="mb-3">
              <label class="form-label">Client Secret</label>
              <input type="password" class="form-control" id="oauthClientSecret" placeholder="••••••••">
            </div>
            <div class="mb-3">
              <label class="form-label">OAuth Scope (optioneel)</label>
              <input type="text" class="form-control" id="oauthScope" placeholder="https://outlook.office365.com/.default" value="https://outlook.office365.com/.default">
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">E-mailadres afzender</label>
            <input type="email" class="form-control" id="emailFrom" placeholder="noreply@bedrijf.nl">
          </div>

          <div class="mb-3">
            <label class="form-label">Standaard ontvanger (CC)</label>
            <input type="email" class="form-control" id="emailTo" placeholder="admin@bedrijf.nl">
          </div>

          <div id="smtpAlert"></div>

          <div class="d-flex gap-2">
            <button type="button" class="btn btn-secondary" onclick="testSMTPConnection()">
              <i class="bi bi-send"></i> Verbinding testen
            </button>
            <button type="button" class="btn btn-primary" onclick="saveSMTPSettings()">
              <i class="bi bi-save"></i> Instellingen opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

    // Load current settings
    try {
      const settings = await api.getSMTPSettings();
      if (settings) {
        document.getElementById("smtpHost").value = settings.smtp_host || "";
        document.getElementById("smtpPort").value = settings.smtp_port || "587";
        document.getElementById("smtpUser").value = settings.smtp_user || "";
        document.getElementById("smtpAuthType").value =
          settings.auth_type === "oauth2" ? "oauth2" : "basic";
        document.getElementById("emailFrom").value = settings.email_from || "";
        document.getElementById("emailTo").value = settings.email_to || "";

        if (settings.auth_type === "oauth2") {
          document.getElementById("oauthTenantId").value =
            settings.oauth_tenant_id || "";
          document.getElementById("oauthClientId").value =
            settings.oauth_client_id || "";
          document.getElementById("oauthScope").value =
            settings.oauth_scope || "https://outlook.office365.com/.default";
        }

        toggleOAuthFields();
      }
    } catch (error) {
      console.error("Failed to load SMTP settings:", error);
    }

    // Wire auth type change
    document.getElementById("smtpAuthType").onchange = toggleOAuthFields;
  }

  function toggleOAuthFields() {
    const authType = document.getElementById("smtpAuthType").value;
    document.getElementById("oauthSection").style.display =
      authType === "oauth2" ? "block" : "none";
  }

  async function saveSMTPSettings() {
    const alertDiv = document.getElementById("smtpAlert");
    const authType = document.getElementById("smtpAuthType").value;

    const payload = {
      smtp_host: document.getElementById("smtpHost").value.trim(),
      smtp_port: parseInt(
        document.getElementById("smtpPort").value || "587",
        10
      ),
      smtp_user: document.getElementById("smtpUser").value.trim(),
      smtp_pass: document.getElementById("smtpPass").value,
      email_from: document.getElementById("emailFrom").value.trim(),
      email_to: document.getElementById("emailTo").value.trim(),
      auth_type: authType,
    };

    if (authType === "oauth2") {
      payload.oauth_tenant_id = document
        .getElementById("oauthTenantId")
        .value.trim();
      payload.oauth_client_id = document
        .getElementById("oauthClientId")
        .value.trim();
      payload.oauth_client_secret =
        document.getElementById("oauthClientSecret").value;
      payload.oauth_scope = document.getElementById("oauthScope").value.trim();
    }

    // Validate required fields
    if (!payload.smtp_host || !payload.smtp_user || !payload.email_from) {
      alertDiv.innerHTML =
        '<div class="alert alert-warning">Vul SMTP Host, Gebruikersnaam en E-mailadres afzender in.</div>';
      return;
    }

    try {
      await api.updateSMTPSettings(payload);
      alertDiv.innerHTML =
        '<div class="alert alert-success"><i class="bi bi-check-circle"></i> SMTP instellingen opgeslagen!</div>';
      showToast("SMTP instellingen opgeslagen", "success");
    } catch (error) {
      alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
    }
  }

  async function testSMTPConnection() {
    const alertDiv = document.getElementById("smtpAlert");
    alertDiv.innerHTML =
      '<div class="alert alert-info"><i class="bi bi-hourglass-split"></i> Verbinding testen...</div>';

    try {
      const result = await api.testSMTPConnection();
      alertDiv.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle"></i> ${result.message}</div>`;
      showToast("SMTP verbinding OK", "success");
    } catch (error) {
      alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
      showToast("SMTP verbinding mislukt", "danger");
    }
  }

  async function loadBrandingSettings() {
    const defaultCustomCss = `:root {\n  --branding-primary-color-fallback: #0066CC;\n}\n\n.btn-primary, .bg-brand, .badge-primary, .nav-pills .nav-link.active {\n  background-color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n  border-color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n}\n\n.text-brand, .icon-brand, .sidebar .nav-link i {\n  color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n}\n\n/* Ensure active nav icons contrast with the active background */\n.nav-link.active i, .navbar .nav-link.active i {\n  color: #ffffff;\n}\n\n.login-card .btn-primary {\n  background-color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n  border-color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n}\n`;
    const container = document.getElementById("adminContent");
    container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h5>Branding Instellingen</h5>
      </div>
      <div class="card-body">
        <div class="alert alert-info">
          <strong>Bedrijfsbranding:</strong> Configureer hier het uiterlijk van het systeem met bedrijfskleur, naam en logo.
        </div>

        <ul class="nav nav-pills mb-3" id="brandingTabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="branding-main-tab" data-bs-toggle="tab" data-bs-target="#tab-branding-main" type="button" role="tab">Basis</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="branding-css-tab" data-bs-toggle="tab" data-bs-target="#tab-branding-css" type="button" role="tab">CSS editor</button>
          </li>
        </ul>

        <div class="tab-content">
          <div class="tab-pane fade show active" id="tab-branding-main" role="tabpanel">
            <form id="brandingForm">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Bedrijfsnaam</label>
                  <input type="text" class="form-control" id="brandingCompanyName" placeholder="Uw Bedrijf B.V.">
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Primaire kleur</label>
                  <div class="input-group">
                    <input type="color" class="form-control form-control-color" id="brandingPrimaryColor" value="#0066CC" title="Kies een kleur">
                    <input type="text" class="form-control" id="brandingPrimaryColorText" placeholder="#0066CC" readonly>
                  </div>
                  <small class="form-text text-muted">Gebruikt voor navigatie, knoppen en accenten.</small>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Tagline / Motto</label>
                <input type="text" class="form-control" id="brandingTagline" placeholder="Bv. 'Efficiënt timesheet management'">
              </div>

              <div class="mb-3">
                <label class="form-label">Logo</label>
                <div class="card bg-light p-3 mb-3">
                  <div id="logoPreview" class="text-center">
                    <p class="text-muted">Geen logo geupload</p>
                  </div>
                </div>
                <input type="file" class="form-control" id="logoFile" accept="image/*">
                <small class="form-text text-muted">Ondersteunde formaten: PNG, JPG, GIF. Max 5MB. Aanbevolen: 200x50px.</small>
              </div>

              <div id="brandingAlert"></div>

              <div class="d-flex gap-2">
                <button type="button" class="btn btn-primary" onclick="saveBrandingSettings()">
                  <i class="bi bi-save"></i> Instellingen opslaan
                </button>
                <button type="button" class="btn btn-outline-secondary" onclick="resetBrandingForm()">
                  <i class="bi bi-arrow-counterclockwise"></i> Herstellen
                </button>
              </div>
            </form>
          </div>

          <div class="tab-pane fade" id="tab-branding-css" role="tabpanel">
            <div class="alert alert-secondary">
              <div class="fw-bold mb-1">CSS voor gekleurde en icoon-elementen</div>
              <div class="mb-2">Dit blok stuurt o.a. knoppen, badges, actieve tabs, iconen in navigatie en dashboards, en login accenten.</div>
              <div class="mb-1">Tip: gebruik <code>var(--branding-primary-color, #0066CC)</code> als accentkleur.</div>
            </div>
            <div class="mb-3">
              <div class="fw-semibold">Voorbeelden uit live situaties</div>
              <div class="d-flex flex-column gap-2 mt-2">
                <button type="button" class="btn btn-outline-secondary btn-sm text-start" id="cssExamplePrimary">
                  <i class="bi bi-palette"></i> Donkerblauw menu + lichte iconen
                </button>
                <button type="button" class="btn btn-outline-success btn-sm text-start" id="cssExampleSuccess">
                  <i class="bi bi-check-circle"></i> Groene badges voor goedkeuring
                </button>
                <button type="button" class="btn btn-outline-warning btn-sm text-start" id="cssExampleAlerts">
                  <i class="bi bi-exclamation-triangle"></i> Oranje waarschuwingen, rood fouten
                </button>
                <button type="button" class="btn btn-outline-primary btn-sm text-start" id="cssResetDefault">
                  <i class="bi bi-arrow-counterclockwise"></i> Herstel naar standaard CSS
                </button>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Custom CSS</label>
              <textarea class="form-control font-monospace" id="brandingCustomCss" rows="12" spellcheck="false"></textarea>
              <small class="form-text text-muted">Bewaar om nieuwe styling direct op de app toe te passen.</small>
            </div>
            <div id="brandingCssAlert"></div>
            <button type="button" class="btn btn-primary" onclick="saveBrandingCustomCss()">
              <i class="bi bi-code-slash"></i> Custom CSS opslaan
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

    // Load current settings
    try {
      const [settings, cssSettings] = await Promise.all([
        api.getBrandingSettings(),
        api.getBrandingCustomCss(),
      ]);
      if (settings) {
        document.getElementById("brandingCompanyName").value =
          settings.company_name || "";
        document.getElementById("brandingPrimaryColor").value =
          settings.primary_color || "#0066CC";
        document.getElementById("brandingPrimaryColorText").value =
          settings.primary_color || "#0066CC";
        document.getElementById("brandingTagline").value =
          settings.tagline || "";

        if (settings.logo_path) {
          document.getElementById(
            "logoPreview"
          ).innerHTML = `<img src="${settings.logo_path}" style="max-height: 100px; max-width: 100%;">`;
        }
      }

      const cssToUse =
        cssSettings && cssSettings.custom_css
          ? cssSettings.custom_css
          : defaultCustomCss;
      document.getElementById("brandingCustomCss").value = cssToUse;
    } catch (error) {
      console.error("Failed to load branding settings:", error);
    }

    const cssExamples = [
      {
        id: "cssExamplePrimary",
        css: `:root {\n  --branding-primary-color: #0b3d91;\n}\n\n.navbar, .nav-pills .nav-link.active {\n  background-color: var(--branding-primary-color);\n}\n.navbar .nav-link, .nav-link i {\n  color: #eaf2ff;\n}\n.navbar .nav-link.active {\n  color: #ffffff;\n}\n.btn-primary {\n  background-color: var(--branding-primary-color);\n  border-color: var(--branding-primary-color);\n}\n`,
      },
      {
        id: "cssExampleSuccess",
        css: `.badge-success, .status-approved, .status-accepted {\n  background-color: #1f9d55;\n  color: #ffffff;\n}\n.icon-brand, .text-brand {\n  color: #1f9d55;\n}\n.nav-pills .nav-link.active {\n  background-color: #1f9d55;\n  border-color: #1f9d55;\n}\n`,
      },
      {
        id: "cssExampleAlerts",
        css: `.badge-warning, .status-warning {\n  background-color: #f4a742;\n  color: #1f1f1f;\n}\n.badge-danger, .status-rejected, .status-error {\n  background-color: #d9534f;\n  color: #ffffff;\n}\n.nav-pills .nav-link.active {\n  background-color: #d9534f;\n  border-color: #d9534f;\n}\n`,
      },
    ];

    cssExamples.forEach((example) => {
      const btn = document.getElementById(example.id);
      if (btn) {
        btn.onclick = () => {
          document.getElementById("brandingCustomCss").value =
            example.css.trim();
          showToast("Voorbeeld ingevuld in editor", "info");
        };
      }
    });

    const resetDefaultBtn = document.getElementById("cssResetDefault");
    if (resetDefaultBtn) {
      resetDefaultBtn.onclick = () => {
        document.getElementById("brandingCustomCss").value =
          defaultCustomCss.trim();
        showToast("Standaard CSS hersteld", "info");
      };
    }

    // Wire color picker change
    document.getElementById("brandingPrimaryColor").onchange = (e) => {
      document.getElementById("brandingPrimaryColorText").value =
        e.target.value;
    };

    // Wire logo preview
    document.getElementById("logoFile").onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          document.getElementById(
            "logoPreview"
          ).innerHTML = `<img src="${event.target.result}" style="max-height: 100px; max-width: 100%;">`;
        };
        reader.readAsDataURL(file);
      }
    };
  }

  async function saveBrandingSettings() {
    const alertDiv = document.getElementById("brandingAlert");
    const companyName = document
      .getElementById("brandingCompanyName")
      .value.trim();
    const primaryColor = document.getElementById("brandingPrimaryColor").value;
    const tagline = document.getElementById("brandingTagline").value.trim();
    const logoFile = document.getElementById("logoFile").files[0];

    // Validate
    if (!companyName) {
      alertDiv.innerHTML =
        '<div class="alert alert-warning">Vul bedrijfsnaam in.</div>';
      return;
    }

    try {
      console.log("[BRANDING SAVE] Sending:", {
        company_name: companyName,
        primary_color: primaryColor,
        tagline,
      });

      // Save basic settings
      const result = await api.updateBrandingSettings({
        company_name: companyName,
        primary_color: primaryColor,
        tagline: tagline,
      });

      console.log("[BRANDING SAVE] Response:", result);

      // Upload logo if provided
      if (logoFile) {
        const formData = new FormData();
        formData.append("logo", logoFile);
        await api.uploadBrandingLogo(formData);
      }

      alertDiv.innerHTML =
        '<div class="alert alert-success"><i class="bi bi-check-circle"></i> Branding instellingen opgeslagen!</div>';
      showToast("Branding instellingen opgeslagen", "success");

      // Reload branding to apply changes immediately
      console.log("[BRANDING SAVE] Reloading branding...");
      try {
        app.branding = await api.getPublicBranding();
        console.log("[BRANDING SAVE] Loaded branding:", app.branding);
        app.applyBranding();
        console.log("[BRANDING SAVE] Applied branding");
      } catch (e) {
        console.error("Failed to reload branding:", e);
      }
    } catch (error) {
      console.error("[BRANDING SAVE] Error:", error);
      alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
      showToast("Opslaan mislukt", "danger");
    }
  }

  async function saveBrandingCustomCss() {
    const alertDiv = document.getElementById("brandingCssAlert");
    const customCss = document.getElementById("brandingCustomCss").value;

    alertDiv.innerHTML =
      '<div class="alert alert-info"><i class="bi bi-hourglass-split"></i> CSS opslaan...</div>';

    try {
      await api.updateBrandingCustomCss({ custom_css: customCss });
      alertDiv.innerHTML =
        '<div class="alert alert-success"><i class="bi bi-check-circle"></i> Custom CSS opgeslagen!</div>';
      showToast("Custom CSS opgeslagen", "success");

      try {
        app.branding = await api.getPublicBranding();
        app.applyBranding();
      } catch (error) {
        console.error("Failed to reload branding after CSS save:", error);
      }
    } catch (error) {
      alertDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${error.message}</div>`;
      showToast("Custom CSS opslaan mislukt", "danger");
    }
  }

  async function resetBrandingForm() {
    if (confirm("Formulier herstellen naar opgeslagen waarden?")) {
      await loadBrandingSettings();
    }
  }

  function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;

    const toastId = "toast-" + Date.now();
    const bgClass =
      type === "success"
        ? "bg-success"
        : type === "danger"
        ? "bg-danger"
        : type === "warning"
        ? "bg-warning"
        : "bg-info";
    const iconClass =
      type === "success"
        ? "bi-check-circle"
        : type === "danger"
        ? "bi-exclamation-triangle"
        : type === "warning"
        ? "bi-exclamation-circle"
        : "bi-info-circle";

    const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi ${iconClass} me-2"></i>${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

    toastContainer.insertAdjacentHTML("beforeend", toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();

    toastElement.addEventListener("hidden.bs.toast", () =>
      toastElement.remove()
    );
  }

  // ========== EXPLICIT EXPORTS TO WINDOW ==========
  window.renderAdmin = renderAdmin;
  window.initAdmin = initAdmin;
  window.switchAdminTab = switchAdminTab;
  window.showAddUserModal = showAddUserModal;
  window.submitAddUser = submitAddUser;
  window.openEditUserModal = openEditUserModal;
  window.submitEditUser = submitEditUser;
  window.showAddCompanyModal = showAddCompanyModal;
  window.submitAddCompany = submitAddCompany;
  window.openEditCompanyModal = openEditCompanyModal;
  window.submitEditCompany = submitEditCompany;
  window.toggleUserDetails = toggleUserDetails;
  window.toggleCompanyDetails = toggleCompanyDetails;
  window.toggleSubmissionDetails = toggleSubmissionDetails;
  window.togglePlanningDetails = togglePlanningDetails;
  window.toggleAddFillInCompany = toggleAddFillInCompany;
  window.toggleEditFillInCompany = toggleEditFillInCompany;
  window.viewSubmissionDetails = viewSubmissionDetails;
  window.deleteSubmission = deleteSubmission;
  window.editSubmissionHours = editSubmissionHours;
  window.emailSubmission = emailSubmission;
  window.sendEmailSubmission = sendEmailSubmission;
  window.saveEditedSubmission = saveEditedSubmission;
  window.loadFleetManagement = loadFleetManagement;
  window.selectVehicle = selectVehicle;
  window.showAddVehicleModal = showAddVehicleModal;
  window.submitAddVehicle = submitAddVehicle;
  window.showEditVehicleModal = showEditVehicleModal;
  window.submitEditVehicle = submitEditVehicle;
  window.showAddMaintenanceModal = showAddMaintenanceModal;
  window.submitMaintenance = submitMaintenance;
  window.showEditMaintenanceModal = showEditMaintenanceModal;
  window.submitEditMaintenance = submitEditMaintenance;
  window.deleteMaintenanceRecord = deleteMaintenanceRecord;
  window.confirmDeleteMaintenance = confirmDeleteMaintenance;
  // Planning exports
  window.loadPlanningManagement = loadPlanningManagement;
  window.showAddPlanningModal = showAddPlanningModal;
  window.submitAddPlanning = submitAddPlanning;
  window.showEditPlanningModal = showEditPlanningModal;
  window.submitEditPlanning = submitEditPlanning;
  window.deletePlanningEntry = deletePlanningEntry;
  window.emailPlanningPDF = emailPlanningPDF;
  window.submitEmailPlanning = submitEmailPlanning;
  window.updatePlanningDriver = updatePlanningDriver;
  window.loadTranslationsManagement = loadTranslationsManagement;
  window.saveTranslationsFromTable = saveTranslationsFromTable;
  // Helpers exported for testing/debugging
  window.parseCsv = parseCsv;
  window.ensureLocaleInSelect = ensureLocaleInSelect;
  window.loadSMTPSettings = loadSMTPSettings;
  window.saveSMTPSettings = saveSMTPSettings;
  window.testSMTPConnection = testSMTPConnection;
  window.toggleOAuthFields = toggleOAuthFields;
  window.loadBrandingSettings = loadBrandingSettings;
  window.saveBrandingSettings = saveBrandingSettings;
  window.saveBrandingCustomCss = saveBrandingCustomCss;
  window.resetBrandingForm = resetBrandingForm;
  window.openResetMfaModal = openResetMfaModal;
  window.submitResetMfa = submitResetMfa;
  window.openResetPasswordModal = openResetPasswordModal;
  window.submitResetPassword = submitResetPassword;
  window.showGeneratePlanningByVehiclesModal =
    showGeneratePlanningByVehiclesModal;
  /**
   * Show modal to generate planning by vehicles for a specific company
   */
  async function showGeneratePlanningByVehiclesModal() {
    console.log("[PLANNING] Opening generate by vehicles modal");

    // Create modal HTML
    const modalHTML = `
		<div class="modal fade" id="generateVehiclesModal" tabindex="-1">
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">Planning per Voertuig Genereren</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
					</div>
					<div class="modal-body">
						<div class="form-group">
							<label for="vehicleGenCompanySelect" class="form-label">Selecteer Bedrijf:</label>
							<select id="vehicleGenCompanySelect" class="form-select">
								<option value="">-- Laden... --</option>
							</select>
						</div>
						<div id="vehicleGenMessage" class="alert d-none" role="alert"></div>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
						<button type="button" class="btn btn-primary" id="vehicleGenSubmitBtn">Genereren</button>
					</div>
				</div>
			</div>
		</div>
	`;

    // Remove old modal if exists
    const oldModal = document.getElementById("generateVehiclesModal");
    if (oldModal) oldModal.remove();

    // Add new modal to DOM
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("generateVehiclesModal")
    );
    modal.show();

    // Populate company dropdown - fetch from API
    const companySelect = document.getElementById("vehicleGenCompanySelect");
    companySelect.innerHTML = '<option value="">-- Laden... --</option>';

    try {
      // Always fetch companies, don't rely on window.companies
      let companies = window.companies;
      if (!companies || !Array.isArray(companies)) {
        console.log("[PLANNING] Fetching companies from API");
        companies = await api.getCompanies();
        window.companies = companies; // Cache for next time
      }

      companySelect.innerHTML =
        '<option value="">-- Kies een bedrijf --</option>';
      if (companies && companies.length > 0) {
        companies.forEach((company) => {
          const option = document.createElement("option");
          option.value = company.id;
          option.textContent = company.name;
          companySelect.appendChild(option);
        });
      } else {
        console.warn("[PLANNING] No companies available");
        companySelect.innerHTML =
          '<option value="">Geen bedrijven beschikbaar</option>';
      }
    } catch (error) {
      console.error("[PLANNING] Error loading companies:", error);
      companySelect.innerHTML =
        '<option value="">Fout bij laden bedrijven</option>';
      const messageDiv = document.getElementById("vehicleGenMessage");
      messageDiv.className = "alert alert-danger d-block";
      messageDiv.textContent = `Fout: ${error.message}`;
    }

    // Handle submit button
    document.getElementById("vehicleGenSubmitBtn").onclick = async function () {
      const companyId = document.getElementById(
        "vehicleGenCompanySelect"
      ).value;
      const messageDiv = document.getElementById("vehicleGenMessage");

      if (!companyId) {
        messageDiv.className = "alert alert-warning d-block";
        messageDiv.textContent = "Selecteer alstublieft een bedrijf";
        return;
      }

      try {
        console.log(
          `[PLANNING] Generating planning for company ${companyId}, week ${currentPlanningWeek}`
        );
        const result = await api.generatePlanningByVehicles(
          currentPlanningWeek,
          companyId
        );

        messageDiv.className = "alert alert-success d-block";
        messageDiv.textContent = `Planning gegenereerd: ${result.totalCreated} entries aangemaakt`;

        // Reload planning after 1 second
        setTimeout(() => {
          loadPlanningManagement();
          const modal = bootstrap.Modal.getInstance(
            document.getElementById("generateVehiclesModal")
          );
          modal.hide();
        }, 1000);
      } catch (error) {
        console.error("[PLANNING] Error generating planning:", error);
        messageDiv.className = "alert alert-danger d-block";
        messageDiv.textContent = `Fout: ${error.message || "Onbekende fout"}`;
      }
    };
  }

  // Optional exports for direct usage
  window.generatePlanning = generatePlanning;
  window.clearPlanningWeek = clearPlanningWeek;
  window.exportPlanningPDF = exportPlanningPDF;

  console.log(
    "[ADMIN] Admin module loaded successfully - all functions exported to window"
  );

  // Mark admin as loaded
  window.adminModuleReady = true;
})();
