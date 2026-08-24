(function () {
  "use strict";

  // Prevent multiple script instances from initializing competing lifecycles
  if (window.__SmartStockStockoutShieldActive) {
    return;
  }
  window.__SmartStockStockoutShieldActive = true;

  console.log("[Smart Stock] Authoritative Stockout Shield controller initialized");

  let activeVariantId = null;
  let activeGeneration = 0;
  let activeAbortController = null;
  let debounceTimer = null;
  let isFormInterceptAttached = false;
  let currentResolvedState = "UNKNOWN"; // UNKNOWN, HEALTHY, LOW_STOCK, ZERO_PREORDER, ZERO_NOTIFY

  // ==================================================
  // UTILITIES & VARIANT RESOLUTION
  // ==================================================

  function normalizeVariantId(value) {
    if (!value) return "";
    const match = String(value).match(/(\d+)$/);
    return match ? match[1] : "";
  }

  function getShopDomain() {
    if (window.SmartStockContext?.shop) {
      return window.SmartStockContext.shop;
    }
    if (window.SmartStockEmbedConfig?.shop) {
      return window.SmartStockEmbedConfig.shop;
    }
    if (window.Shopify?.shop) {
      return window.Shopify.shop;
    }
    return window.location.hostname;
  }

  function resolveCurrentVariantId() {
    // 1. URL parameter ?variant=
    const params = new URLSearchParams(window.location.search);
    const urlVariant = params.get("variant");
    if (urlVariant) {
      const id = normalizeVariantId(urlVariant);
      if (id) return id;
    }

    // 2. Form input[name="id"] or select[name="id"]
    const formInput = document.querySelector(
      'form[action*="/cart/add"] input[name="id"], form[action*="/cart/add"] select[name="id"], input[name="id"], select[name="id"], product-form input[name="id"]'
    );
    if (formInput && formInput.value) {
      const id = normalizeVariantId(formInput.value);
      if (id) return id;
    }

    // 3. Checked radio button for id/variant
    const checkedRadio = document.querySelector(
      'form[action*="/cart/add"] input[type="radio"][name="id"]:checked, input[type="radio"][name="id"]:checked'
    );
    if (checkedRadio && checkedRadio.value) {
      const id = normalizeVariantId(checkedRadio.value);
      if (id) return id;
    }

    // 4. ShopifyAnalytics metadata
    if (window.ShopifyAnalytics?.meta?.selectedVariantId) {
      const id = normalizeVariantId(window.ShopifyAnalytics.meta.selectedVariantId);
      if (id) return id;
    }
    if (window.ShopifyAnalytics?.meta?.product?.selectedVariantId) {
      const id = normalizeVariantId(window.ShopifyAnalytics.meta.product.selectedVariantId);
      if (id) return id;
    }

    // 5. Global SmartStock context
    if (window.SmartStockContext?.variantId) {
      const id = normalizeVariantId(window.SmartStockContext.variantId);
      if (id) return id;
    }
    if (window.SmartStockEmbedConfig?.variantId) {
      const id = normalizeVariantId(window.SmartStockEmbedConfig.variantId);
      if (id) return id;
    }

    // 6. Liquid block / embed metadata
    const liquidBlock = document.getElementById("smart-stock-high-demand");
    if (liquidBlock?.dataset?.variantId) {
      const id = normalizeVariantId(liquidBlock.dataset.variantId);
      if (id) return id;
    }

    return "";
  }

  function getProductId() {
    const liquidBlock = document.getElementById("smart-stock-high-demand");
    if (liquidBlock?.dataset?.productId) {
      return normalizeVariantId(liquidBlock.dataset.productId);
    }
    if (window.SmartStockContext?.productId) {
      return normalizeVariantId(window.SmartStockContext.productId);
    }
    if (window.SmartStockEmbedConfig?.productId) {
      return normalizeVariantId(window.SmartStockEmbedConfig.productId);
    }
    if (window.ShopifyAnalytics?.meta?.product?.id) {
      return normalizeVariantId(window.ShopifyAnalytics.meta.product.id);
    }
    return "";
  }

  async function resolveVariantAndProductWithFallback() {
    let variantId = resolveCurrentVariantId();
    let productId = getProductId();

    if (!variantId && window.location.pathname.includes("/products/")) {
      try {
        const handle = window.location.pathname.split("/products/")[1]?.split(/[/?#]/)[0];
        if (handle) {
          const res = await fetch(`/products/${handle}.js`, { headers: { Accept: "application/json" } });
          if (res.ok) {
            const prodData = await res.json();
            if (prodData) {
              if (!productId && prodData.id) {
                productId = String(prodData.id);
              }
              if (prodData.variants && prodData.variants.length > 0) {
                const params = new URLSearchParams(window.location.search);
                const urlVar = params.get("variant");
                if (urlVar) {
                  const match = prodData.variants.find((v) => String(v.id) === String(urlVar));
                  variantId = match ? String(match.id) : String(prodData.variants[0].id);
                } else {
                  variantId = String(prodData.variants[0].id);
                }
              }
            }
          }
        }
      } catch (err) {
        // Fallback silently
      }
    }

    return { variantId, productId };
  }

  function getSelectedQuantity() {
    const qtyInput = document.querySelector('form[action*="/cart/add"] input[name="quantity"], input[name="quantity"]');
    const val = Number(qtyInput?.value);
    return Number.isFinite(val) && val > 0 ? Math.floor(val) : 1;
  }

  function findAddToCartContainer() {
    const selectors = [
      'form[action*="/cart/add"] .product-form__buttons',
      '.product-form__buttons',
      'product-form .product-form__buttons',
      'form[action*="/cart/add"] button[name="add"]',
      'form[action*="/cart/add"] button[type="submit"]',
      'button[name="add"]',
      'button[type="submit"][name="add"]',
      'product-form button[type="submit"]',
      '.product-form__submit',
      'form[action*="/cart/add"]',
      '.product-form',
      'product-form',
      '.product__info-container .product-form',
      '.product-single__meta form',
      '[data-add-to-cart]',
      '.product__info-container'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }

    return null;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseBoolean(val) {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const s = val.trim().toLowerCase();
      return s === "true" || s === "1" || s === "yes" || s === "on";
    }
    if (typeof val === "number") return val === 1;
    return false;
  }

  // ==================================================
  // CLEANUP / SINGLE DOM CONTAINER
  // ==================================================

  function removeAllStockoutWidgets() {
    document.querySelectorAll("#smart-stock-stockout-shield, #smart-stock-high-demand-shield, .smart-stock-embed-stockout, .smart-stock-embed-urgency").forEach((el) => {
      el.remove();
    });
  }

  // ==================================================
  // PURCHASE CONTROL SYNCHRONIZATION
  // ==================================================

  function syncPurchaseControls(state) {
    currentResolvedState = state;

    const buttons = document.querySelectorAll(
      'form[action*="/cart/add"] button[name="add"], form[action*="/cart/add"] button[type="submit"], form[action*="/cart/add"] .product-form__submit, form[action*="/cart/add"] .shopify-payment-button, form[action*="/cart/add"] [data-add-to-cart], form[action*="/cart/add"] .shopify-payment-button__button, form[action*="/cart/add"] shopify-buy-it-now-button, button[name="add"], .product-form__submit, .shopify-payment-button, shopify-buy-it-now-button'
    );

    const themeNotifyButtons = document.querySelectorAll(
      '.theme-notify-me, [data-notify-me], .smart-stock-embed-stockout, .smart-stock-embed-urgency'
    );

    if (state === "ZERO_NOTIFY" || state === "ZERO_PREORDER") {
      // Suppress normal purchasing controls
      buttons.forEach((btn) => {
        btn.setAttribute("data-smart-stock-disabled", "true");
        btn.setAttribute("aria-disabled", "true");
        btn.classList.add("smart-stock-button-suppressed");
      });

      // Suppress duplicate theme notify buttons and floating badges
      themeNotifyButtons.forEach((btn) => {
        btn.classList.add("smart-stock-theme-notify-suppressed");
      });
    } else {
      // Re-enable normal purchasing controls
      buttons.forEach((btn) => {
        if (btn.getAttribute("data-smart-stock-disabled") === "true") {
          btn.removeAttribute("data-smart-stock-disabled");
          btn.removeAttribute("aria-disabled");
          btn.classList.remove("smart-stock-button-suppressed");
        }
      });

      themeNotifyButtons.forEach((btn) => {
        btn.classList.remove("smart-stock-theme-notify-suppressed");
      });
    }

    attachFormSubmitInterceptor();
  }

  function attachFormSubmitInterceptor() {
    if (isFormInterceptAttached) return;
    const form = document.querySelector('form[action*="/cart/add"], product-form form, .product-form form');
    if (!form) return;

    isFormInterceptAttached = true;
    form.addEventListener("submit", function (e) {
      if (currentResolvedState === "ZERO_NOTIFY") {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("[Smart Stock] Purchase intercepted: Item is out of stock.");
      } else if (currentResolvedState === "ZERO_PREORDER") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const preOrderBtn = document.querySelector("#smart-stock-stockout-shield [data-smart-stock-preorder-btn]");
        handlePreOrderSubmit(activeVariantId, preOrderBtn);
      }
    }, true);
  }

  function getProductHandle() {
    if (window.location.pathname.includes("/products/")) {
      const parts = window.location.pathname.split("/products/");
      return parts[1]?.split(/[/?#]/)[0] || "";
    }
    return "";
  }

  function openNotifyMeModal(productInfo, variantId) {
    const existingModal = document.getElementById("smart-stock-notify-modal-overlay");
    if (existingModal) {
      existingModal.remove();
    }

    const shop = getShopDomain();
    const productId = productInfo?.productId || getProductId();
    const productTitle = productInfo?.productTitle || document.title || "Product";
    const variantTitle = productInfo?.variantTitle || "";
    const productHandle = getProductHandle();

    const overlay = document.createElement("div");
    overlay.id = "smart-stock-notify-modal-overlay";
    overlay.className = "smart-stock-modal-overlay";

    overlay.innerHTML = `
      <div class="smart-stock-modal" role="dialog" aria-modal="true" aria-labelledby="smart-stock-modal-title">
        <button type="button" class="smart-stock-modal-close" aria-label="Close modal">&times;</button>
        <div class="smart-stock-modal-header">
          <span style="font-size: 20px;">🔔</span>
          <h3 id="smart-stock-modal-title" class="smart-stock-modal-title">Notify Me</h3>
        </div>
        <p class="smart-stock-modal-subtitle">Get notified when <strong>${escapeHtml(productTitle)}${variantTitle && variantTitle !== "Default Title" ? ` (${escapeHtml(variantTitle)})` : ""}</strong> is back in stock.</p>
        
        <form class="smart-stock-modal-form" id="smart-stock-notify-form">
          <div>
            <label for="smart-stock-email-input" class="smart-stock-modal-label">Email address</label>
            <input
              type="email"
              id="smart-stock-email-input"
              class="smart-stock-modal-input"
              placeholder="customer@example.com"
              required
              autocomplete="email"
            />
          </div>
          <button type="submit" class="smart-stock-modal-submit" id="smart-stock-notify-submit-btn">Notify Me</button>
          <div id="smart-stock-modal-msg-container"></div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".smart-stock-modal-close");
    const form = overlay.querySelector("#smart-stock-notify-form");
    const emailInput = overlay.querySelector("#smart-stock-email-input");
    const submitBtn = overlay.querySelector("#smart-stock-notify-submit-btn");
    const msgContainer = overlay.querySelector("#smart-stock-modal-msg-container");

    function closeModal() {
      window.removeEventListener("keydown", handleKeydown);
      overlay.remove();
    }

    function handleKeydown(e) {
      if (e.key === "Escape") {
        closeModal();
      }
    }

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    window.addEventListener("keydown", handleKeydown);
    emailInput.focus();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = String(emailInput.value || "").trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        msgContainer.innerHTML = `<div class="smart-stock-modal-msg smart-stock-modal-msg--error">Please enter a valid email address.</div>`;
        emailInput.focus();
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
        msgContainer.innerHTML = "";

        const payload = {
          shop,
          productId,
          variantId,
          email,
          productHandle,
          productTitle,
          variantTitle,
        };

        let response = await fetch(`/apps/smart-stock/stockout-notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          response = await fetch(`/api/storefront/stockout-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
          });
        }

        const data = await response.json();

        if (data && data.success) {
          if (data.duplicate || data.status === "already_subscribed") {
            msgContainer.innerHTML = `<div class="smart-stock-modal-msg smart-stock-modal-msg--info">You're already on the notification list for this product.</div>`;
          } else {
            msgContainer.innerHTML = `<div class="smart-stock-modal-msg smart-stock-modal-msg--success">✓ You're on the list! We'll email you when this product is back in stock.</div>`;
          }
          submitBtn.style.display = "none";
          emailInput.disabled = true;
          setTimeout(() => {
            closeModal();
          }, 3500);
        } else {
          throw new Error(data?.message || "Unable to save notification subscription.");
        }
      } catch (err) {
        console.error("[Smart Stock] Notify Me Error:", err);
        msgContainer.innerHTML = `<div class="smart-stock-modal-msg smart-stock-modal-msg--error">${escapeHtml(err.message || "Failed to subscribe. Please try again.")}</div>`;
        submitBtn.disabled = false;
        submitBtn.textContent = "Notify Me";
      }
    });
  }

  // ==================================================
  // PRE-ORDER SUBMISSION WORKFLOW
  // ==================================================

  async function handlePreOrderSubmit(variantId, button) {
    if (!variantId) return;
    const qty = getSelectedQuantity();

    try {
      if (button) {
        button.disabled = true;
        button.innerHTML = "<span>⏳</span><span>Processing Pre-Order...</span>";
      }

      const shop = getShopDomain();
      const productId = getProductId();

      // Record pre-order in background
      fetch("/api/pre-orders/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          variantId,
          productId,
          quantity: qty,
          productTitle: document.title || "Pre-Order Product",
        }),
      }).catch(() => {});

      const response = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              id: Number(variantId),
              quantity: qty,
              properties: {
                "Pre-Order": "Yes",
                "_preorder": "true",
                "_preorder_variant": String(variantId),
                "_stockout_shield": "true",
              },
            },
          ],
        }),
      });

      // Update cart attributes for checkout identification and COD restriction rules
      await fetch("/cart/update.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          attributes: {
            "_preorder_present": "true",
            "Pre-Order": "Contains Pre-Order item",
          },
        }),
      }).catch(() => {});

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn("[Smart Stock] /cart/add.js notice:", errorData);
        // Direct Shopify checkout permalink with pre-order attribute
        window.location.href = `/cart/${variantId}:${qty}?attributes[_preorder_present]=true`;
        return;
      }

      if (button) {
        button.innerHTML = "<span>✓</span><span>Redirecting to Checkout...</span>";
        button.style.background = "#059669";
      }

      setTimeout(() => {
        window.location.href = "/checkout";
      }, 400);
    } catch (err) {
      console.error("[Smart Stock] Pre-Order Error:", err);
      window.location.href = `/cart/${variantId}:${qty}?attributes[_preorder_present]=true`;
    }
  }

  // ==================================================
  // STATE MACHINE & RENDERER
  // ==================================================

  function resolveState(data) {
    if (!data || !data.success || data.show === false) {
      return "HEALTHY";
    }

    const stock = Number(data.stock ?? 0);
    const threshold = Number(data.lowStockBadge?.threshold || 5);
    const isLowStockBadgeEnabled = parseBoolean(
      data.lowStockBadge?.show ??
      data.lowStockBadge?.enabled ??
      data.urgencyBadgeEnabled ??
      data.widget?.showBadge
    );
    const isPreOrderEnabled = parseBoolean(
      data.preOrder?.show ??
      data.preOrder?.enabled ??
      data.preOrderEnabled ??
      data.widget?.showPreOrder ??
      data.widget?.preOrderEnabled
    );
    const isNotifyMeEnabled =
      data.notifyMe?.show !== undefined
        ? parseBoolean(data.notifyMe.show)
        : data.notifyMe?.enabled !== undefined
        ? parseBoolean(data.notifyMe.enabled)
        : data.notifyMeEnabled !== undefined
        ? parseBoolean(data.notifyMeEnabled)
        : true;

    // RULE 1: IN STOCK (Stock > 0) -> Low stock urgency badge if enabled
    if (stock > 0) {
      return isLowStockBadgeEnabled && stock <= threshold ? "LOW_STOCK" : "HEALTHY";
    }

    // RULE 2: OUT OF STOCK (Stock <= 0) -> Notify Me only (Pre-orders handled exclusively by Launch Pre-Order)
    if (stock <= 0) {
      if (isNotifyMeEnabled && data.notifyMe?.show !== false) return "ZERO_NOTIFY";
      return "HEALTHY";
    }

    return "HEALTHY";
  }

  function renderStockoutState(data, targetVariantId) {
    removeAllStockoutWidgets();

    if (!data || !data.success || data.show === false) {
      syncPurchaseControls("HEALTHY");
      return;
    }

    const stock = Number(data.stock ?? 0);
    const threshold = Number(data.lowStockBadge?.threshold || 5);
    const isLowStockBadgeEnabled = parseBoolean(
      data.lowStockBadge?.show ??
      data.lowStockBadge?.enabled ??
      data.urgencyBadgeEnabled ??
      data.widget?.showBadge
    );

    syncPurchaseControls("HEALTHY");

    // Render Low Stock badge when stock <= threshold
    if (!isLowStockBadgeEnabled || stock > threshold) {
      return;
    }

    const targetContainer = findAddToCartContainer();
    if (!targetContainer) {
      return;
    }

    const shieldEl = document.createElement("div");
    shieldEl.id = "smart-stock-stockout-shield";
    shieldEl.className = "smart-stock-high-demand";

    const badgeMessage = data.lowStockBadge?.message || `🔥 Only ${stock} left in stock!`;
    const badgeSubtext = data.lowStockBadge?.subtext || "";
    const bgColor = data.lowStockBadge?.backgroundColor || "#FFF1F2";
    const borderColor = data.lowStockBadge?.borderColor || "#FECDD3";
    const textColor = data.lowStockBadge?.textColor || "#991B1B";
    const subtextColor = data.lowStockBadge?.subtextColor || "#B91C1C";
    const borderRadius = (data.lowStockBadge?.borderRadius ?? 8) + "px";
    const pulseStyle = data.lowStockBadge?.pulseAnimation ? "animation: smartStockPulse 2s infinite ease-in-out;" : "";

    shieldEl.innerHTML = `
      <div class="smart-stock-badge-container" style="background-color: ${escapeHtml(bgColor)}; border-color: ${escapeHtml(borderColor)}; border-radius: ${escapeHtml(borderRadius)}; color: ${escapeHtml(textColor)}; ${pulseStyle}">
        <div class="smart-stock-badge-main" style="color: ${escapeHtml(textColor)};">
          <span>${escapeHtml(badgeMessage)}</span>
        </div>
        ${badgeSubtext ? `<div class="smart-stock-badge-subtext" style="color: ${escapeHtml(subtextColor)};">${escapeHtml(badgeSubtext)}</div>` : ""}
      </div>
    `;

    targetContainer.parentNode.insertBefore(shieldEl, targetContainer);
  }

  // ==================================================
  // DATA FETCH WITH GENERATION / RACE-CONDITION GUARD
  // ==================================================

  async function fetchStockoutState(variantId, generation) {
    if (!variantId) return;

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    const shop = getShopDomain();
    const productId = getProductId();

    const proxyUrls = [
      `/apps/smart-stock/stockout-shield?shop=${encodeURIComponent(shop)}&variantId=${encodeURIComponent(variantId)}&productId=${encodeURIComponent(productId)}`,
      `/apps/smart-stock/high-demand?shop=${encodeURIComponent(shop)}&variantId=${encodeURIComponent(variantId)}&productId=${encodeURIComponent(productId)}`,
      `/api/storefront/stockout-shield?shop=${encodeURIComponent(shop)}&variantId=${encodeURIComponent(variantId)}&productId=${encodeURIComponent(productId)}`
    ];

    let data = null;
    for (const url of proxyUrls) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: activeAbortController.signal,
        });

        if (response.ok) {
          data = await response.json();
          if (data && data.success !== undefined) {
            break;
          }
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return; // Newer variant request has already superseded this one
        }
      }
    }

    // Ignore if a newer generation request was initiated while waiting
    if (generation !== activeGeneration) {
      return;
    }

    if (data) {
      renderStockoutState(data, variantId);
    } else {
      console.warn("[Smart Stock] Unable to reach backend. Keeping safe default.");
      removeAllStockoutWidgets();
      syncPurchaseControls("HEALTHY");
    }
  }

  // ==================================================
  // SCHEDULER / DEBOUNCED DISPATCHER
  // ==================================================

  function scheduleStockoutRefresh(force = false) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      let { variantId } = await resolveVariantAndProductWithFallback();
      if (!variantId) {
        setTimeout(async () => {
          const retry = await resolveVariantAndProductWithFallback();
          if (retry.variantId && (force || retry.variantId !== activeVariantId)) {
            activeVariantId = retry.variantId;
            activeGeneration++;
            fetchStockoutState(retry.variantId, activeGeneration);
          }
        }, 150);
        return;
      }

      if (force || variantId !== activeVariantId) {
        activeVariantId = variantId;
        activeGeneration++;
        fetchStockoutState(variantId, activeGeneration);
      }
    }, 30);
  }

  // ==================================================
  // INITIALIZATION & LIFECYCLE LISTENERS
  // ==================================================

  function init() {
    scheduleStockoutRefresh(true);

    // 1. Document / Window Lifecycle
    window.addEventListener("load", () => scheduleStockoutRefresh(true));
    window.addEventListener("pageshow", () => scheduleStockoutRefresh(true));
    window.addEventListener("popstate", () => scheduleStockoutRefresh(true));

    // 2. Variant selection changes
    document.addEventListener("change", (e) => {
      const target = e.target;
      if (
        target &&
        (target.name === "id" ||
          target.closest('form[action*="/cart/add"]') ||
          target.matches('input[type="radio"], select, [data-single-option-selector]'))
      ) {
        scheduleStockoutRefresh(true);
      }
    }, true);

    document.addEventListener("variant:change", () => scheduleStockoutRefresh(true));

    // 3. Shopify Section rendering events
    document.addEventListener("shopify:section:load", () => scheduleStockoutRefresh(true));
    document.addEventListener("shopify:section:reorder", () => scheduleStockoutRefresh(true));
    document.addEventListener("shopify:section:select", () => scheduleStockoutRefresh(true));
    document.addEventListener("shopify:section:deselect", () => scheduleStockoutRefresh(true));

    // 4. MutationObserver on product form container (ignoring own widget mutations)
    const productContainer = document.querySelector('form[action*="/cart/add"], product-form, .product-form') || document.body;
    if (productContainer && window.MutationObserver) {
      const observer = new MutationObserver((mutations) => {
        let shouldTrigger = false;
        for (const m of mutations) {
          if (
            m.target.closest &&
            (m.target.closest("#smart-stock-stockout-shield") ||
              m.target.closest("#smart-stock-notify-modal-overlay"))
          ) {
            continue; // Ignore our own DOM changes
          }
          const variantId = resolveCurrentVariantId();
          if (variantId && variantId !== activeVariantId) {
            shouldTrigger = true;
            break;
          }
        }
        if (shouldTrigger) {
          scheduleStockoutRefresh(false);
        }
      });
      observer.observe(productContainer, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();