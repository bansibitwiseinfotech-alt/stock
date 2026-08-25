(function () {
  "use strict";

  function formatMoney(amount, currency, moneyFormat) {
    var num = Number(amount);
    if (isNaN(num)) return "";
    if (window.Shopify && typeof window.Shopify.formatMoney === "function") {
      return window.Shopify.formatMoney(Math.round(num * 100), moneyFormat || "${{amount}}");
    }
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD"
      }).format(num);
    } catch (e) {
      return "$" + num.toFixed(2);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function resolveVariantIdForProduct(prodIdOrHandle, shop) {
    if (!prodIdOrHandle) return null;
    var clean = String(prodIdOrHandle).replace("gid://shopify/Product/", "").trim();

    // 1. Try product handle direct endpoint
    try {
      var res = await fetch("/products/" + encodeURIComponent(clean) + ".js");
      if (res.ok) {
        var prodData = await res.json();
        if (prodData && prodData.variants && prodData.variants.length > 0) {
          return prodData.variants[0].id;
        }
      }
    } catch (e) {}

    // 2. Try Smart Stock app proxy endpoint
    if (shop) {
      try {
        var widgetRes = await fetch("/apps/smart-stock/api/storefront/product-widget?shop=" + encodeURIComponent(shop) + "&productId=" + encodeURIComponent(clean));
        if (widgetRes.ok) {
          var wJson = await widgetRes.json();
          if (wJson && wJson.variantId) {
            return Number(String(wJson.variantId).replace(/\D/g, ""));
          }
        }
      } catch (e) {}
    }

    return null;
  }

  function initBundleWidgets() {
    var sections = document.querySelectorAll(".smart-stock-bundle-widget, .smart-stock-bundles-section");
    if (!sections.length) return;

    sections.forEach(function (section) {
      var shop = section.getAttribute("data-shop");
      var productId = section.getAttribute("data-product-id");
      var currentVariantId = section.getAttribute("data-variant-id");
      var currency = section.getAttribute("data-currency") || "USD";
      var moneyFormat = section.getAttribute("data-money-format") || "${{amount}}";
      var rootContainer = section.querySelector(".ss-bundle-outer-wrapper, .smart-stock-bundle-content");

      if (!shop || !rootContainer) return;

      loadBundles(shop, productId, currentVariantId, currency, moneyFormat, rootContainer);
    });
  }

  async function loadBundles(shop, productId, currentVariantId, currency, moneyFormat, container) {
    var params = new URLSearchParams({ shop: shop });
    if (productId) params.append("productId", productId);
    if (currentVariantId) params.append("variantId", currentVariantId);

    var candidateUrls = [
      "/apps/smart-stock/api/storefront/bundles?" + params.toString(),
      "/api/storefront/bundles?" + params.toString(),
      "/apps/smart-stock/api/storefront/product-widget?" + params.toString(),
      "/api/storefront/product-widget?" + params.toString()
    ];

    var bundles = [];
    var bundleConfig = null;

    for (var i = 0; i < candidateUrls.length; i++) {
      try {
        var res = await fetch(candidateUrls[i], {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store"
        });

        if (res.ok) {
          var json = await res.json();
          if (json.success) {
            if (json.bundleConfig) {
              bundleConfig = json.bundleConfig;
            }
            if (Array.isArray(json.data) && json.data.length > 0) {
              bundles = json.data;
              break;
            } else if (json.deadStockOffer && json.deadStockOffer.hasBundle && json.deadStockOffer.bundle) {
              bundles = [json.deadStockOffer.bundle];
              if (json.bundleConfig) bundleConfig = json.bundleConfig;
              break;
            }
          }
        }
      } catch (err) {}
    }

    if (bundleConfig && bundleConfig.enabled === false) {
      container.innerHTML = "";
      var parentSection = container.closest(".smart-stock-bundle-widget, .smart-stock-bundles-section, section");
      if (parentSection) {
        parentSection.style.display = "none";   
        try { parentSection.remove(); } catch(e) {}
      }
      return;
    }

    if (!bundles || bundles.length === 0) {
      container.innerHTML = "";
      var parentSection = container.closest(".smart-stock-bundle-widget, .smart-stock-bundles-section, section");
      if (parentSection) {
        parentSection.style.display = "none";   
        try { parentSection.remove(); } catch(e) {}
      }
      return;
    }

    var parentSection = container.closest(".smart-stock-bundle-widget, .smart-stock-bundles-section");
    if (parentSection) {
      parentSection.style.display = "block";  
    }
    renderBundles(bundles, currency, moneyFormat, currentVariantId, container, bundleConfig);
  }

  function isPlaceholderText(str) {
    if (!str || typeof str !== "string") return true;
    var s = str.trim().toLowerCase();
    return (
      s === "" ||
      s === "this product" ||
      s === "primary product" ||
      s === "recommended companion item" ||
      s === "recommended companion" ||
      s === "companion product" ||
      s === "recommended product" ||
      s === "product" ||
      s === "product unavailable"
    );
  }

  function getPageProductTitle() {
    var el = document.querySelector(".product__title, .product-title, h1.title, h1");
    return el ? el.innerText.trim() : "";
  }

  function renderProductImageHtml(imgUrl, altTitle) {
    if (imgUrl && typeof imgUrl === "string" && !imgUrl.includes("placeholder-images-image_large.png")) {
      return (
        '<img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(altTitle) + '" class="ss-item-img" loading="lazy" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\';" />' +
        '<div class="ss-item-img ss-item-img-placeholder" style="display:none;align-items:center;justify-content:center;font-size:18px;background:#f3f4f6;border-radius:8px;border:1px solid #e5e7eb;">📦</div>'
      );
    }
    return '<div class="ss-item-img ss-item-img-placeholder" style="display:flex;align-items:center;justify-content:center;font-size:18px;background:#f3f4f6;border-radius:8px;border:1px solid #e5e7eb;">📦</div>';
  }

  function renderBundles(bundles, currency, moneyFormat, currentVariantId, container, config) {
    container.innerHTML = "";

    bundles.forEach(function (bundle) {
      var isBOGO = String(bundle.offerType || "").trim().toUpperCase() === "BOGO";

      if (isBOGO) {
        renderBOGOBundle(bundle, currency, moneyFormat, currentVariantId, container, config);
      } else {
        renderNormalBundle(bundle, currency, moneyFormat, currentVariantId, container, config);
      }
    });

    if (container.children.length === 0) {
      var parentSection = container.closest(".smart-stock-bundle-widget, .smart-stock-bundles-section, section");
      if (parentSection) {
        parentSection.style.display = "none";
        try { parentSection.remove(); } catch(e) {}
      }
    }
  }

  function renderBOGOBundle(bundle, currency, moneyFormat, currentVariantId, container, config) {
    config = config || {};
    var pageTitle = getPageProductTitle();
    var card = document.createElement("div");
    card.className = "ss-bundle-card ss-bogo-card";

    var borderRadius = Number(config.borderRadius) || 12;
    card.style.borderRadius = borderRadius + "px";

    var deadStockTitle =
      (!isPlaceholderText(bundle.deadStockTitle) ? bundle.deadStockTitle : "") ||
      pageTitle ||
      bundle.deadStockVariantTitle ||
      "";

    var freeProductTitle =
      (!isPlaceholderText(bundle.freeProductTitle) ? bundle.freeProductTitle : "") ||
      (!isPlaceholderText(bundle.companionTitle) ? bundle.companionTitle : "") ||
      bundle.companionVariantTitle ||
      "";

    if (!deadStockTitle || deadStockTitle === "Product unavailable" || !freeProductTitle || freeProductTitle === "Product unavailable") {
      return;
    }

    var deadStockImgHtml = renderProductImageHtml(bundle.deadStockImage, deadStockTitle);
    var freeImgHtml = renderProductImageHtml(bundle.freeProductImage || bundle.companionImage, freeProductTitle);

    var bundleName = bundle.name || bundle.bundleName || (deadStockTitle + " + " + freeProductTitle + " BOGO");

    var deadStockPrice = Number(bundle.deadStockPrice || bundle.bundlePrice || bundle.originalPrice || 0);
    var freePrice = Number(bundle.companionPrice || bundle.savings || 0);
    var savings = Number(bundle.savings || freePrice);

    var formattedDeadStockPrice = formatMoney(deadStockPrice, currency, moneyFormat);
    var formattedFreeOrigPrice = freePrice > 0 ? formatMoney(freePrice, currency, moneyFormat) : "";
    var formattedSavings = savings > 0 ? formatMoney(savings, currency, moneyFormat) : formattedFreeOrigPrice;

    var headerTitle = config.headerTitle || "Buy One Get One Free";
    var buttonText = config.buttonText || "Claim BOGO Offer";
    var buttonColor = config.buttonColor || "#111827";
    var buttonTextColor = config.buttonTextColor || "#FFFFFF";
    var badgeColor = config.badgeColor || "#ECFDF5";
    var badgeTextColor = config.badgeTextColor || "#059669";
    var showDiscountBadge = config.showDiscountBadge !== false;

    var badgeHtml = showDiscountBadge
      ? '<span class="ss-save-badge" style="background:' + badgeColor + ' !important;color:' + badgeTextColor + ' !important;border:1px solid ' + badgeColor + ' !important;">SAVE 100% OFF</span>'
      : '';

    card.innerHTML =
      '<div class="ss-bundle-header">' +
        '<div class="ss-bundle-title-wrap">' +
          '<span class="ss-box-icon">🎁</span>' +
          '<span class="ss-main-title">' + escapeHtml(headerTitle) + '</span>' +
        '</div>' +
        badgeHtml +
      '</div>' +

      '<div class="ss-bundle-subtitle">' + escapeHtml(bundleName) + '</div>' +

      '<div class="ss-items-container">' +
        '<div class="ss-item-row">' +
          '<div class="ss-checkbox-circle" style="background:#1F2937;">' +
            '<svg viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>' +
          '</div>' +
          deadStockImgHtml +
          '<div class="ss-item-text">' +
            '<div class="ss-item-name">' + escapeHtml(deadStockTitle) + '</div>' +
            '<div class="ss-item-sub-primary">Current item</div>' +
          '</div>' +
        '</div>' +

        '<div class="ss-plus-divider-wrap">' +
          '<div class="ss-plus-divider-line"></div>' +
          '<span class="ss-plus-badge ss-bogo-plus-badge">+ GET 1 FREE</span>' +
        '</div>' +

        '<div class="ss-item-row">' +
          '<div class="ss-checkbox-circle" style="background:#059669;">' +
            '<svg viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>' +
          '</div>' +
          freeImgHtml +
          '<div class="ss-item-text">' +
            '<div class="ss-item-name">' + escapeHtml(freeProductTitle) + '</div>' +
            '<div class="ss-item-sub-companion" style="color:#059669;font-weight:700;font-size:13px;">🎁 Buy One Get One Free</div>' +
          '</div>' +
          (formattedFreeOrigPrice ? '<div style="margin-left:auto;text-align:right;"><span style="font-size:13px;font-weight:800;color:#059669;">FREE</span><span style="font-size:11px;color:#9CA3AF;text-decoration:line-through;margin-left:4px;">' + formattedFreeOrigPrice + '</span></div>' : '') +
        '</div>' +
      '</div>' +

      '<div class="ss-price-block">' +
        '<div class="ss-price-label">BUNDLE PRICE</div>' +
        '<div class="ss-price-row">' +
          '<div class="ss-price-left">' +
            '<span class="ss-price-current">' + formattedDeadStockPrice + '</span>' +
            (formattedFreeOrigPrice ? '<span class="ss-price-orig">' + formatMoney(deadStockPrice + freePrice, currency, moneyFormat) + '</span>' : '') +
          '</div>' +
          (formattedSavings ? '<span class="ss-savings-badge" style="background:#ECFDF5;color:#059669;">Save ' + formattedSavings + '</span>' : '') +
        '</div>' +
      '</div>' +

      '<button type="button" class="ss-add-btn ss-bogo-btn" style="background:' + buttonColor + ' !important;color:' + buttonTextColor + ' !important;border-radius:' + Math.min(borderRadius, 8) + 'px !important;">' +
        '<span>⚡ ' + escapeHtml(buttonText) + ' · ' + formattedDeadStockPrice + '</span>' +
      '</button>' +

      '<div class="ss-error-banner" style="display:none;">' +
        '<span class="ss-error-icon">⚠️</span>' +
        '<span class="ss-error-text"></span>' +
      '</div>';

    var btn = card.querySelector(".ss-add-btn");
    var errorBanner = card.querySelector(".ss-error-banner");
    var errorText = card.querySelector(".ss-error-text");

    btn.addEventListener("click", function () {
      handleBuyBundle(btn, bundle, currentVariantId, errorBanner, errorText);
    });

    container.appendChild(card);
  }

  function renderNormalBundle(bundle, currency, moneyFormat, currentVariantId, container, config) {
    config = config || {};
    var pageTitle = getPageProductTitle();
    var card = document.createElement("div");
    card.className = "ss-bundle-card";

    var borderRadius = Number(config.borderRadius) || 12;
    card.style.borderRadius = borderRadius + "px";

    var deadStockTitle =
      (!isPlaceholderText(bundle.deadStockTitle) ? bundle.deadStockTitle : "") ||
      pageTitle ||
      bundle.deadStockVariantTitle ||
      "";

    var companionTitle =
      (!isPlaceholderText(bundle.companionTitle) ? bundle.companionTitle : "") ||
      bundle.companionVariantTitle ||
      "";

    if (!deadStockTitle || deadStockTitle === "Product unavailable" || !companionTitle || companionTitle === "Product unavailable") {
      return;
    }

    var deadStockImgHtml = renderProductImageHtml(bundle.deadStockImage, deadStockTitle);
    var companionImgHtml = renderProductImageHtml(bundle.companionImage, companionTitle);
    var discountPercent = bundle.discountPercent || bundle.discountPercentage || 10;

    var bundleName = bundle.name || bundle.bundleName || (deadStockTitle + " + " + companionTitle + " Bundle");

    var origPrice = Number(bundle.originalPrice || 0);
    var finalPrice = Number(bundle.bundlePrice || (origPrice > 0 ? origPrice * (1 - discountPercent / 100) : 0));
    var savings = Number(bundle.savings || Math.max(0, origPrice - finalPrice));

    var formattedFinalPrice = formatMoney(finalPrice, currency, moneyFormat);
    var formattedOrigPrice = origPrice > 0 ? formatMoney(origPrice, currency, moneyFormat) : "";
    var formattedSavings = savings > 0 ? formatMoney(savings, currency, moneyFormat) : "";

    var headerTitle = config.headerTitle || "Frequently Bought Together";
    var buttonText = config.buttonText || "Add Both to Cart";
    var buttonColor = config.buttonColor || "#111827";
    var buttonTextColor = config.buttonTextColor || "#FFFFFF";
    var badgeColor = config.badgeColor || "#DCFCE7";
    var badgeTextColor = config.badgeTextColor || "#15803D";
    var showDiscountBadge = config.showDiscountBadge !== false;

    var badgeHtml = showDiscountBadge
      ? '<span class="ss-save-badge" style="background:' + badgeColor + ' !important;color:' + badgeTextColor + ' !important;border:1px solid ' + badgeColor + ' !important;">SAVE ' + discountPercent + '% OFF</span>'
      : '';

    card.innerHTML = 
      '<div class="ss-bundle-header">' +
        '<div class="ss-bundle-title-wrap">' +
          '<span class="ss-box-icon">📦</span>' +
          '<span class="ss-main-title">' + escapeHtml(headerTitle) + '</span>' +
        '</div>' +
        badgeHtml +
      '</div>' +

      '<div class="ss-bundle-subtitle">' + escapeHtml(bundleName) + '</div>' +

      '<div class="ss-items-container">' +
        '<div class="ss-item-row">' +
          '<div class="ss-checkbox-circle">' +
            '<svg viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>' +
          '</div>' +
          deadStockImgHtml +
          '<div class="ss-item-text">' +
            '<div class="ss-item-name">' + escapeHtml(deadStockTitle) + '</div>' +
            '<div class="ss-item-sub-primary">Current item</div>' +
          '</div>' +
        '</div>' +

        '<div class="ss-plus-divider-wrap">' +
          '<div class="ss-plus-divider-line"></div>' +
          '<span class="ss-plus-badge">+</span>' +
        '</div>' +

        '<div class="ss-item-row">' +
          '<div class="ss-checkbox-circle">' +
            '<svg viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>' +
          '</div>' +
          companionImgHtml +
          '<div class="ss-item-text">' +
            '<div class="ss-item-name">' + escapeHtml(companionTitle) + '</div>' +
            '<div class="ss-item-sub-companion">Recommended companion</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ss-price-block">' +
        '<div class="ss-price-label">BUNDLE PRICE</div>' +
        '<div class="ss-price-row">' +
          '<div class="ss-price-left">' +
            '<span class="ss-price-current">' + formattedFinalPrice + '</span>' +
            (formattedOrigPrice ? '<span class="ss-price-orig">' + formattedOrigPrice + '</span>' : '') +
          '</div>' +
          (formattedSavings ? '<span class="ss-savings-badge">Save ' + formattedSavings + '</span>' : '') +
        '</div>' +
      '</div>' +

      '<button type="button" class="ss-add-btn" style="background:' + buttonColor + ' !important;color:' + buttonTextColor + ' !important;border-radius:' + Math.min(borderRadius, 8) + 'px !important;">' +
        '<span>⚡ ' + escapeHtml(buttonText) + ' · ' + formattedFinalPrice + '</span>' +
      '</button>' +

      '<div class="ss-error-banner" style="display:none;">' +
        '<span class="ss-error-icon">⚠️</span>' +
        '<span class="ss-error-text"></span>' +
      '</div>';

    var btn = card.querySelector(".ss-add-btn");
    var errorBanner = card.querySelector(".ss-error-banner");
    var errorText = card.querySelector(".ss-error-text");

    btn.addEventListener("click", function () {
      handleBuyBundle(btn, bundle, currentVariantId, errorBanner, errorText);
    });

    container.appendChild(card);
  }

  async function handleBuyBundle(button, bundle, currentVariantId, errorBanner, errorText) {
    var originalHtml = button.innerHTML;

    function showError(msg) {
      if (errorBanner && errorText) {
        errorText.innerText = msg;
        errorBanner.style.display = "flex";
      }
      button.disabled = false;
      button.innerHTML = originalHtml;
    }

    if (errorBanner) {
      errorBanner.style.display = "none";
    }

    try {
      button.disabled = true;
      var isBOGO = String(bundle.offerType || "").trim().toUpperCase() === "BOGO";

      button.innerHTML = isBOGO ? "<span>Adding Free Gift Offer...</span>" : "<span>Adding Both to Cart...</span>";

      var var1 = Number(String(bundle.deadStockVariantId || "").replace(/\D/g, ""));
      if (!var1) {
        var1 = Number(String(currentVariantId || "").replace(/\D/g, ""));
      }

      var targetFreeVarId = bundle.freeProductVariantId || bundle.companionVariantId;
      var targetFreeProdId = bundle.freeProductId || bundle.companionProductId;

      var var2 = Number(String(targetFreeVarId || "").replace(/\D/g, ""));
      if (!var2 && targetFreeProdId) {
        var2 = await resolveVariantIdForProduct(targetFreeProdId);
      }

      var standaloneVar = bundle.shopifyVariantId ? Number(String(bundle.shopifyVariantId).replace(/\D/g, "")) : 0;

      if (!var1 && !var2 && !standaloneVar) {
        throw new Error("Cannot find variant");
      }

      var currentCartItems = [];
      try {
        var cartRes = await fetch("/cart.js", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          credentials: "same-origin"
        });
        if (cartRes.ok) {
          var cartData = await cartRes.json();
          currentCartItems = Array.isArray(cartData.items) ? cartData.items : [];
        }
      } catch (e) {}

      var cartQuantities = {};
      currentCartItems.forEach(function (item) {
        var vid = Number(item.variant_id || item.id);
        if (vid) {
          cartQuantities[vid] = (cartQuantities[vid] || 0) + Number(item.quantity || 0);
        }
      });

      var itemsToAdd = [];
      var bundleTag = isBOGO
        ? "Buy One Get One Free"
        : (bundle.name || bundle.bundleName || "Frequently Bought Together");

      if (var1 && var2) {
        var qty1 = cartQuantities[var1] || 0;
        var qty2 = cartQuantities[var2] || 0;

        if (qty1 > 0 && qty2 === 0) {
          itemsToAdd.push({ id: var2, quantity: 1, properties: { _bundle: bundleTag, _offer: isBOGO ? "BOGO_FREE_GIFT" : "BUNDLE" } });
        } else if (qty2 > 0 && qty1 === 0) {
          itemsToAdd.push({ id: var1, quantity: 1, properties: { _bundle: bundleTag } });
        } else {
          itemsToAdd.push({ id: var1, quantity: 1, properties: { _bundle: bundleTag } });
          itemsToAdd.push({ id: var2, quantity: 1, properties: { _bundle: bundleTag, _offer: isBOGO ? "BOGO_FREE_GIFT" : "BUNDLE" } });
        }
      } else if (standaloneVar) {
        itemsToAdd.push({ id: standaloneVar, quantity: 1 });
      } else if (var1) {
        itemsToAdd.push({ id: var1, quantity: 1, properties: { _bundle: bundleTag } });
      } else if (var2) {
        itemsToAdd.push({ id: var2, quantity: 1, properties: { _bundle: bundleTag, _offer: isBOGO ? "BOGO_FREE_GIFT" : "BUNDLE" } });
      }

      if (itemsToAdd.length === 0) {
        throw new Error("Cannot find variant");
      }

      var response = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: itemsToAdd })
      });

      if (!response.ok) {
        var errJson = await response.json().catch(function () { return {}; });
        throw new Error(errJson.description || errJson.message || "Cannot find variant");
      }

      button.innerHTML = isBOGO ? "<span>✓ Added Free Gift Offer!</span>" : "<span>✓ Added Both to Cart!</span>";

      try {
        document.dispatchEvent(new CustomEvent("cart:updated"));
        document.dispatchEvent(new CustomEvent("cart:refresh"));
      } catch (ev) {}

      setTimeout(function () {
        window.location.href = "/cart";
      }, 400);
    } catch (err) {
      console.error("[SmartStockBundle] Error:", err);
      showError(err.message || "Cannot find variant");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBundleWidgets);
  } else {
    initBundleWidgets();
  }
})();
