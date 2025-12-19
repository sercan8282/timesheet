const DEFAULT_CUSTOM_CSS = `:root {\n  --branding-primary-color-fallback: #0066CC;\n}\n\n.btn-primary, .bg-brand, .badge-primary, .nav-pills .nav-link.active {\n  background-color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n  border-color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n}\n\n.text-brand, .icon-brand, .sidebar .nav-link i {\n  color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n}\n\n/* Ensure active nav icons contrast with the active background */\n.nav-link.active i, .navbar .nav-link.active i {\n  color: #ffffff;\n}\n\n.login-card .btn-primary {\n  background-color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n  border-color: var(--branding-primary-color, var(--branding-primary-color-fallback));\n}\n`;

// Global translation helper function
window.t = function (namespace, key) {
  if (window.app && window.app.translations) {
    return (
      window.app.translations[`${namespace}:${key}`] || `${namespace}:${key}`
    );
  }
  return `${namespace}:${key}`;
};

class App {
  constructor() {
    this.user = null;
    this.branding = null;
    this.locale = localStorage.getItem("locale") || "nl";
    this.translations = {}; // cache for loaded translations: { 'namespace.key.locale': text }
    this.currentPage = null; // Track current page

    this.init();
  }

  async init() {
    // Load branding first
    try {
      this.branding = await api.getPublicBranding();
      this.applyBranding();
    } catch (error) {
      console.log("Using default branding");
      this.branding = {
        company_name: "Timesheet System",
        primary_color: "#0066CC",
      };
      this.applyBranding();
    }

    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    console.log("[DEBUG app.init] token exists:", !!token);
    console.log("[DEBUG app.init] userStr exists:", !!userStr);

    if (token && userStr) {
      this.user = JSON.parse(userStr);
      console.log("[DEBUG app.init] User from localStorage:", this.user);

      api.setToken(token);

      // Refresh user data from backend to ensure company_pause_time is current
      try {
        const freshUser = await api.getMe();
        console.log("[DEBUG app.init] Fresh user from API:", freshUser);
        this.user = freshUser;
        window.currentUser = this.user;
        localStorage.setItem("user", JSON.stringify(this.user));
        console.log("[DEBUG app.init] User refreshed from API:", this.user);
      } catch (error) {
        console.log(
          "[DEBUG app.init] Could not refresh user, using localStorage:",
          error
        );
        window.currentUser = this.user;
      }

      console.log(
        "[DEBUG app.init] Final this.user before showApp:",
        this.user
      );
      // Load menu configuration then show app
      try {
        await this.loadAndRenderMenu();
      } catch (e) {
        console.warn("Could not load menu config, using default navbar", e);
      }
      // Load translations for current locale into cache
      try {
        await this.loadTranslations(this.locale);
      } catch (err) {
        console.warn("Could not load translations:", err);
      }
      // hook up language selector
      const ls = document.getElementById("langSelect");
      if (ls) {
        ls.value = this.locale;
        ls.onchange = async () => {
          this.setLocale(ls.value);
        };
      }
      this.showApp();
      this.loadPage("dashboard");
    } else {
      this.showLogin();
    }
  }

  setLocale(locale) {
    this.locale = locale;
    localStorage.setItem("locale", locale);
    // reload menu in selected locale
    this.loadTranslations(locale).then(() => {
      this.loadAndRenderMenu();
      // Reload current page to apply translations
      const currentPage = this.currentPage || this.getCurrentPage();
      if (currentPage) {
        this.loadPage(currentPage);
      }
    });
  }

  getCurrentPage() {
    // Try to determine current page from active nav
    const activeNav = document.querySelector(".navbar-nav .nav-link.active");
    if (activeNav) {
      const navItem = activeNav.closest("li");
      if (navItem && navItem.id && navItem.id.startsWith("nav-")) {
        return navItem.id.replace("nav-", "");
      }
    }
    return this.currentPage || "dashboard";
  }

  async loadTranslations(locale) {
    try {
      const rows = await api.getTranslations(locale);
      this.translations = {};
      (rows || []).forEach((r) => {
        // key uses namespace:key
        this.translations[`${r.namespace}:${r.key}`] = r.text;
      });
      this.applyTranslationsToDom();
      return this.translations;
    } catch (error) {
      console.error("Error loading translations:", error);
      throw error;
    }
  }

  t(namespace, key) {
    return this.translations[`${namespace}:${key}`] || null;
  }

  applyTranslationsToDom() {
    // Find elements with data-i18n attribute in the form namespace:key
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      try {
        const attr = el.getAttribute("data-i18n");
        const [namespace, k] = attr.split(":");
        const txt = this.t(namespace, k);
        if (txt !== null && typeof txt !== "undefined") {
          el.textContent = txt;
        }
      } catch (err) {
        // ignore
      }
    });
  }

  // Load menu configuration from server and render nav items dynamically
  async loadAndRenderMenu() {
    try {
      const items = this.locale
        ? await api.getUiMenuForLocale(this.locale)
        : await api.getUiMenu();
      if (!items || items.length === 0) return;

      const container = document.querySelector(".navbar-nav.me-auto");
      if (!container) return;

      // Map page_key to default icons to preserve look & feel
      const iconMap = {
        dashboard: "bi-house",
        history: "bi-clock-history",
        "weekly-hours": "bi-bar-chart",
        leave: "bi-airplane",
        invoices: "bi-receipt",
        revenue: "bi-graph-up",
        admin: "bi-gear",
        "system-update": "bi-arrow-repeat",
      };

      const html = items
        .map((it) => {
          const visible = it.visible ? "" : 'style="display:none"';
          const icon = iconMap[it.page_key] || "bi-circle";
          return `<li class="nav-item" id="nav-${it.page_key}" ${visible}>
            <a class="nav-link" href="#" onclick="app.loadPage('${it.page_key}')">
              <i class="bi ${icon}"></i> ${it.label}
            </a>
          </li>`;
        })
        .join("\n");

      // Replace current nav; keep user dropdown intact
      container.innerHTML = html;
    } catch (error) {
      console.error("Error rendering menu:", error);
      throw error;
    }
  }

  applyBranding() {
    if (!this.branding) return;

    console.log("[APPLY BRANDING]", this.branding);

    // Update page title
    if (this.branding.company_name) {
      document.title = this.branding.company_name;
    }

    // Apply primary color to navbar via CSS custom property
    if (this.branding.primary_color) {
      document.documentElement.style.setProperty(
        "--branding-primary-color",
        this.branding.primary_color
      );
      console.log(
        "[APPLY BRANDING] Set CSS variable --branding-primary-color to:",
        this.branding.primary_color
      );
    }

    // Update navbar brand
    const navbarBrand = document.querySelector(".navbar-brand");
    if (navbarBrand && this.branding.company_name) {
      if (this.branding.logo_path) {
        navbarBrand.innerHTML = `
                    <img src="${this.branding.logo_path}" alt="${this.branding.company_name}" 
                         style="height: 30px; margin-right: 8px;">
                    ${this.branding.company_name}
                `;
      } else {
        navbarBrand.innerHTML = `
                    <i class="bi bi-calendar-check"></i> ${this.branding.company_name}
                `;
      }
    }

    const cssToApply =
      this.branding.custom_css && this.branding.custom_css.trim().length > 0
        ? this.branding.custom_css
        : DEFAULT_CUSTOM_CSS;
    this.applyCustomCss(cssToApply);
  }

  applyCustomCss(cssText) {
    const styleId = "custom-branding-style";
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    // Always append a small override to ensure active nav icons remain visible
    // even if admin-provided CSS sets icon colors that blend into the active background.
    const override = `\n/* Ensure active nav icons contrast with the active background */\n.nav-link.active i, .navbar .nav-link.active i { color: #ffffff !important; }\n`;
    styleTag.textContent = (cssText || "") + override;
  }

  async showLogin() {
    document.getElementById("mainNav").style.display = "none";
    document.getElementById("app").innerHTML = await renderLogin();
    initLogin();
  }

  showApp() {
    console.log("[DEBUG showApp] this.user:", this.user);
    console.log("[DEBUG showApp] this.user.isAdmin:", this.user.isAdmin);
    console.log(
      "[DEBUG showApp] typeof this.user.isAdmin:",
      typeof this.user.isAdmin
    );

    document.getElementById("mainNav").style.display = "block";
    document.getElementById("userName").textContent = this.user.fullName;
    window.currentUser = this.user;

    // Show/hide admin menus
    const adminMenu = document.getElementById("nav-admin");
    const invoicesMenu = document.getElementById("nav-invoices");
    const revenueMenu = document.getElementById("nav-revenue");
    console.log("[DEBUG showApp] adminMenu element found:", !!adminMenu);

    if (this.user.isAdmin) {
      console.log(
        "[DEBUG showApp] Setting nav-admin and nav-invoices to display: block"
      );
      if (adminMenu && adminMenu.style.display !== "none")
        adminMenu.style.display = "block";
      if (invoicesMenu && invoicesMenu.style.display !== "none")
        invoicesMenu.style.display = "block";
      if (revenueMenu && revenueMenu.style.display !== "none")
        revenueMenu.style.display = "block";
    } else {
      console.log(
        "[DEBUG showApp] Setting nav-admin and nav-invoices to display: none"
      );
      if (adminMenu) adminMenu.style.display = "none";
      if (invoicesMenu) invoicesMenu.style.display = "none";
      if (revenueMenu) revenueMenu.style.display = "none";
    }
  }

  loadPage(page) {
    // Track current page
    this.currentPage = page;

    // Update active nav
    document.querySelectorAll(".navbar-nav .nav-link").forEach((link) => {
      link.classList.remove("active");
    });

    const navItem = document.getElementById(`nav-${page}`);
    if (navItem) {
      navItem.querySelector(".nav-link").classList.add("active");
    }

    // Load page content
    switch (page) {
      case "dashboard":
        document.getElementById("app").innerHTML = renderDashboard();
        initDashboard();
        this.applyTranslationsToDom();
        break;
      case "history":
        document.getElementById("app").innerHTML = renderHistory();
        initHistory();
        this.applyTranslationsToDom();
        break;
      case "weekly-hours":
        document.getElementById("app").innerHTML = renderWeeklySummary();
        initWeeklySummary();
        this.applyTranslationsToDom();
        break;
      case "leave":
        document.getElementById("app").innerHTML = renderLeave();
        initLeave();
        this.applyTranslationsToDom();
        break;
      case "invoices":
        if (this.user.isAdmin) {
          document.getElementById("app").innerHTML = '<div id="content"></div>';
          if (typeof invoiceManager !== "undefined") {
            invoiceManager.init();
          } else {
            document.getElementById("app").innerHTML =
              '<div class="alert alert-danger">Invoice module failed to load.</div>';
          }
          this.applyTranslationsToDom();
        } else {
          alert("Access denied");
        }
        break;
      case "revenue":
        if (this.user.isAdmin) {
          document.getElementById("app").innerHTML = renderRevenue();
          initRevenue();
          this.applyTranslationsToDom();
        } else {
          alert("Access denied");
        }
        break;
      case "admin":
        if (this.user.isAdmin) {
          if (!window.adminModuleReady) {
            // Wait for admin module to load
            console.log("[ADMIN] Waiting for admin module to load...");
            let retries = 0;
            const waitForAdmin = setInterval(() => {
              retries++;
              if (window.adminModuleReady) {
                clearInterval(waitForAdmin);
                document.getElementById("app").innerHTML = renderAdmin();
                setTimeout(() => {
                  if (typeof initAdmin === "function") {
                    console.log("[ADMIN] Calling initAdmin()");
                    initAdmin();
                  }
                  this.applyTranslationsToDom();
                }, 50);
              } else if (retries > 50) {
                clearInterval(waitForAdmin);
                console.error("[ADMIN] Timeout waiting for admin module");
                document.getElementById("app").innerHTML =
                  '<div class="alert alert-danger">Admin module failed to load. Please refresh the page.</div>';
              }
            }, 100);
            return;
          }
          document.getElementById("app").innerHTML = renderAdmin();
          // Call initAdmin directly - it's now a global function
          setTimeout(() => {
            if (typeof initAdmin === "function") {
              console.log("[ADMIN] Calling initAdmin()");
              initAdmin();
            } else {
              console.error("[ADMIN] initAdmin function not found");
            }
            this.applyTranslationsToDom();
          }, 50);
        } else {
          alert("Access denied");
        }
        break;
      case "system-update":
        if (this.user.isAdmin) {
          document.getElementById("app").innerHTML = renderSystemUpdate();
          if (typeof initSystemUpdate === "function") {
            initSystemUpdate();
          }
          this.applyTranslationsToDom();
        } else {
          alert("Access denied");
        }
        break;
      case "change-password":
        document.getElementById("app").innerHTML = renderChangePassword();
        initChangePassword();
        this.applyTranslationsToDom();
        break;
      default:
        this.loadPage("dashboard");
    }
  }

  logout() {
    showConfirmModal("Logout", "Are you sure you want to logout?", () => {
      api.clearToken();
      localStorage.removeItem("user");
      this.user = null;
      window.currentUser = null;
      this.showLogin();
    });
  }

  showMessage(message, type = "info") {
    showToast(message, type);
  }
}

// Global toast notification function
function showToast(message, type = "info") {
  const toastContainer =
    document.getElementById("toastContainer") || createToastContainer();

  const toastId = "toast-" + Date.now();
  const iconMap = {
    success: "check-circle",
    error: "exclamation-circle",
    warning: "exclamation-triangle",
    info: "info-circle",
  };
  const bgMap = {
    success: "bg-success",
    error: "bg-danger",
    warning: "bg-warning",
    info: "bg-info",
  };

  const toastHtml = `
    <div class="toast align-items-center text-white ${
      bgMap[type] || "bg-info"
    } border-0" role="alert" id="${toastId}">
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi bi-${iconMap[type] || "info-circle"}"></i> ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML("beforeend", toastHtml);

  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
  toast.show();

  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove();
  });
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toastContainer";
  container.className = "toast-container position-fixed bottom-0 end-0 p-3";
  document.body.appendChild(container);
  return container;
}

// Global confirmation modal system
let globalConfirmCallback = null;

function showConfirmModal(title, message, onConfirm, onCancel = null) {
  globalConfirmCallback = onConfirm;

  // Create or update modal
  let modal = document.getElementById("globalConfirmModal");
  if (!modal) {
    const modalHTML = `
            <div class="modal fade" id="globalConfirmModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="confirmModalTitle">
                                <i class="bi bi-question-circle text-warning"></i> Confirm
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="confirmModalMessage"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmModalConfirmBtn" onclick="executeConfirm()">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    modal = document.getElementById("globalConfirmModal");
  }

  // Update modal content
  document.getElementById(
    "confirmModalTitle"
  ).innerHTML = `<i class="bi bi-question-circle text-warning"></i> ${title}`;
  document.getElementById("confirmModalMessage").textContent = message;

  // Show modal
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();

  // Handle cancel
  if (onCancel) {
    modal.addEventListener("hidden.bs.modal", onCancel, { once: true });
  }
}

function executeConfirm() {
  console.log(
    "executeConfirm called, globalConfirmCallback:",
    globalConfirmCallback ? "exists" : "null"
  );
  if (globalConfirmCallback) {
    try {
      globalConfirmCallback();
    } catch (error) {
      console.error("Error executing callback:", error);
    }
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("globalConfirmModal")
    );
    if (modal) modal.hide();
  }
  globalConfirmCallback = null;
}

// Make executeConfirm globally accessible
window.executeConfirm = executeConfirm;

// Initialize app when DOM is ready
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new App();
});
