/**
 * SMART STOCK — FINAL UNIVERSAL NEW PRODUCT LAUNCH + PRE-ORDER STOREFRONT ENGINE
 * One Single Unified Card | Dynamic Variant & Quantity | 50% Deposit Payment | Production Ready
 */
(function () {
  "use strict";

  try {
    var origWarn = console.warn;
    if (origWarn && !console.__ss_silence_patched) {
      console.__ss_silence_patched = true;
      console.warn = function() {
        var msg = "";
        for (var i = 0; i < arguments.length; i++) {
          try {
            var it = arguments[i];
            msg += " " + (typeof it === "object" ? (it && it.message ? it.message : JSON.stringify(it)) : String(it));
          } catch (_) {
            msg += " " + String(arguments[i]);
          }
        }
        if (
          msg.indexOf("deprecated parameters") !== -1 ||
          msg.indexOf("initialization function") !== -1 ||
          msg.indexOf("pass a single object instead") !== -1 ||
          msg.indexOf("preloaded using link preload") !== -1
        ) {
          return;
        }
        return origWarn.apply(console, arguments);
      };
    }
  } catch (_) {}

  if (window.__smartStockLaunchPreOrderRunning) {
    return;
  }
  window.__smartStockLaunchPreOrderRunning = true;

  var CARD_CLASS = "smart-stock-launch-card";
  var HIDDEN_ATTR = "data-smart-stock-launch-hidden";

  var currentProductData = null;
  var currentConfig = null;
  var currentShop = "";
  var currentProductId = "";
  var currentVariantId = "";
  var currentCurrency = "USD";
  var currentMoneyFormat = "${{amount}}";

  function formatDateLocale(dateStr) {
    if (!dateStr) return "";
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(d);
    } catch (_) {
      return dateStr;
    }
  }

  function getProductJsonFromPage() {
    if (window.SmartStockProduct && typeof window.SmartStockProduct === "object") {
      return window.SmartStockProduct;
    }
    var jsonTag = document.querySelector(".smart-stock-product-json");
    if (jsonTag) {
      try {
        var parsed = JSON.parse(jsonTag.textContent || "{}");
        if (parsed && parsed.id) return parsed;
      } catch (_) {}
    }
    var themeJson = document.querySelector('[id*="ProductJson-"], [data-product-json]');
    if (themeJson) {
      try {
        var p = JSON.parse(themeJson.textContent || "{}");
        if (p && p.id) return p;
      } catch (_) {}
    }
    return null;
  }

  function getShopDomain() {
    var blockRoot = document.querySelector("[data-smart-stock-launch-preorder]");
    if (blockRoot && blockRoot.getAttribute("data-shop")) {
      return blockRoot.getAttribute("data-shop").trim();
    }
    if (window.SmartStockEmbedConfig && window.SmartStockEmbedConfig.shop) {
      return window.SmartStockEmbedConfig.shop.trim();
    }
    if (window.SmartStockContext && window.SmartStockContext.shop) {
      return window.SmartStockContext.shop.trim();
    }
    if (window.Shopify && window.Shopify.shop) {
      return window.Shopify.shop.trim();
    }
    var host = window.location.hostname;
    return host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }

  function resolveCurrentVariantId(form, initialVariantId) {
    if (form) {
      var idInput = form.querySelector('[name="id"]');
      if (idInput && idInput.value) {
        return String(idInput.value).trim();
      }
    }
    var checkedRadio = document.querySelector(
      'form[action*="/cart/add"] input[type="radio"][name="id"]:checked, input[type="radio"][name="id"]:checked'
    );
    if (checkedRadio && checkedRadio.value) {
      return String(checkedRadio.value).trim();
    }
    var globalIdInput = document.querySelector(
      'form[action*="/cart/add"] [name="id"], [name="id"], select[name="id"]'
    );
    if (globalIdInput && globalIdInput.value) {
      return String(globalIdInput.value).trim();
    }
    var urlParams = new URLSearchParams(window.location.search);
    var variantInUrl = urlParams.get("variant");
    if (variantInUrl) {
      return String(variantInUrl).trim();
    }
    return String(initialVariantId || "").trim();
  }

  function getSelectedQuantity(form) {
    if (form) {
      var qtyInput = form.querySelector('[name="quantity"], input.quantity__input');
      if (qtyInput && qtyInput.value) {
        var num = parseInt(qtyInput.value, 10);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    var globalQty = document.querySelector(
      'form[action*="/cart/add"] [name="quantity"], input.quantity__input, [name="quantity"]'
    );
    if (globalQty && globalQty.value) {
      var gNum = parseInt(globalQty.value, 10);
      if (!isNaN(gNum) && gNum > 0) return gNum;
    }
    return 1;
  }

  function parseVariantPriceCents(rawPrice) {
    if (rawPrice === null || rawPrice === undefined) return 0;
    if (typeof rawPrice === "number") {
      if (Number.isInteger(rawPrice)) {
        return rawPrice;
      }
      return Math.round(rawPrice * 100);
    }
    var str = String(rawPrice).trim();
    if (str.includes(".")) {
      var f = parseFloat(str);
      return isNaN(f) ? 0 : Math.round(f * 100);
    }
    var n = parseInt(str, 10);
    return isNaN(n) ? 0 : n;
  }

  function getVariantPriceCents(variantId) {
    // 1. Source of Truth: Shopify Variant Data from product JSON
    if (currentProductData && currentProductData.variants && currentProductData.variants.length > 0) {
      var found = currentProductData.variants.find(function (v) {
        return String(v.id) === String(variantId);
      });
      if (!found && currentProductData.variants.length > 0) {
        found = currentProductData.variants[0];
      }
      if (found && typeof found.price !== "undefined") {
        return parseVariantPriceCents(found.price);
      }
    }

    // 2. Liquid root element default price
    var blockRoot = document.querySelector("[data-smart-stock-launch-preorder]");
    if (blockRoot && blockRoot.getAttribute("data-selected-variant-price")) {
      var rootPrice = parseVariantPriceCents(blockRoot.getAttribute("data-selected-variant-price"));
      if (rootPrice > 0) return rootPrice;
    }

    // 3. Fallback to DOM price item
    var priceEl = document.querySelector(
      ".price__regular .price-item--regular, .price-item--sale, .product__price, [data-product-price], .price"
    );
    if (priceEl) {
      var txt = priceEl.textContent || "";
      var numericMatch = txt.replace(/[^0-9.]/g, "");
      var parsed = parseFloat(numericMatch);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.round(parsed * 100);
      }
    }

    return 0;
  }

  function formatMoney(cents) {
    if (typeof cents !== "number" || isNaN(cents)) cents = 0;
    var dollars = (cents / 100).toFixed(2);

    if (window.Shopify && typeof window.Shopify.formatMoney === "function") {
      try {
        return window.Shopify.formatMoney(cents, currentMoneyFormat);
      } catch (_) {}
    }

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currentCurrency || "USD",
      }).format(cents / 100);
    } catch (_) {
      return "$" + dollars;
    }
  }

  async function fetchLaunchConfig(shop, productId, handle, variantId) {
    var cleanProductId = String(productId || "").replace(/^gid:\/\/shopify\/Product\//, "").trim();
    var cleanVarId = String(variantId || "").replace(/^gid:\/\/shopify\/ProductVariant\//, "").trim();
    var cleanHandle = String(handle || "").trim();

    var cacheKey = "ss_preorder_" + shop + "_" + cleanProductId + "_" + cleanVarId;
    try {
      var raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        var cached = JSON.parse(raw);
        if (cached && typeof cached.enabled !== "undefined") {
          return cached;
        }
      }
    } catch (_) {}

    var ts = Date.now();
    var queryParams = "shop=" + encodeURIComponent(shop) +
      "&productId=" + encodeURIComponent(cleanProductId) +
      "&handle=" + encodeURIComponent(cleanHandle) +
      "&variantId=" + encodeURIComponent(cleanVarId) +
      "&_t=" + ts;

    var endpoints = [
      "/apps/smart-stock/launch-pre-order?" + queryParams,
      "/apps/smart-stock/pre-order?" + queryParams,
      "/api/storefront/launch-pre-order?" + queryParams,
      "/api/storefront/pre-order?" + queryParams,
    ];

    for (var i = 0; i < endpoints.length; i++) {
      try {
        var res = await fetch(endpoints[i], {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          var data = await res.json();
          if (data && typeof data.enabled !== "undefined") {
            try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (_) {}
            return data;
          }
        }
      } catch (_) {}
    }
    return { enabled: false };
  }

  function cleanupLaunchElements() {
    var cards = document.querySelectorAll("." + CARD_CLASS);
    for (var j = 0; j < cards.length; j++) {
      cards[j].remove();
    }

    // Restore any hidden default theme submit and buy-it-now buttons
    var hiddenElements = document.querySelectorAll("[" + HIDDEN_ATTR + "='true']");
    for (var m = 0; m < hiddenElements.length; m++) {
      hiddenElements[m].style.display = "";
      hiddenElements[m].removeAttribute(HIDDEN_ATTR);
    }
  }

  function updatePaymentCalculations(form, initialVariantId) {
    if (!currentConfig || !currentConfig.enabled) return;

    var variantId = resolveCurrentVariantId(form, initialVariantId);
    var quantity = getSelectedQuantity(form);
    var unitPriceCents = getVariantPriceCents(variantId);

    var depositPct =
      typeof currentConfig.depositPercentage === "number" && currentConfig.depositPercentage >= 0
        ? currentConfig.depositPercentage
        : 50;
    var depositAmountCents = Number(currentConfig.depositAmount) > 0 ? Math.round(Number(currentConfig.depositAmount) * 100) : 0;

    var totalCents = unitPriceCents * quantity;
    var isDepositEnabled = currentConfig.depositEnabled !== false;
    var depositCents = totalCents;

    if (isDepositEnabled) {
      if (depositPct > 0) {
        depositCents = Math.round(totalCents * (depositPct / 100));
      } else if (depositAmountCents > 0) {
        depositCents = Math.min(totalCents, depositAmountCents * quantity);
      }
    }
    var remainingCents = Math.max(0, totalCents - depositCents);

    var totalEl = document.querySelector("[data-smart-stock-total-price]");
    var depositEl = document.querySelector("[data-smart-stock-deposit-price]");
    var remainingEl = document.querySelector("[data-smart-stock-remaining-price]");
    var ctaAmountEl = document.querySelector("[data-smart-stock-cta-amount]");

    if (totalEl) totalEl.textContent = formatMoney(totalCents);
    if (depositEl) depositEl.textContent = formatMoney(depositCents);
    if (remainingEl) remainingEl.textContent = formatMoney(remainingCents);
    if (ctaAmountEl) ctaAmountEl.textContent = " · PAY " + formatMoney(depositCents);
  }

  function renderLaunchPreOrder(shop, productId, initialVariantId, config) {
    cleanupLaunchElements();

    if (!config || !config.enabled) {
      return;
    }

    var now = new Date();
    var launchDate = config.launchDate ? new Date(config.launchDate) : null;
    if (launchDate && !isNaN(launchDate.getTime())) {
      if (launchDate.getUTCHours() === 0 && launchDate.getUTCMinutes() === 0 && launchDate.getUTCSeconds() === 0) {
        launchDate.setUTCHours(23, 59, 59, 999);
      }
    }
    var opensAt = config.preOrderOpensAt ? new Date(config.preOrderOpensAt) : null;

    var isPreOrderActive =
      config.preOrderEnabled !== false &&
      launchDate &&
      !isNaN(launchDate.getTime()) &&
      now <= launchDate &&
      (!opensAt || isNaN(opensAt.getTime()) || now >= opensAt);

    if (!isPreOrderActive) {
      return;
    }

    var badgeText = config.badgeText || "🛒 PRE-ORDER";
    var launchLabel = config.launchLabel || "NEW LAUNCH";
    var launchTitle = config.launchTitle || "New Product Launch";
    var buttonText = config.buttonText || "PRE-ORDER NOW";
    var formattedLaunchDate = formatDateLocale(config.launchDate);
    var formattedShippingDate = formatDateLocale(config.shippingDate);
    var customerMessage = config.customerMessage || "Be the first to get the new product.";
    var launchDetails = config.launchDetails || "";

    var depositPct =
      typeof config.depositPercentage === "number" && config.depositPercentage >= 0
        ? config.depositPercentage
        : 50;
    var depositAmountCents = Number(config.depositAmount) > 0 ? Math.round(Number(config.depositAmount) * 100) : 0;

    var form = document.querySelector('form[action*="/cart/add"], product-form form, .product-form form, .product-form');
    var variantId = resolveCurrentVariantId(form, initialVariantId);
    var quantity = getSelectedQuantity(form);
    var unitPriceCents = getVariantPriceCents(variantId);
    var totalCents = unitPriceCents * quantity;

    var isDepositEnabled = config.depositEnabled !== false;
    var depositCents = totalCents;
    if (isDepositEnabled) {
      if (depositPct > 0) {
        depositCents = Math.round(totalCents * (depositPct / 100));
      } else if (depositAmountCents > 0) {
        depositCents = Math.min(totalCents, depositAmountCents * quantity);
      }
    }
    var remainingCents = Math.max(0, totalCents - depositCents);

    // ----------------------------------------------------
    // BUILD ONE SINGLE UNIFIED NEW PRODUCT LAUNCH CARD
    // ----------------------------------------------------
    var cardEl = document.createElement("div");
    cardEl.className = CARD_CLASS;

    if (config.cardBackgroundColor) {
      cardEl.style.setProperty("background-color", config.cardBackgroundColor, "important");
    }
    if (config.borderColor) {
      cardEl.style.setProperty("border-color", config.borderColor, "important");
    }
    if (config.textColor) {
      cardEl.style.setProperty("color", config.textColor, "important");
    }
    if (config.borderRadius !== undefined) {
      cardEl.style.setProperty("border-radius", config.borderRadius + "px", "important");
    }

    // Badges
    var badgesHtml = "";
    if (badgeText || launchLabel) {
      badgesHtml += '<div class="smart-stock-launch-card__badges">';
      if (badgeText) {
        var badgeStyle = "";
        if (config.badgeBackgroundColor) badgeStyle += "background-color:" + config.badgeBackgroundColor + " !important; background:" + config.badgeBackgroundColor + " !important;";
        if (config.badgeTextColor) badgeStyle += "color:" + config.badgeTextColor + " !important;";
        badgesHtml += '<span class="smart-stock-badge-primary"' + (badgeStyle ? ' style="' + badgeStyle + '"' : '') + '>' + escapeHtml(badgeText) + "</span>";
      }
      if (launchLabel) {
        var secBadgeStyle = config.accentColor ? ' style="background-color:' + config.accentColor + ' !important; background:' + config.accentColor + ' !important; color:#ffffff !important;"' : "";
        badgesHtml += '<span class="smart-stock-badge-secondary"' + secBadgeStyle + '>' + escapeHtml(launchLabel) + "</span>";
      }
      badgesHtml += "</div>";
    }

    var titleStyle = config.textColor ? ' style="color:' + config.textColor + ' !important;"' : "";
    var cardHeaderHtml =
      '<div class="smart-stock-launch-card__header">' +
      '<div class="smart-stock-launch-card__title-group">' +
      '<span class="smart-stock-launch-card__title"' + titleStyle + '>🚀 ' + escapeHtml(launchTitle) + "</span>" +
      "</div>" +
      badgesHtml +
      "</div>";

    // 2-Column Schedule
    var dateBoxStyle = config.borderColor ? ' style="border-color:' + config.borderColor + ' !important;"' : "";
    var dateValStyle = config.textColor ? ' style="color:' + config.textColor + ' !important;"' : "";
    var dateBoxesHtml = "";
    if (formattedLaunchDate) {
      dateBoxesHtml +=
        '<div class="smart-stock-launch-card__date-box"' + dateBoxStyle + '>' +
        '<span class="smart-stock-launch-card__date-label">📅 Launch Date</span>' +
        '<span class="smart-stock-launch-card__date-value"' + dateValStyle + '>' + escapeHtml(formattedLaunchDate) + "</span>" +
        "</div>";
    }

    if (formattedShippingDate) {
      dateBoxesHtml +=
        '<div class="smart-stock-launch-card__date-box"' + dateBoxStyle + '>' +
        '<span class="smart-stock-launch-card__date-label">📦 Shipping Starts</span>' +
        '<span class="smart-stock-launch-card__date-value"' + dateValStyle + '>' + escapeHtml(formattedShippingDate) + "</span>" +
        "</div>";
    }

    var gridHtml = "";
    if (dateBoxesHtml) {
      gridHtml = '<div class="smart-stock-launch-card__grid">' + dateBoxesHtml + "</div>";
    }

    // Customer message
    var msgStyle = config.accentColor ? ' style="border-left-color:' + config.accentColor + ' !important;"' : "";
    var messageHtml = "";
    if (customerMessage) {
      messageHtml = '<div class="smart-stock-launch-card__message"' + msgStyle + '>✨ ' + escapeHtml(customerMessage) + "</div>";
    }

    // Details note if any
    var detailsHtml = "";
    if (launchDetails) {
      detailsHtml = '<div style="font-size:11px;color:#64748b;font-style:italic;margin-bottom:12px;">' + escapeHtml(launchDetails) + "</div>";
    }

    // Divider
    var dividerHtml = '<hr class="smart-stock-launch-divider" />';

    // Pre-Order Payment Breakdown Section
    var pctBadgeStyle = config.accentColor ? ' style="background-color:' + config.accentColor + ' !important; background:' + config.accentColor + ' !important; color:#ffffff !important;"' : "";
    var payNowRowStyle = config.accentColor ? ' style="color:' + config.accentColor + ' !important;"' : "";
    var depositBadgeLabel = depositPct > 0 ? depositPct + '% DEPOSIT' : (depositAmountCents > 0 ? formatMoney(depositAmountCents) + ' DEPOSIT' : 'DEPOSIT');
    var payNowLabel = depositPct > 0 ? 'Pay Now (' + depositPct + '%)' : 'Pay Now (Deposit)';
    var remainingLabel = depositPct > 0 ? 'Remaining Balance (' + (100 - depositPct) + '%)' : 'Remaining Balance';
    var helperText = depositPct > 0
      ? '💡 Pay ' + depositPct + '% now to secure your pre-order. Remaining ' + (100 - depositPct) + '% will be due before shipping.'
      : '💡 Pay ' + formatMoney(depositCents) + ' now to secure your pre-order. Remaining balance will be due before shipping.';

    var paymentSectionHtml =
      '<div class="smart-stock-payment-section">' +
      '<div class="smart-stock-payment-header">' +
      '<span class="smart-stock-payment-title">PRE-ORDER PAYMENT</span>' +
      '<span class="smart-stock-payment-pct-badge"' + pctBadgeStyle + '>' + depositBadgeLabel + '</span>' +
      '</div>' +
      '<div class="smart-stock-payment-row">' +
      '<span>Total Product Price</span>' +
      '<strong data-smart-stock-total-price>' + formatMoney(totalCents) + '</strong>' +
      '</div>' +
      '<div class="smart-stock-payment-row smart-stock-pay-now-row"' + payNowRowStyle + '>' +
      '<span>' + payNowLabel + '</span>' +
      '<strong data-smart-stock-deposit-price>' + formatMoney(depositCents) + '</strong>' +
      '</div>' +
      '<div class="smart-stock-payment-row">' +
      '<span>' + remainingLabel + '</span>' +
      '<strong data-smart-stock-remaining-price>' + formatMoney(remainingCents) + '</strong>' +
      '</div>' +
      '<div class="smart-stock-payment-helper">' +
      helperText +
      '</div>' +
      '</div>';

    // Pre-Order CTA Button (Inside the same card)
    var btnStyle = "";
    if (config.accentColor) {
      btnStyle += "background-color:" + config.accentColor + " !important; background:" + config.accentColor + " !important;";
    }
    if (config.borderRadius !== undefined) {
      btnStyle += "border-radius:" + Math.min(16, config.borderRadius) + "px !important;";
    }
    var btnStyleAttr = btnStyle ? ' style="' + btnStyle + '"' : "";
    var ctaHtml =
      '<button type="button" class="smart-stock-launch-cta-btn" data-smart-stock-launch-cta' + btnStyleAttr + '>' +
      '<span class="ss-btn-text">🛒 ' + escapeHtml(buttonText) + '<span data-smart-stock-cta-amount> · PAY ' + formatMoney(depositCents) + '</span></span>' +
      '</button>' +
      '<div class="smart-stock-feedback" style="display:none;"></div>';

    cardEl.innerHTML =
      cardHeaderHtml +
      gridHtml +
      messageHtml +
      detailsHtml +
      dividerHtml +
      paymentSectionHtml +
      ctaHtml;

    // ----------------------------------------------------
    // HIDE THEME BUY BUTTONS & INSERT UNIFIED CARD BELOW QUANTITY
    // ----------------------------------------------------
    var submitBtns = document.querySelectorAll(
      'form[action*="/cart/add"] [type="submit"]:not(.smart-stock-launch-cta-btn), form[action*="/cart/add"] .product-form__submit:not(.smart-stock-launch-cta-btn), form[action*="/cart/add"] [name="add"]:not(.smart-stock-launch-cta-btn), .product-form__buttons [type="submit"]:not(.smart-stock-launch-cta-btn), .product-form__buttons button:not(.smart-stock-launch-cta-btn)'
    );

    var buyItNowButtons = document.querySelectorAll(
      '.shopify-payment-button, [data-shopify="payment-button"], .shopify-payment-button__button, [data-testid="Checkout-button"], form[action*="/cart/add"] .shopify-payment-terms'
    );
    for (var b = 0; b < buyItNowButtons.length; b++) {
      buyItNowButtons[b].style.display = "none";
      buyItNowButtons[b].setAttribute(HIDDEN_ATTR, "true");
    }

    var primarySubmit = submitBtns[0];
    if (primarySubmit && primarySubmit.parentNode) {
      for (var s = 0; s < submitBtns.length; s++) {
        submitBtns[s].style.display = "none";
        submitBtns[s].setAttribute(HIDDEN_ATTR, "true");
      }
      primarySubmit.parentNode.insertBefore(cardEl, primarySubmit);
    } else if (form) {
      form.appendChild(cardEl);
    } else {
      var qtyContainer = document.querySelector('.quantity, .product-form__quantity, [id*="quantity"]');
      if (qtyContainer && qtyContainer.parentNode) {
        qtyContainer.parentNode.insertBefore(cardEl, qtyContainer.nextSibling);
      } else {
        var mainContainer = document.querySelector('.product__info-container, .product-single__meta, .product-details');
        if (mainContainer) {
          mainContainer.appendChild(cardEl);
        }
      }
    }

    // ----------------------------------------------------
    // ATTACH REAL PRE-ORDER CART SUBMISSION
    // ----------------------------------------------------
    var ctaBtn = cardEl.querySelector("[data-smart-stock-launch-cta]");
    var feedbackEl = cardEl.querySelector(".smart-stock-feedback");

    if (ctaBtn) {
      ctaBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        var activeForm = ctaBtn.closest("form") || document.querySelector('form[action*="/cart/add"]');
        var activeVariantId = resolveCurrentVariantId(activeForm, initialVariantId);
        var activeQty = getSelectedQuantity(activeForm);
        var activeUnitPriceCents = getVariantPriceCents(activeVariantId);
        var activeTotalCents = activeUnitPriceCents * activeQty;
        var activeDepositCents = activeTotalCents;
        if (isDepositEnabled) {
          if (depositPct > 0) {
            activeDepositCents = Math.round(activeTotalCents * (depositPct / 100));
          } else if (depositAmountCents > 0) {
            activeDepositCents = Math.min(activeTotalCents, depositAmountCents * activeQty);
          }
        }
        var activeRemainingCents = Math.max(0, activeTotalCents - activeDepositCents);

        if (!activeVariantId) {
          showFeedback(feedbackEl, "Please select a product option.", false);
          return;
        }

        ctaBtn.disabled = true;
        ctaBtn.classList.add("ss-loading");
        var originalBtnHtml = ctaBtn.querySelector(".ss-btn-text").innerHTML;
        ctaBtn.querySelector(".ss-btn-text").innerHTML = '<span class="smart-stock-spinner"></span> Adding Pre-Order...';

        var cartProperties = {
          "_preorder": "true",
          "_preorder_launch": "true",
          "_deposit_percentage": depositPct > 0 ? depositPct + "%" : "Fixed",
          "_total_price_cents": activeTotalCents,
          "_deposit_cents": activeDepositCents,
          "_remaining_cents": activeRemainingCents,
          "Pre-Order Total": formatMoney(activeTotalCents),
          "Launch Date": formattedLaunchDate,
          "Estimated Shipping": formattedShippingDate || formattedLaunchDate,
        };
        if (depositPct > 0) {
          cartProperties["Deposit Paid (" + depositPct + "%)"] = formatMoney(activeDepositCents);
        } else {
          cartProperties["Deposit Paid"] = formatMoney(activeDepositCents);
        }
        cartProperties["Remaining Balance Due"] = formatMoney(activeRemainingCents);

        var cartPayload = {
          id: activeVariantId,
          quantity: activeQty,
          properties: cartProperties,
        };

        fetch("/cart/add.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(cartPayload),
        })
          .then(function (res) {
            if (!res.ok) {
              return res.json().then(function (err) {
                throw new Error(err.description || err.message || "Failed to add pre-order item to cart.");
              });
            }
            return res.json();
          })
          .then(function (item) {
            ctaBtn.classList.remove("ss-loading");
            ctaBtn.querySelector(".ss-btn-text").innerHTML = "✓ Pre-Order Added!";
            showFeedback(feedbackEl, "Pre-order deposit added to cart!", true);

            try {
              document.documentElement.dispatchEvent(
                new CustomEvent("cart:updated", { bubbles: true, detail: { item: item } })
              );
              document.dispatchEvent(
                new CustomEvent("theme:cart:update", { bubbles: true, detail: { item: item } })
              );
              document.dispatchEvent(
                new CustomEvent("cart:refresh", { bubbles: true })
              );
              if (window.Shopify && typeof window.Shopify.onItemAdded === "function") {
                window.Shopify.onItemAdded(item);
              }
            } catch (_) {}

            setTimeout(function () {
              var cartDrawerTrigger = document.querySelector(
                '[data-cart-drawer-trigger], .cart-drawer-toggle, [aria-controls="cart-drawer"]'
              );
              if (cartDrawerTrigger) {
                cartDrawerTrigger.click();
              } else {
                window.location.href = "/cart";
              }
            }, 600);
          })
          .catch(function (err) {
            ctaBtn.disabled = false;
            ctaBtn.classList.remove("ss-loading");
            ctaBtn.querySelector(".ss-btn-text").innerHTML = originalBtnHtml;
            showFeedback(feedbackEl, err.message || "Could not add to cart. Please try again.", false);
          });
      });
    }

    attachVariantAndQtyListeners(initialVariantId);
  }

  function attachVariantAndQtyListeners(initialVariantId) {
    var triggerUpdate = function () {
      var form = document.querySelector('form[action*="/cart/add"], .product-form');
      updatePaymentCalculations(form, initialVariantId);
    };

    document.addEventListener("change", function (e) {
      if (
        e.target &&
        (e.target.name === "id" ||
          e.target.name === "quantity" ||
          e.target.matches('[name="id"], [name="quantity"], select, input[type="radio"]'))
      ) {
        triggerUpdate();
      }
    }, true);

    document.addEventListener("input", function (e) {
      if (e.target && e.target.name === "quantity") {
        triggerUpdate();
      }
    }, true);

    document.addEventListener("click", function (e) {
      if (e.target && (e.target.matches(".quantity__button, .qty-btn, [data-quantity-button]") || e.target.closest(".quantity__button, .qty-btn"))) {
        setTimeout(triggerUpdate, 60);
      }
    });

    document.addEventListener("variant:change", triggerUpdate);
    document.addEventListener("theme:variant:change", triggerUpdate);
  }

  function showFeedback(el, msg, isSuccess) {
    if (!el) return;
    el.textContent = msg;
    el.className = "smart-stock-feedback " + (isSuccess ? "ss-success" : "ss-error");
    el.style.display = "block";
    setTimeout(function () {
      if (el) el.style.display = "none";
    }, 5000);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var isInitializing = false;

  async function init() {
    if (isInitializing) return;
    isInitializing = true;

    currentShop = getShopDomain();

    var blockRoot = document.querySelector("[data-smart-stock-launch-preorder]");
    var embedConfig = window.SmartStockEmbedConfig || window.SmartStockContext || {};

    var handle = "";
    if (window.location.pathname.includes("/products/")) {
      try {
        handle = window.location.pathname.split("/products/")[1]?.split(/[/?#]/)[0] || "";
      } catch (_) {}
    }

    currentProductId =
      (blockRoot && blockRoot.getAttribute("data-product-id")) ||
      embedConfig.productId ||
      (window.SmartStockContext && window.SmartStockContext.productId) ||
      (document.querySelector("#smart-stock-high-demand") && document.querySelector("#smart-stock-high-demand").getAttribute("data-product-id")) ||
      (document.querySelector(".smart-stock-high-demand-embed") && document.querySelector(".smart-stock-high-demand-embed").getAttribute("data-product-id")) ||
      (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product && window.ShopifyAnalytics.meta.product.id) ||
      (window.meta && window.meta.product && window.meta.product.id) ||
      (window.__st && window.__st.rid) ||
      (document.querySelector("[data-product-id]") && document.querySelector("[data-product-id]").getAttribute("data-product-id")) ||
      (document.querySelector('form[action*="/cart/add"] input[name="product-id"]') && document.querySelector('form[action*="/cart/add"] input[name="product-id"]').value) ||
      "";

    currentVariantId =
      (blockRoot && blockRoot.getAttribute("data-selected-variant-id")) ||
      embedConfig.variantId ||
      (document.querySelector("#smart-stock-high-demand") && document.querySelector("#smart-stock-high-demand").getAttribute("data-variant-id")) ||
      "";

    currentCurrency =
      (blockRoot && blockRoot.getAttribute("data-currency")) ||
      embedConfig.currency ||
      (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) ||
      "USD";

    currentMoneyFormat =
      (blockRoot && blockRoot.getAttribute("data-money-format")) ||
      embedConfig.moneyFormat ||
      "${{amount}}";

    currentProductData = getProductJsonFromPage();

    if (!currentProductId && handle) {
      try {
        var pRes = await fetch("/products/" + handle + ".js", { headers: { Accept: "application/json" } });
        if (pRes.ok) {
          var pData = await pRes.json();
          if (pData && pData.id) {
            currentProductData = pData;
            currentProductId = String(pData.id);
            if (!currentVariantId && pData.variants && pData.variants.length > 0) {
              currentVariantId = String(pData.variants[0].id);
            }
          }
        }
      } catch (_) {}
    }

    if (!currentShop || (!currentProductId && !handle)) {
      isInitializing = false;
      return;
    }

    try {
      currentConfig = await fetchLaunchConfig(currentShop, currentProductId, handle, currentVariantId);
      renderLaunchPreOrder(currentShop, currentProductId, currentVariantId, currentConfig);
    } catch (_) {
      cleanupLaunchElements();
    } finally {
      isInitializing = false;
    }

    enhanceCartDisplay();
  }

  // ==================================================
  // CART & DRAWER PRE-ORDER DEPOSIT PRICE ENHANCEMENT
  // ==================================================
  var isCartEnhancing = false;
  async function enhanceCartDisplay() {
    if (isCartEnhancing) return;
    isCartEnhancing = true;
    try {
      var cartRes = await fetch("/cart.js", { headers: { Accept: "application/json" } });
      if (!cartRes.ok) return;
      var cart = await cartRes.json();
      if (!cart || !cart.items || cart.items.length === 0) return;

      var hasPreOrder = false;
      var totalPayableCents = 0;

      cart.items.forEach(function (item) {
        var props = item.properties || {};
        var isPre = props._preorder === "true" || props._preorder_launch === "true" || props["Deposit Paid"] || props["Remaining Balance Due"] || props["Pre-Order Total"];
        var depositCents = props._deposit_cents ? Number(props._deposit_cents) : null;

        if (isPre) {
          hasPreOrder = true;
          if (depositCents == null) {
            var depStr = props["Deposit Paid"] || props["Deposit Paid (0%)"] || "";
            var num = parseFloat(String(depStr).replace(/[^0-9.]/g, ""));
            depositCents = !isNaN(num) && num > 0 ? Math.round(num * 100) : item.final_line_price;
          }
          totalPayableCents += depositCents * (props._deposit_cents ? 1 : item.quantity);
        } else {
          totalPayableCents += item.final_line_price;
        }
      });

      if (!hasPreOrder) return;

      // 1. Update line item price rows in Cart & Drawer
      var cartItems = document.querySelectorAll("cart-items .cart-item, .cart-item, .cart__items tr, tr.cart-item, [data-cart-item], .cart-drawer .cart-item");
      cartItems.forEach(function (row) {
        var rowText = row.textContent || "";
        if (!rowText.includes("Deposit Paid") && !rowText.includes("Remaining Balance Due") && !rowText.includes("Pre-Order Total")) {
          return;
        }

        var match = rowText.match(/Deposit Paid[^:]*:\s*\$?([\d,]+(?:\.\d{2})?)/i);
        var depAmt = match ? match[1].replace(/,/g, "") : "";
        if (!depAmt) {
          var match2 = rowText.match(/Pre-Order Total[^:]*:\s*\$?([\d,]+(?:\.\d{2})?)/i);
          if (match2) depAmt = match2[1].replace(/,/g, "");
        }

        if (depAmt) {
          var priceContainers = row.querySelectorAll(
            ".cart-item__price-wrapper, .cart-item__totals, .cart-item__price, .price--end, [data-cart-item-line-price], .cart-item__final-price"
          );
          priceContainers.forEach(function (pEl) {
            if (pEl.getAttribute("data-smart-stock-enhanced")) return;
            pEl.setAttribute("data-smart-stock-enhanced", "true");

            var origHtml = pEl.innerHTML;
            pEl.innerHTML =
              '<div style="display:inline-flex; flex-direction:column; align-items:flex-end;">' +
              '<span style="color:#0F172A; font-weight:800; font-size:15px; display:inline-flex; align-items:center; gap:6px;">$' +
              parseFloat(depAmt).toFixed(2) +
              ' <span style="font-size:11px; background:#EEF2FF; color:#4F46E5; padding:2px 6px; border-radius:4px; font-weight:700; text-transform:uppercase;">Deposit</span></span>' +
              '<span style="font-size:12px; color:#94A3B8; text-decoration:line-through;">' +
              origHtml.replace(/<[^>]*>?/gm, "").trim() +
              '</span></div>';
          });
        }
      });

      // 2. Update Cart Subtotal & Estimated Total
      var subtotalEls = document.querySelectorAll(
        ".totals__total-value, .cart__subtotal-value, .cart-subtotal, [data-cart-subtotal], .cart__total, .cart-drawer__total, .totals__subtotal-value, .cart__footer .totals__total-value, [data-cart-total]"
      );
      subtotalEls.forEach(function (stEl) {
        if (stEl.getAttribute("data-smart-stock-subtotal-enhanced")) return;
        stEl.setAttribute("data-smart-stock-subtotal-enhanced", "true");
        var formattedDeposit = formatMoney(totalPayableCents);

        stEl.innerHTML =
          '<div style="text-align:right;">' +
          '<div style="font-size:18px; font-weight:800; color:#0F172A;">' +
          formattedDeposit +
          ' ' + currentCurrency + '</div>' +
          '<div style="font-size:11.5px; color:#64748B; font-weight:600; margin-top:2px;">Pay Now Deposit (Remaining balance due before shipping)</div>' +
          '</div>';
      });
    } catch (_) {}
    finally {
      isCartEnhancing = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  setTimeout(init, 300);
  setTimeout(init, 1000);
  setTimeout(enhanceCartDisplay, 400);
  setTimeout(enhanceCartDisplay, 1200);

  document.addEventListener("shopify:section:load", function () {
    init();
    enhanceCartDisplay();
  });
  document.addEventListener("shopify:section:select", init);
  document.addEventListener("cart:updated", enhanceCartDisplay);
  document.addEventListener("theme:cart:update", enhanceCartDisplay);
  document.addEventListener("cart:refresh", enhanceCartDisplay);
  window.addEventListener("popstate", init);
})();
