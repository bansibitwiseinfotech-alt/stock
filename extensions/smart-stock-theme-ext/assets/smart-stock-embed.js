(function () {
  "use strict";

  const config = window.SmartStockEmbedConfig;

  if (
    !config ||
    !config.shop ||
    !config.productId ||
    !config.variantId
  ) {
    return;
  }

  const state = {
    productId: String(config.productId),
    variantId: String(config.variantId),
  };


  /* =========================================================
     FORMAT MONEY
     ========================================================= */

  function formatMoney(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "";
    }

    const amount = Math.round(number * 100);

    if (
      window.Shopify &&
      typeof window.Shopify.formatMoney === "function"
    ) {
      return window.Shopify.formatMoney(
        amount,
        config.moneyFormat || "${{amount}}"
      );
    }

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: config.currency || "USD",
    }).format(number);
  }


  /* =========================================================
     HTML ESCAPE
     ========================================================= */

  function escapeHtml(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* =========================================================
     REMOVE SMART STOCK ELEMENTS
     ========================================================= */

  function removeElements() {
    document
      .querySelectorAll(
        "[data-smart-stock-feature]"
      )
      .forEach((element) => {
        element.remove();
      });

    document
      .querySelectorAll('[data-smart-stock-price-display]')
      .forEach((el) => el.remove());

    document
      .querySelectorAll('[data-smart-stock-hidden-price]')
      .forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-smart-stock-hidden-price");
      });
  }


  /* =========================================================
     CREATE FEATURE
     ========================================================= */

  function createFeature(
    type,
    className
  ) {
    const element =
      document.createElement("div");

    element.dataset.smartStockFeature =
      type;

    element.className =
      "smart-stock-embed-feature " +
      className;

    return element;
  }


  /* =========================================================
     PRODUCT FORM
     ========================================================= */

  function getProductForm() {
    return (
      document.querySelector(
        'form[action*="/cart/add"]'
      ) ||
      document.querySelector(
        ".product-form"
      ) ||
      document.querySelector(
        "product-form"
      )
    );
  }


  /* =========================================================
     BUY IT NOW
     ========================================================= */

  function getBuyItNowButton(
    productForm
  ) {
    if (!productForm) {
      return null;
    }

    const paymentWrapper =
      productForm.querySelector(
        ".shopify-payment-button"
      );

    if (paymentWrapper) {
      return paymentWrapper;
    }

    const checkoutButton =
      productForm.querySelector(
        'button[name="checkout"], input[name="checkout"]'
      );

    if (checkoutButton) {
      return (
        checkoutButton.closest(
          ".shopify-payment-button"
        ) ||
        checkoutButton
      );
    }

    const dynamicCheckout =
      productForm.querySelector(
        ".dynamic-checkout__content"
      );

    if (dynamicCheckout) {
      return dynamicCheckout;
    }

    const buttons =
      productForm.querySelectorAll(
        "button, a, input[type='submit']"
      );

    for (
      const button of buttons
    ) {
      const text = (
        button.textContent ||
        button.value ||
        ""
      )
        .trim()
        .toLowerCase();

      if (
        text.includes("buy it now") ||
        text.includes("buy now") ||
        text.includes("checkout")
      ) {
        return (
          button.closest(
            ".shopify-payment-button"
          ) ||
          button
        );
      }
    }

    return null;
  }


  /* =========================================================
     INSERT BELOW BUY IT NOW
     ========================================================= */

  function insertBelowBuyItNow(
    element,
    productForm
  ) {
    const paymentWrapper =
      (productForm && productForm.querySelector(".shopify-payment-button")) ||
      document.querySelector(".shopify-payment-button");

    if (paymentWrapper && paymentWrapper.parentNode) {
      paymentWrapper.parentNode.insertBefore(
        element,
        paymentWrapper.nextSibling
      );
      return true;
    }

    const buttonsWrapper =
      (productForm &&
        productForm.querySelector(
          ".product-form__buttons, .product__buy-buttons, .product-form__payment-container"
        )) ||
      document.querySelector(
        ".product-form__buttons, .product__buy-buttons, .product-form__payment-container"
      );

    if (buttonsWrapper && buttonsWrapper.parentNode) {
      buttonsWrapper.parentNode.insertBefore(
        element,
        buttonsWrapper.nextSibling
      );
      return true;
    }

    const buyItNow =
      getBuyItNowButton(
        productForm
      );

    if (buyItNow && buyItNow.parentNode) {
      const target =
        buyItNow.closest(".shopify-payment-button") ||
        buyItNow.closest(".product-form__buttons") ||
        buyItNow;

      if (target.parentNode) {
        target.parentNode.insertBefore(
          element,
          target.nextSibling
        );
        return true;
      }
    }

    return false;
  }


  /* =========================================================
     FALLBACK AFTER ADD TO CART
     ========================================================= */

  function insertAfterAddToCart(
    element,
    productForm
  ) {
    const addButton =
      (productForm &&
        productForm.querySelector(
          'button[name="add"], button[type="submit"], .product-form__submit'
        )) ||
      document.querySelector(
        'button[name="add"], button[type="submit"], .product-form__submit'
      );

    if (!addButton || !addButton.parentNode) {
      return false;
    }

    const buttonsWrapper =
      addButton.closest(".product-form__buttons, .product__buy-buttons");

    const target = buttonsWrapper || addButton;

    if (!target.parentNode) {
      return false;
    }

    target.parentNode.insertBefore(
      element,
      target.nextSibling
    );

    return true;
  }


  /* =========================================================
     FINAL INSERT
     ========================================================= */

  function insertClearanceElement(element) {
    const productForm = getProductForm();

    if (insertBelowBuyItNow(element, productForm)) {
      return true;
    }

    if (insertAfterAddToCart(element, productForm)) {
      return true;
    }

    if (productForm && productForm.parentNode) {
      productForm.parentNode.insertBefore(element, productForm.nextSibling);
      return true;
    }

    const infoContainer = document.querySelector(
      ".product__info-container, .product__info-wrapper, .product-single__meta, .product-info, .product-details, .product__column-sticky, [data-section-type='product']"
    );
    if (infoContainer) {
      infoContainer.appendChild(element);
      return true;
    }

    const mainContainer = document.querySelector("main, #MainContent, .main-content");
    if (mainContainer) {
      mainContainer.appendChild(element);
      return true;
    }

    return false;
  }


  /* =========================================================
     CLEARANCE SALE
     ========================================================= */

  function renderSale(data) {
    const cfg =
      data &&
      data.clearanceConfig;

    const sale =
      data &&
      data.deadStockOffer;

    if (
      cfg &&
      cfg.enabled === false
    ) {
      return;
    }

    if (
      !sale ||
      !sale.hasClearance
    ) {
      return;
    }

    document
      .querySelectorAll(
        '[data-smart-stock-feature="clearance"]'
      )
      .forEach((element) => {
        element.remove();
      });

    const element =
      createFeature(
        "clearance",
        "smart-stock-embed-clearance smart-stock-embed-inline"
      );

    const showIcon =
      cfg
        ? Boolean(cfg.showIcon)
        : true;

    const showSupp =
      cfg
        ? Boolean(
          cfg.showSupportingText
        )
        : true;

    const title =
      cfg?.badgeTitle ||
      "Clearance Sale";

    const supportingText =
      cfg?.limitedTimeText ||
      cfg?.supportingText ||
      "Limited time offer";

    const showPrice =
      cfg
        ? Boolean(cfg.showPrice)
        : true;

    const showSavings =
      cfg
        ? Boolean(cfg.showSavings)
        : true;

    const layout =
      cfg?.layout ||
      "horizontal";

    const alignment =
      cfg?.alignment ||
      "left";

    const discountPercent =
      Number(
        sale?.discountPercent ??
        sale?.discountValue ??
        cfg?.discountPercentage ??
        10
      );

    element.style.cssText = `
      box-sizing:border-box;
      display:flex;
      flex-direction:${layout === "stacked"
        ? "column"
        : "row"
      };
      align-items:${layout === "stacked"
        ? (
          alignment === "center"
            ? "center"
            : alignment === "right"
              ? "flex-end"
              : "flex-start"
        )
        : "center"
      };
      justify-content:space-between;
      text-align:${alignment};
      gap:8px;
      width:100%;
      max-width:100%;
      margin:8px 0 0 0;
      padding:
        ${cfg?.paddingTop ?? 6}px
        ${cfg?.paddingRight ?? 9}px
        ${cfg?.paddingBottom ?? 6}px
        ${cfg?.paddingLeft ?? 9}px;
      color:${cfg?.textColor || "#991B1B"};
      background-color:${cfg?.backgroundColor || "#FFF1F2"};
      border:1px solid ${cfg?.borderColor || "#FECACA"};
      border-radius:${cfg?.borderRadius ?? 6}px;
      font-family:${cfg?.fontFamily || "Arial"};
      font-size:${cfg?.fontSize || "12px"};
      font-weight:${cfg?.fontWeight || "600"};
      line-height:1.2;
      min-height:0;
    `;

    const leftHtml = `
      <div
        style="
          display:flex;
          align-items:center;
          gap:5px;
          min-width:0;
        "
      >

        ${showIcon
        ? `
              <span
                style="
                  font-size:13px;
                  line-height:1;
                  flex:0 0 auto;
                "
              >
                🏷️
              </span>
            `
        : ""
      }

        <div
          style="
            display:flex;
            flex-direction:column;
            min-width:0;
          "
        >

          <span
            style="
              font-weight:600;
              font-size:12px;
              color:${cfg?.textColor ||
      "#991B1B"
      };
            "
          >
            ${escapeHtml(title)}
          </span>

          ${showSupp &&
        layout === "stacked"
        ? `
                <span
                  style="
                    font-size:10px;
                    opacity:.8;
                  "
                >
                  ${escapeHtml(
          supportingText
        )}
                </span>
              `
        : ""
      }

        </div>

      </div>
    `;

    let rightHtml = `
      <span
        style="
          color:${cfg?.accentColor ||
      "#DC2626"
      };
          font-weight:700;
          font-size:12px;
          white-space:nowrap;
        "
      >
        🔥 ${discountPercent}% OFF
      </span>
    `;

    if (
      showSupp &&
      layout !== "stacked"
    ) {
      rightHtml += `
        <span
          style="
            font-size:10px;
            opacity:.8;
            color:${cfg?.textColor ||
        "#991B1B"
        };
            white-space:nowrap;
          "
        >
          ${escapeHtml(
          supportingText
        )}
        </span>
      `;
    }

    if (
      showPrice &&
      sale.originalPrice != null &&
      sale.salePrice != null
    ) {
      rightHtml += `
        <div
          style="
            display:flex;
            align-items:center;
            gap:4px;
            font-size:11px;
            white-space:nowrap;
          "
        >

          <span
            style="
              text-decoration:line-through;
              opacity:.65;
            "
          >
            ${formatMoney(
        sale.originalPrice
      )}
          </span>

          <strong
            style="
              color:${cfg?.accentColor ||
        "#DC2626"
        };
            "
          >
            ${formatMoney(
          sale.salePrice
        )}
          </strong>

        </div>
      `;
    }

    if (
      showSavings &&
      sale.savings != null
    ) {
      rightHtml += `
        <span
          style="
            font-size:10px;
            font-weight:700;
            color:${cfg?.accentColor ||
        "#DC2626"
        };
            white-space:nowrap;
          "
        >
          Save ${formatMoney(
          sale.savings
        )}
        </span>
      `;
    }

    element.innerHTML = `
      ${leftHtml}

      <div
        style="
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap:2px;
          min-width:0;
        "
      >
        ${rightHtml}
      </div>
    `;

    insertClearanceElement(
      element
    );

    if (sale.originalPrice && sale.salePrice && sale.originalPrice > sale.salePrice) {
      updateStorefrontProductPrice(sale.originalPrice, sale.salePrice);
    }
  }


  /* =========================================================
     UPDATE TOP STOREFRONT PRICE ON SALE / DISCOUNT
     ========================================================= */

  function updateStorefrontProductPrice(originalPrice, salePrice) {
    if (!originalPrice || !salePrice || originalPrice <= salePrice) return;

    try {
      const priceContainers = document.querySelectorAll(
        ".product__info-container .price, .product-single__meta .price, .product-info .price, .product__price, .price"
      );

      priceContainers.forEach((priceContainer) => {
        priceContainer.classList.add("price--on-sale", "price--show-badge");

        const salePriceFormatted = formatMoney(salePrice);
        const origPriceFormatted = formatMoney(originalPrice);

        // Dawn / Standard themes with .price__sale
        const regularItem = priceContainer.querySelector(".price__sale .price-item--regular, .price__sale s, s.price-item");
        const saleItem = priceContainer.querySelector(".price-item--sale, .price-item.price-item--sale, .price-item--last");

        if (regularItem) {
          regularItem.textContent = origPriceFormatted;
        }
        if (saleItem) {
          saleItem.textContent = salePriceFormatted;
        }

        // If only .price__regular is present, update its contents
        const regularContainer = priceContainer.querySelector(".price__regular");
        const saleContainer = priceContainer.querySelector(".price__sale");
        if (regularContainer && (!saleContainer || window.getComputedStyle(saleContainer).display === "none")) {
          regularContainer.innerHTML = `
            <s style="opacity:0.65; margin-right:8px; font-weight:normal;">${origPriceFormatted}</s>
            <strong style="color:#DC2626; font-weight:700;">${salePriceFormatted}</strong>
          `;
        }
      });
    } catch (e) {
      console.warn("[SmartStock] Error updating price container:", e);
    }
  }


  /* =========================================================
     BUNDLE UI
     ========================================================= */

  function renderBundle(data) {
    if (
      !data?.deadStockOffer?.hasBundle ||
      data?.bundleConfig?.enabled === false
    ) {
      document
        .querySelectorAll('[data-smart-stock-feature="bundle"]')
        .forEach((element) => {
          element.remove();
        });
      return;
    }

    document
      .querySelectorAll(
        '[data-smart-stock-feature="bundle"]'
      )
      .forEach((element) => {
        element.remove();
      });

    const bundleCfg = data.bundleConfig || {};
    const bundleInfo =
      data.deadStockOffer.bundle ||
      {};

    const bundleName =
      bundleInfo.bundleName ||
      data.deadStockOffer.bundleName ||
      "Frequently Bought Together";

    const discount =
      Number(
        bundleInfo.discountPercent ??
        data.deadStockOffer.bundleDiscountPercent ??
        15
      );

    const isBOGO =
      String(bundleInfo.offerType || "").trim().toUpperCase() === "BOGO";

    const headerIcon = isBOGO ? "🎁" : "📦";

    const headerTitle = isBOGO
      ? "Buy One Get One Free"
      : (bundleCfg.headerTitle || "Frequently Bought Together");

    const buttonLabel = isBOGO
      ? "Claim BOGO Offer"
      : (bundleCfg.buttonText || "Add Both to Cart");

    const companionLabel = isBOGO
      ? "🎁 Buy One Get One Free"
      : "Recommended companion";

    const showDiscountBadge = bundleCfg.showDiscountBadge !== false;
    const discountText = isBOGO ? "SAVE 100% OFF" : `Save ${escapeHtml(discount)}% OFF`;

    const badgeBgColor = bundleCfg.badgeColor || (isBOGO ? "#ECFDF5" : "#DCFCE7");
    const badgeTextColor = bundleCfg.badgeTextColor || (isBOGO ? "#059669" : "#15803D");
    const buttonBgColor = bundleCfg.buttonColor || "#111827";
    const buttonTextColor = bundleCfg.buttonTextColor || "#FFFFFF";
    const borderRadius = Number(bundleCfg.borderRadius) || 12;

    const pageProductTitle = document.querySelector('h1, .product__title, .product-title')?.innerText?.trim() || "";

    const isPlaceholderTitle = (str) => {
      if (!str || typeof str !== "string") return true;
      const s = str.trim().toLowerCase();
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
    };

    const deadStockTitle =
      (!isPlaceholderTitle(bundleInfo.deadStockTitle) ? bundleInfo.deadStockTitle : "") ||
      pageProductTitle ||
      bundleInfo.deadStockVariantTitle ||
      "Product unavailable";

    const companionTitle = isBOGO
      ? ((!isPlaceholderTitle(bundleInfo.freeProductTitle) ? bundleInfo.freeProductTitle : "") ||
         (!isPlaceholderTitle(bundleInfo.companionTitle) ? bundleInfo.companionTitle : "") ||
         bundleInfo.companionVariantTitle ||
         "Free Gift")
      : ((!isPlaceholderTitle(bundleInfo.companionTitle) ? bundleInfo.companionTitle : "") ||
         bundleInfo.companionVariantTitle ||
         "Product unavailable");

    const deadStockImage =
      bundleInfo.deadStockImage && !bundleInfo.deadStockImage.includes("placeholder-images-image_large.png")
        ? bundleInfo.deadStockImage
        : "";

    const companionImage = isBOGO
      ? ((bundleInfo.freeProductImage && !bundleInfo.freeProductImage.includes("placeholder-images-image_large.png"))
          ? bundleInfo.freeProductImage
          : (bundleInfo.companionImage && !bundleInfo.companionImage.includes("placeholder-images-image_large.png"))
          ? bundleInfo.companionImage
          : "")
      : (bundleInfo.companionImage && !bundleInfo.companionImage.includes("placeholder-images-image_large.png")
          ? bundleInfo.companionImage
          : "");

    const originalPrice =
      Number(
        bundleInfo.originalPrice || 0
      );

    const bundlePrice =
      Number(
        bundleInfo.bundlePrice || 0
      );

    const savings =
      originalPrice > bundlePrice
        ? originalPrice - bundlePrice
        : 0;

    const originalFormatted =
      originalPrice > 0
        ? formatMoney(originalPrice)
        : "";

    const bundleFormatted =
      bundlePrice > 0
        ? formatMoney(bundlePrice)
        : "Special Offer";

    const savingsFormatted =
      savings > 0
        ? formatMoney(savings)
        : "";

    if (
      !companionTitle ||
      companionTitle === "Product unavailable" ||
      isPlaceholderTitle(companionTitle) ||
      !deadStockTitle ||
      deadStockTitle === "Product unavailable" ||
      isPlaceholderTitle(deadStockTitle)
    ) {
      return;
    }

    const element =
      createFeature(
        "bundle",
        "smart-stock-embed-bundle smart-stock-embed-inline"
      );

    element.style.borderRadius = `${borderRadius}px`;

    element.innerHTML = `

      <!-- HEADER -->

      <div class="smart-stock-bundle-header">

        <div class="smart-stock-bundle-heading">

          <div class="smart-stock-bundle-icon">
            ${headerIcon}
          </div>

          <div class="smart-stock-bundle-title">
            ${escapeHtml(headerTitle)}
          </div>

        </div>

        ${showDiscountBadge
        ? `
            <div class="smart-stock-bundle-discount ${isBOGO ? 'bogo-badge' : ''}" style="background:${badgeBgColor} !important; color:${badgeTextColor} !important; border:1px solid ${badgeBgColor} !important;">
              ${discountText}
            </div>
          `
        : ""
      }

      </div>


      <!-- SUBTITLE -->

      <div class="smart-stock-bundle-subtitle">
        ${escapeHtml(bundleName)}
      </div>


      <!-- PRODUCTS -->

      <div class="smart-stock-bundle-products">


        <!-- PRODUCT 1 -->

        <div class="smart-stock-bundle-product">

          <div class="smart-stock-bundle-check">
            ✓
          </div>

          ${deadStockImage
        ? `
                <img
                  class="smart-stock-bundle-image"
                  src="${escapeHtml(
          deadStockImage
        )}"
                  alt="${escapeHtml(
          deadStockTitle
        )}"
                  loading="lazy"
                />
              `
        : `
                <div
                  class="smart-stock-bundle-image"
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:16px;
                  "
                >
                  📦
                </div>
              `
      }

          <div class="smart-stock-bundle-info">

            <span class="smart-stock-bundle-product-name">
              ${escapeHtml(
        deadStockTitle
      )}
            </span>

            <span class="smart-stock-bundle-product-label">
              Current item
            </span>

          </div>

        </div>


        <!-- PLUS -->

        <div class="smart-stock-bundle-plus ${isBOGO ? 'smart-stock-bundle-bogo-plus' : ''}">
          <span>${isBOGO ? "+ GET 1 FREE" : "+"}</span>
        </div>


        <!-- PRODUCT 2 -->

        <div class="smart-stock-bundle-product">

          <div class="smart-stock-bundle-check" ${isBOGO ? 'style="background:#059669;"' : ''}>
            ✓
          </div>

          ${companionImage
        ? `
                <img
                  class="smart-stock-bundle-image"
                  src="${escapeHtml(
          companionImage
        )}"
                  alt="${escapeHtml(
          companionTitle
        )}"
                  loading="lazy"
                />
              `
        : `
                <div
                  class="smart-stock-bundle-image"
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:16px;
                  "
                >
                  📦
                </div>
              `
      }

          <div class="smart-stock-bundle-info">

            <span class="smart-stock-bundle-product-name">
              ${escapeHtml(
        companionTitle
      )}
            </span>

            <span class="smart-stock-bundle-product-label recommended" ${isBOGO ? 'style="color:#059669;font-weight:700;font-size:13px;"' : ''}>
              ${escapeHtml(companionLabel)}
            </span>

          </div>

        </div>

      </div>


      <!-- PRICE -->

      <div class="smart-stock-bundle-price">

        <div>

          <div class="smart-stock-bundle-price-label">
            Bundle price
          </div>

          <div class="smart-stock-bundle-price-main">

            <span class="smart-stock-bundle-price-current">
              ${bundleFormatted}
            </span>

            ${originalFormatted
        ? `
                  <span class="smart-stock-bundle-price-old">
                    ${originalFormatted}
                  </span>
                `
        : ""
      }

          </div>

        </div>


        ${savingsFormatted
        ? `
              <div class="smart-stock-bundle-saving" style="background:${badgeBgColor} !important; color:${badgeTextColor} !important;">
                Save ${savingsFormatted}
              </div>
            `
        : ""
      }

      </div>


      <!-- BUTTON -->

      <button
        type="button"
        class="smart-stock-buy-bundle-btn"
        style="background:${buttonBgColor} !important; color:${buttonTextColor} !important; border-radius:${Math.min(borderRadius, 8)}px !important;"
      >

        <span>
          ⚡
        </span>

        <span>
          ${escapeHtml(buttonLabel)}
          ${bundlePrice > 0
        ? ` · ${bundleFormatted}`
        : ""
      }
        </span>

      </button>
    `;


    /* =======================================================
       BUTTON
       ======================================================= */

    const button =
      element.querySelector(
        ".smart-stock-buy-bundle-btn"
      );

    if (!button) {
      return;
    }


    /* =======================================================
       ADD TO CART (LIVE CART-AWARE SYNC)
       ======================================================= */

    button.addEventListener(
      "click",
      async function () {
        const originalButtonHTML = button.innerHTML;
        button.disabled = true;

        button.innerHTML = `
          <span
            style="
              display:inline-block;
              width:14px;
              height:14px;
              border:2px solid rgba(255,255,255,.5);
              border-top-color:#fff;
              border-radius:50%;
              animation:smartStockSpin .7s linear infinite;
            "
          ></span>
          <span>Adding bundle...</span>
        `;

        try {
          // 1. Resolve Target Bundle Variant IDs
          const var1Raw =
            bundleInfo.deadStockVariantId || state.variantId || "";
          const var2Raw =
            bundleInfo.companionVariantId || "";

          const cleanVar1 = Number(
            String(var1Raw).replace(/\D/g, "")
          );
          const cleanVar2 = Number(
            String(var2Raw).replace(/\D/g, "")
          );

          const standaloneBundleVar =
            bundleInfo.shopifyVariantId
              ? Number(
                  String(
                    bundleInfo.shopifyVariantId
                  ).replace(/\D/g, "")
                )
              : 0;

          // 2. Fetch Latest Live Cart State from Shopify
          let currentCartItems = [];
          try {
            const cartRes = await fetch("/cart.js", {
              method: "GET",
              headers: { Accept: "application/json" },
              cache: "no-store",
              credentials: "same-origin",
            });
            if (cartRes.ok) {
              const cartData = await cartRes.json();
              currentCartItems = Array.isArray(cartData.items)
                ? cartData.items
                : [];
            }
          } catch (cartErr) {
            console.warn(
              "[Smart Stock Bundle] Live cart fetch warning:",
              cartErr
            );
          }

          // Map quantities of variants currently in the cart
          const cartVariantQtyMap = {};
          for (const item of currentCartItems) {
            const vid = Number(item.variant_id || item.id);
            if (vid) {
              cartVariantQtyMap[vid] =
                (cartVariantQtyMap[vid] || 0) +
                Number(item.quantity || 0);
            }
          }

          // 3. Determine Exactly Which Items Need to be Added
          let itemsToAdd = [];

          if (cleanVar1 && cleanVar2) {
            const qty1InCart = cartVariantQtyMap[cleanVar1] || 0;
            const qty2InCart = cartVariantQtyMap[cleanVar2] || 0;

            if (qty1InCart > 0 && qty2InCart === 0) {
              // Main product is already in cart, but companion was deleted/missing.
              // Add ONLY the missing companion product to avoid unwanted duplicate main product.
              itemsToAdd.push({
                id: cleanVar2,
                quantity: 1,
                properties: {
                  _smart_stock_bundle: bundleName,
                },
              });
            } else if (qty2InCart > 0 && qty1InCart === 0) {
              // Companion product is already in cart, but main product is missing.
              // Add ONLY the missing main product.
              itemsToAdd.push({
                id: cleanVar1,
                quantity: 1,
                properties: {
                  _smart_stock_bundle: bundleName,
                },
              });
            } else {
              // Both are missing OR both are in cart (add full bundle set)
              itemsToAdd.push({
                id: cleanVar1,
                quantity: 1,
                properties: {
                  _smart_stock_bundle: bundleName,
                },
              });
              itemsToAdd.push({
                id: cleanVar2,
                quantity: 1,
                properties: {
                  _smart_stock_bundle: bundleName,
                },
              });
            }
          } else if (cleanVar1) {
            itemsToAdd.push({
              id: cleanVar1,
              quantity: 1,
              properties: {
                _smart_stock_bundle: bundleName,
              },
            });
          } else if (standaloneBundleVar) {
            itemsToAdd.push({
              id: standaloneBundleVar,
              quantity: 1,
            });
          }

          if (itemsToAdd.length === 0) {
            throw new Error(
              "Could not resolve bundle items to add."
            );
          }

          // 4. Send POST /cart/add.js to Shopify Cart
          const response = await fetch("/cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ items: itemsToAdd }),
          });

          if (!response.ok) {
            const error = await response
              .json()
              .catch(() => ({}));
            throw new Error(
              error.description ||
                error.message ||
                "Failed to add bundle to cart."
            );
          }

          const addedResult = await response
            .json()
            .catch(() => ({}));

          // 5. Trigger Theme Cart Events (for cart drawer & badge updates)
          try {
            document.dispatchEvent(
              new CustomEvent("cart:updated", {
                detail: { cart: addedResult },
              })
            );
            document.dispatchEvent(
              new CustomEvent("cart:refresh")
            );
            document.dispatchEvent(
              new CustomEvent("theme:cart:update")
            );
            if (
              window.Shopify &&
              typeof window.Shopify.onItemAdded === "function"
            ) {
              window.Shopify.onItemAdded(addedResult);
            }
          } catch (e) {}

          // 6. Success Feedback & Redirect
          button.style.background = "#059669";
          button.innerHTML = `
            <span>✓</span>
            <span>Added to Cart</span>
          `;

          setTimeout(function () {
            window.location.href = "/cart";
          }, 450);
        } catch (error) {
          console.error(
            "[Smart Stock Bundle] Error adding to cart:",
            error
          );
          button.disabled = false;
          button.innerHTML = originalButtonHTML;
          button.style.background = "";

          // Remove any previous error message
          const existingErr =
            button.parentNode.querySelector(
              ".smart-stock-bundle-error-msg"
            );
          if (existingErr) {
            existingErr.remove();
          }

          const cleanMessage = String(
            error.message ||
              "Failed to add bundle to cart."
          ).replace(/^Bundle Error:\s*/i, "");

          const errorDiv = document.createElement("div");
          errorDiv.className = "smart-stock-bundle-error-msg";
          errorDiv.innerHTML = `
            <span class="smart-stock-bundle-error-icon">⚠️</span>
            <span class="smart-stock-bundle-error-text">${escapeHtml(cleanMessage)}</span>
          `;

          button.parentNode.insertBefore(
            errorDiv,
            button.nextSibling
          );
        }
      }
    );


    /* =======================================================
       INSERT INTO PRODUCT FORM
       ======================================================= */

    insertClearanceElement(
      element
    );
  }


  /* =========================================================
     REPLACE THEME SALE BADGE WITH PROGRESSIVE MARKDOWN
     ========================================================= */

  function replaceThemeSaleBadge(element) {
    const saleBadges = document.querySelectorAll(
      ".price__badge-sale, .price .badge, .product__info-container .price .badge, .badge.price__badge-sale, [data-price-badge]"
    );

    let replaced = false;
    for (const badge of saleBadges) {
      if (badge && badge.parentNode) {
        const text = (badge.textContent || "").trim().toLowerCase();
        if (text.includes("sale") || badge.classList.contains("price__badge-sale")) {
          badge.style.display = "none";
          badge.parentNode.insertBefore(element, badge.nextSibling);
          replaced = true;
        }
      }
    }

    if (replaced) return true;

    const priceInner = document.querySelector(
      ".product__info-container .price__container, .product-info .price__container, .price__sale, .price__regular, .product__info-container .price, .product-info .price, .price"
    );

    if (priceInner) {
      if (priceInner.classList.contains("price__container") || priceInner.classList.contains("price__sale") || priceInner.classList.contains("price")) {
        priceInner.appendChild(element);
        return true;
      }
      if (priceInner.parentNode) {
        priceInner.parentNode.insertBefore(element, priceInner.nextSibling);
        return true;
      }
    }

    return insertClearanceElement(element);
  }

  /* =========================================================
     PROGRESSIVE MARKDOWN BADGE
     ========================================================= */

  function renderMarkdown(data) {
    document
      .querySelectorAll('[data-smart-stock-feature="markdown"], .smart-stock-progressive-markdown-wrapper, [data-progressive-markdown-root], .smart-stock-markdown-badge, [data-markdown-badge]')
      .forEach((element) => {
        element.remove();
      });

    updateThemeSaleBadges(data);
  }

  /* =========================================================
     UPDATE THEME SALE BADGES & DISCOUNTED PRICE DISPLAY
     ========================================================= */

  function updateThemeSaleBadges(data) {
    const cfg = data?.markdownConfig || data?.progressiveMarkdown?.config || {};
    if (cfg.enabled === false) {
      document
        .querySelectorAll('[data-smart-stock-progressive-markdown], [data-smart-stock-price-display]')
        .forEach((el) => el.remove());
      const hiddenThemePrices = document.querySelectorAll('[data-smart-stock-hidden-price]');
      hiddenThemePrices.forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-smart-stock-hidden-price");
      });
      return;
    }

    const bgColor = cfg.badgeBackgroundColor || "#df2626";
    const textColor = cfg.badgeTextColor || "#FFFFFF";
    const borderRadius = cfg.borderRadius != null ? cfg.borderRadius : 4;
    const templateText = cfg.badgeText || "{discount}% OFF";

    let discountPct = 0;
    let originalPriceVal = 0;
    let salePriceVal = 0;

    // 1. Check live product variants
    try {
      const liveProduct = window.SmartStockProduct;
      if (liveProduct && liveProduct.variants) {
        const currentVariant =
          liveProduct.variants.find((v) => String(v.id) === String(state.variantId)) ||
          liveProduct.variants[0];

        if (currentVariant) {
          const vPrice = Number(currentVariant.price) > 0 ? (Number(currentVariant.price) > 50000 && !document.body.innerText.includes(String(currentVariant.price)) ? Number(currentVariant.price) / 100 : Number(currentVariant.price)) : 0;
          const vCompare = Number(currentVariant.compare_at_price) > 0 ? (Number(currentVariant.compare_at_price) > 50000 && !document.body.innerText.includes(String(currentVariant.compare_at_price)) ? Number(currentVariant.compare_at_price) / 100 : Number(currentVariant.compare_at_price)) : 0;

          if (vCompare && vCompare > vPrice) {
            discountPct = Math.round(((vCompare - vPrice) / vCompare) * 100);
            originalPriceVal = vCompare;
            salePriceVal = vPrice;
          } else {
            originalPriceVal = vPrice;
          }
        }
      }
    } catch (e) {}

    // 2. Check progressive markdown discount from backend
    if (!discountPct && data?.progressiveMarkdown?.enabled && data?.progressiveMarkdown?.currentDiscount) {
      discountPct = Number(data.progressiveMarkdown.currentDiscount);
    }

    // 5. Fallback: Parse existing DOM price elements ONLY if compare-at price exists in theme
    const priceRoot = document.querySelector(
      ".product__info-container .price, .product__price .price, .price, .product-single__price"
    );
    const regPriceEl = priceRoot
      ? priceRoot.querySelector(".price-item--regular, .price__regular .price-item, .price-item")
      : document.querySelector(".price-item--regular, .price__regular .price-item, .price-item");
    const existingSaleEl = priceRoot
      ? priceRoot.querySelector(".price-item--sale, .price__sale .price-item")
      : document.querySelector(".price-item--sale, .price__sale .price-item");

    const regText = regPriceEl ? regPriceEl.textContent.trim() : "";
    const regNum = regText ? parseFloat(regText.replace(/[^0-9.]/g, "")) : 0;

    if (discountPct <= 0) {
      // Clean up any previously applied price display or markdown badges if discount is 0
      document.querySelectorAll('[data-smart-stock-price-display="true"], [data-smart-stock-progressive-markdown="true"]').forEach((el) => el.remove());
      const hiddenPrices = document.querySelectorAll('[data-smart-stock-hidden-price]');
      hiddenPrices.forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-smart-stock-hidden-price");
      });
      return;
    }

    // Ensure price values are calculated
    if (!originalPriceVal || originalPriceVal <= 0) {
      originalPriceVal = regNum > 0 ? regNum : 0;
    }
    if (!salePriceVal || salePriceVal <= 0) {
      salePriceVal = originalPriceVal > 0 ? originalPriceVal * (1 - discountPct / 100) : 0;
    }

    // Helper to format price maintaining original currency suffix if present in DOM
    function formatPriceWithSuffix(amount, sample) {
      if (isNaN(amount) || amount <= 0) return "";
      let formatted = formatMoney(amount);
      if (sample && typeof sample === "string") {
        const trimmed = sample.trim();
        const suffixMatch = trimmed.match(/([A-Z]{3})$/i);
        if (suffixMatch && !formatted.includes(suffixMatch[1])) {
          formatted += " " + suffixMatch[1];
        }
      }
      return formatted;
    }

    const originalFormatted = formatPriceWithSuffix(originalPriceVal, regText);
    const saleFormatted = formatPriceWithSuffix(salePriceVal, regText);

    // =========================================================
    // UPDATE DOM: STRIKETHROUGH ORIGINAL PRICE & SHOW DISCOUNTED PRICE
    // =========================================================
    const hasThemeSaleDisplay = Boolean(
      priceRoot && (
        priceRoot.classList.contains("price--on-sale") ||
        (existingSaleEl && existingSaleEl.textContent.trim() !== "")
      )
    );

    if (hasThemeSaleDisplay) {
      document.querySelectorAll('[data-smart-stock-price-display="true"]').forEach((el) => el.remove());
    } else if (priceRoot && originalFormatted && saleFormatted) {
      let priceDisplayWrapper = priceRoot.querySelector('[data-smart-stock-price-display="true"]');
      if (!priceDisplayWrapper) {
        priceDisplayWrapper = document.createElement("div");
        priceDisplayWrapper.setAttribute("data-smart-stock-price-display", "true");
        priceDisplayWrapper.style.cssText = `
          display: inline-flex !important;
          align-items: baseline !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
          vertical-align: middle !important;
          margin-right: 4px !important;
        `;

        // Hide default regular price container to avoid duplicate un-discounted price
        const regWrapper = priceRoot.querySelector(".price__regular");
        if (regWrapper) {
          regWrapper.style.setProperty("display", "none", "important");
          regWrapper.setAttribute("data-smart-stock-hidden-price", "true");
        } else if (regPriceEl) {
          regPriceEl.style.setProperty("display", "none", "important");
          regPriceEl.setAttribute("data-smart-stock-hidden-price", "true");
        }

        const container = priceRoot.querySelector(".price__container") || priceRoot;
        container.prepend(priceDisplayWrapper);
      }

      priceDisplayWrapper.innerHTML = `
        <s class="price-item price-item--regular" style="text-decoration: line-through !important; color: #6b7280 !important; font-size: 0.95em !important; opacity: 0.7 !important; font-weight: 400 !important;">
          ${escapeHtml(originalFormatted)}
        </s>
        <span class="price-item price-item--sale" style="font-weight: 700 !important; color: #111827 !important; font-size: 1.05em !important;">
          ${escapeHtml(saleFormatted)}
        </span>
      `;
    }

    // =========================================================
    // BADGE HTML & INJECTION
    // =========================================================
    const badgeText = templateText.replace(/\{discount\}/g, String(discountPct));

    const badgeHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
        <polyline points="17 18 23 18 23 12"></polyline>
      </svg>
      <span>${escapeHtml(badgeText)}</span>
    `;

    // 1. Check if a dedicated SmartStock markdown badge already exists
    const existingMarkdownBadge = document.querySelector('[data-smart-stock-progressive-markdown="true"]');
    if (existingMarkdownBadge) {
      document.querySelectorAll('[data-smart-stock-progressive-markdown="true"]').forEach((el, idx) => {
        if (idx > 0) el.remove();
      });
      existingMarkdownBadge.style.setProperty("background", bgColor, "important");
      existingMarkdownBadge.style.setProperty("color", textColor, "important");
      existingMarkdownBadge.style.setProperty("border-radius", borderRadius + "px", "important");
      existingMarkdownBadge.innerHTML = badgeHTML;
      return;
    }

    // 2. Look for theme-rendered sale badges inside .price
    const saleBadges = Array.from(
      document.querySelectorAll(
        ".price__badge-sale, .price .badge, .product__info-container .price .badge, .badge.price__badge-sale, [data-price-badge]"
      )
    );

    if (saleBadges.length > 0) {
      // Target ONLY the primary inline sale badge next to the sale price
      const primaryBadge =
        saleBadges.find((b) => b.closest(".price__sale") || b.closest(".price__container") || b.classList.contains("price__badge-sale")) ||
        saleBadges[0];

      // Hide all other secondary duplicate badges permanently
      saleBadges.forEach((b) => {
        if (b !== primaryBadge) {
          b.style.setProperty("display", "none", "important");
          b.setAttribute("data-smart-stock-duplicate-hidden", "true");
        }
      });

      primaryBadge.setAttribute("data-smart-stock-progressive-markdown", "true");
      primaryBadge.style.setProperty("display", "inline-flex", "important");
      primaryBadge.style.setProperty("align-items", "center", "important");
      primaryBadge.style.setProperty("gap", "4px", "important");
      primaryBadge.style.setProperty("background", bgColor, "important");
      primaryBadge.style.setProperty("color", textColor, "important");
      primaryBadge.style.setProperty("border", "none", "important");
      primaryBadge.style.setProperty("padding", "4px 8px", "important");
      primaryBadge.style.setProperty("border-radius", borderRadius + "px", "important");
      primaryBadge.style.setProperty("font-weight", "700", "important");
      primaryBadge.style.setProperty("font-size", "12px", "important");
      primaryBadge.style.setProperty("line-height", "1.2", "important");
      primaryBadge.style.setProperty("letter-spacing", "0.3px", "important");
      primaryBadge.style.setProperty("text-transform", "uppercase", "important");
      primaryBadge.style.setProperty("box-shadow", "0 1px 2px rgba(0,0,0,0.1)", "important");
      primaryBadge.style.setProperty("margin-left", "8px", "important");
      primaryBadge.innerHTML = badgeHTML;
    } else {
      // 3. Fallback: If no theme sale badge exists in DOM, create exactly ONE inline element
      const badgeSpan = document.createElement("span");
      badgeSpan.setAttribute("data-smart-stock-progressive-markdown", "true");
      badgeSpan.className = "badge price__badge-sale";
      badgeSpan.style.cssText = `
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        background: ${bgColor} !important;
        color: ${textColor} !important;
        border: none !important;
        padding: 4px 8px !important;
        border-radius: ${borderRadius}px !important;
        font-weight: 700 !important;
        font-size: 12px !important;
        line-height: 1.2 !important;
        letter-spacing: 0.3px !important;
        text-transform: uppercase !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
        margin-left: 8px !important;
        vertical-align: middle !important;
      `;
      badgeSpan.innerHTML = badgeHTML;

      const priceContainer = document.querySelector(
        ".price__sale, .price__container, .product__info-container .price, .price, .product__price"
      );
      if (priceContainer) {
        priceContainer.appendChild(badgeSpan);
      }
    }
  }

  /* =========================================================
     URGENCY
     ========================================================= */

  function renderUrgency(data) {
    // Suppressed: Handled exclusively in-form by Stockout Shield
    return;
  }

  /* =========================================================
     LOAD FEATURES (MODULE A)
     ========================================================= */

  async function loadFeatures() {
    removeElements();

    const params = new URLSearchParams({
      shop: config.shop,
      productId: state.productId,
      variantId: state.variantId,
    });

    try {
      const response = await fetch(
        `/apps/smart-stock/product-widget?${params.toString()}`,
        {
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(`Smart Stock request failed: ${response.status}`);
      }

      const data = await response.json();

      /* -----------------------------------------------
         Initial render
         ----------------------------------------------- */
      setTimeout(function () {
        renderSale(data);
        renderBundle(data);
        renderMarkdown(data);
        renderUrgency(data);
        updateThemeSaleBadges(data);
      }, 150);

      /* -----------------------------------------------
         Theme re-render
         ----------------------------------------------- */
      setTimeout(function () {
        const clearance = document.querySelector('[data-smart-stock-feature="clearance"]');
        const bundle = document.querySelector('[data-smart-stock-feature="bundle"]');
        const markdown = document.querySelector('[data-smart-stock-feature="markdown"]');

        if (data?.deadStockOffer?.hasClearance && !clearance) {
          renderSale(data);
        }
        if (data?.deadStockOffer?.hasBundle && !bundle) {
          renderBundle(data);
        }
        if (data?.progressiveMarkdown?.enabled && !markdown) {
          renderMarkdown(data);
        }
        updateThemeSaleBadges(data);
      }, 600);

      /* -----------------------------------------------
         Final theme retry
         ----------------------------------------------- */
      setTimeout(function () {
        const clearance = document.querySelector('[data-smart-stock-feature="clearance"]');
        const bundle = document.querySelector('[data-smart-stock-feature="bundle"]');
        const markdown = document.querySelector('[data-smart-stock-feature="markdown"]');

        if (data?.deadStockOffer?.hasClearance && !clearance) {
          renderSale(data);
        }
        if (data?.deadStockOffer?.hasBundle && !bundle) {
          renderBundle(data);
        }
        if (data?.progressiveMarkdown?.enabled && !markdown) {
          renderMarkdown(data);
        }
        updateThemeSaleBadges(data);
      }, 1500);
    } catch (error) {
      console.error(
        "[Smart Stock]",
        error
      );
      removeElements();
    }
  }


  /* =========================================================
     VARIANT EVENT
     ========================================================= */

  function getVariantIdFromEvent(
    event
  ) {

    return (
      event.detail?.variant?.id ||
      event.target?.value ||
      ""
    );
  }


  document.addEventListener(
    "variant:change",
    function (event) {

      const variantId =
        getVariantIdFromEvent(
          event
        );


      if (variantId) {

        state.variantId =
          String(
            variantId
          );


        loadFeatures();

      }

    }
  );


  /* =========================================================
     VARIANT SELECT
     ========================================================= */

  document.addEventListener(
    "change",
    function (event) {

      if (
        event.target?.name !==
        "id" ||
        !event.target.value
      ) {
        return;
      }


      state.variantId =
        String(
          event.target.value
        );


      loadFeatures();

    }
  );


  /* =========================================================
     CART PRE-ORDER DEPOSIT DISPLAY ENHANCEMENT
     ========================================================= */
  async function enhanceCartPreOrderDisplay() {
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

      var cartItems = document.querySelectorAll("cart-items .cart-item, .cart-item, .cart__items tr, tr.cart-item, [data-cart-item], .cart-drawer .cart-item");
      cartItems.forEach(function (row) {
        var rowText = row.textContent || "";
        if (!rowText.includes("Deposit Paid") && !rowText.includes("Remaining Balance Due") && !rowText.includes("Pre-Order Total")) return;

        var match = rowText.match(/Deposit Paid[^:]*:\s*\$?([\d,]+(?:\.\d{2})?)/i);
        var depAmt = match ? match[1].replace(/,/g, "") : "";
        if (!depAmt) {
          var match2 = rowText.match(/Pre-Order Total[^:]*:\s*\$?([\d,]+(?:\.\d{2})?)/i);
          if (match2) depAmt = match2[1].replace(/,/g, "");
        }

        if (depAmt) {
          var priceContainers = row.querySelectorAll(".cart-item__price-wrapper, .cart-item__totals, .cart-item__price, .price--end, [data-cart-item-line-price], .cart-item__final-price");
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

      var subtotalEls = document.querySelectorAll(".totals__total-value, .cart__subtotal-value, .cart-subtotal, [data-cart-subtotal], .cart__total, .cart-drawer__total, .totals__subtotal-value, .cart__footer .totals__total-value, [data-cart-total]");
      subtotalEls.forEach(function (stEl) {
        if (stEl.getAttribute("data-smart-stock-subtotal-enhanced")) return;
        stEl.setAttribute("data-smart-stock-subtotal-enhanced", "true");
        var formattedDeposit = "$" + (totalPayableCents / 100).toFixed(2);
        stEl.innerHTML =
          '<div style="text-align:right;">' +
          '<div style="font-size:18px; font-weight:800; color:#0F172A;">' + formattedDeposit + ' USD</div>' +
          '<div style="font-size:11.5px; color:#64748B; font-weight:600; margin-top:2px;">Pay Now Deposit (Remaining balance due before shipping)</div>' +
          '</div>';
      });
    } catch (_) {}
  }

  /* =========================================================
     INITIAL LOAD
     ========================================================= */

  function init() {
    loadFeatures();
    enhanceCartPreOrderDisplay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  setTimeout(enhanceCartPreOrderDisplay, 500);
  setTimeout(enhanceCartPreOrderDisplay, 1500);
  document.addEventListener("cart:updated", enhanceCartPreOrderDisplay);
  document.addEventListener("theme:cart:update", enhanceCartPreOrderDisplay);
  document.addEventListener("cart:refresh", enhanceCartPreOrderDisplay);
})();