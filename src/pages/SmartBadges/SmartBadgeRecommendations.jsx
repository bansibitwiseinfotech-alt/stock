import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Page,
  Card,
  Text,
  Badge,
  Button,
  Banner,
  Spinner,
  ProgressBar,
  Thumbnail,
  EmptyState,
  TextField,
  Select,
  InlineStack,
  BlockStack,
  Box,
  Divider,
  Modal,
  Toast,
  Frame,
} from "@shopify/polaris";
import {
  SearchIcon,
  RefreshIcon,
} from "@shopify/polaris-icons";
import {
  scanSmartBadgesApi,
  fetchSmartBadgeRecommendationsApi,
  applySmartBadgeApi,
  disableSmartBadgeApi,
  fetchBadgeSettingsApi,
} from "../../services/appApi";

const BADGE_CONFIG = {
  LOW_STOCK: {
    label: "Low Stock",
    badgeLabel: "🔥 Low Stock",
    tone: "critical",
    icon: "🔥",
    color: "#D82C0D",
    bg: "#FFF4F2",
    border: "#FED3D1",
    description: "Display urgent low stock counter on storefront when inventory is below threshold.",
  },
  CLEARANCE: {
    label: "Clearance",
    badgeLabel: "🏷️ Clearance Sale",
    tone: "warning",
    icon: "🏷️",
    color: "#916A00",
    bg: "#FFF8DB",
    border: "#FFECA1",
    description: "Apply fixed clearance discount to liquidate stagnant or high-value surplus inventory.",
  },
  BUNDLE: {
    label: "Bundle Offer",
    badgeLabel: "📦 Bundle Offer",
    tone: "info",
    icon: "📦",
    color: "#006E52",
    bg: "#F1F8F9",
    border: "#B2ECE1",
    description: "Pair with frequently co-purchased companion items for bundle & save offer.",
  },
  PROGRESSIVE_MARKDOWN: {
    label: "Markdown",
    badgeLabel: "📉 Markdown",
    tone: "attention",
    icon: "📉",
    color: "#5C6AC4",
    bg: "#F4F5FA",
    border: "#D3D7EE",
    description: "Automatically increase discount progressively over time until target sales are reached.",
  },
  PRE_ORDER: {
    label: "Pre-Order",
    badgeLabel: "🛒 Pre-Order",
    tone: "success",
    icon: "🛒",
    color: "#1B5E20",
    bg: "#F1F8F5",
    border: "#C8E6C9",
    description: "Allow customers to pre-order out-of-stock or upcoming items with deposit percentage.",
  },
  NONE: {
    label: "No Badge",
    badgeLabel: "No Badge",
    tone: "subdued",
    icon: "⚪",
    color: "#6D7175",
    bg: "#F6F6F7",
    border: "#E1E3E5",
    description: "No badge needed. Product is performing normally.",
  },
};

const TAB_KEYS = ["ALL", "LOW_STOCK", "CLEARANCE", "BUNDLE", "PROGRESSIVE_MARKDOWN", "PRE_ORDER", "NONE"];

const ALL_BADGE_OPTIONS = [
  { value: "PRE_ORDER", label: "🛒 Pre-Order" },
  { value: "PROGRESSIVE_MARKDOWN", label: "📉 Progressive Markdown" },
  { value: "CLEARANCE", label: "🏷️ Clearance Sale" },
  { value: "BUNDLE", label: "📦 Bundle Offer" },
  { value: "LOW_STOCK", label: "🔥 Low Stock" },
];

export default function SmartBadgeRecommendations({ shopDomain = "" }) {
  const shop =
    shopDomain ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applyingSingleId, setApplyingSingleId] = useState(null);

  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [lastScannedAt, setLastScannedAt] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Filters & Tabs
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConfidence, setSelectedConfidence] = useState("ALL");
  const [selectedRisk, setSelectedRisk] = useState("ALL");

  // Drawer / Detail Modal state
  const [activeDrawerProduct, setActiveDrawerProduct] = useState(null);
  const [selectedBadgeForProduct, setSelectedBadgeForProduct] = useState(null);

  // ----------------------------------------------------
  // INITIAL DATA LOAD
  // ----------------------------------------------------
  const loadInitialData = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [recRes, settingsRes] = await Promise.all([
        fetchSmartBadgeRecommendationsApi(shop).catch((e) => ({ success: false, message: e.message })),
        fetchBadgeSettingsApi(shop).catch(() => null),
      ]);

      if (recRes.success && Array.isArray(recRes.products)) {
        setProducts(recRes.products);
        setSummary(recRes.summary || null);
        if (recRes.settings) setStoreSettings(recRes.settings);
        setLastScannedAt(new Date());
      }
      if (settingsRes) {
        setStoreSettings(settingsRes);
      }
    } catch (err) {
      if (err.status === 401) {
        setErrorMsg("Shopify authentication required. Please reload the app inside Shopify Admin.");
      } else {
        console.warn("[SmartBadge] Initial load notice:", err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ----------------------------------------------------
  // SCAN FLOW
  // ----------------------------------------------------
  const handleScanProducts = async () => {
    if (!shop) return;
    setScanning(true);
    setErrorMsg(null);
    try {
      const res = await scanSmartBadgesApi(shop);
      if (res.success) {
        setProducts(res.products || []);
        setSummary(res.summary || null);
        if (res.settings) setStoreSettings(res.settings);
        setLastScannedAt(new Date());
        setToastMsg(`✓ Scan completed — ${res.scanned || res.products?.length || 0} products analyzed`);
      } else {
        setErrorMsg(res.message || "Failed to complete product scan.");
      }
    } catch (err) {
      setErrorMsg(err.message || "Unable to scan products from Shopify.");
    } finally {
      setScanning(false);
    }
  };

  // ----------------------------------------------------
  // OPEN PRODUCT DETAIL MODAL
  // ----------------------------------------------------
  const handleOpenProductDetail = (product) => {
    setActiveDrawerProduct(product);
    // Default selected badge in modal to either applied badge or recommendation
    const initialBadge =
      product.appliedBadge ||
      (product.recommendation?.badge !== "NONE" ? product.recommendation?.badge : "PRE_ORDER");
    setSelectedBadgeForProduct(initialBadge);
  };

  // ----------------------------------------------------
  // SINGLE PRODUCT APPLY (WITH MERCHANT CHOICE)
  // ----------------------------------------------------
  const handleApplySingle = async (product, badgeTypeToApply) => {
    if (!product) return;
    const badgeType = badgeTypeToApply || selectedBadgeForProduct || product.recommendation?.badge;
    if (!badgeType || badgeType === "NONE") return;

    setApplyingSingleId(product.productId);
    try {
      await applySmartBadgeApi(shop, product.productId, badgeType);

      setProducts((prev) =>
        prev.map((p) =>
          p.productId === product.productId
            ? { ...p, isApplied: true, appliedBadge: badgeType }
            : p
        )
      );

      const badgeName = BADGE_CONFIG[badgeType]?.badgeLabel || badgeType;
      setToastMsg(`✓ ${badgeName} badge applied to ${product.title}`);

      if (activeDrawerProduct?.productId === product.productId) {
        setActiveDrawerProduct((prev) => ({
          ...prev,
          isApplied: true,
          appliedBadge: badgeType,
        }));
      }
    } catch (err) {
      setToastMsg(`❌ ${err.message || "Failed to apply badge."}`);
    } finally {
      setApplyingSingleId(null);
    }
  };

  // ----------------------------------------------------
  // SINGLE PRODUCT DISABLE
  // ----------------------------------------------------
  const handleDisableSingle = async (product) => {
    if (!product) return;
    setApplyingSingleId(product.productId);
    try {
      await disableSmartBadgeApi(shop, product.productId, product.appliedBadge);

      setProducts((prev) =>
        prev.map((p) =>
          p.productId === product.productId
            ? { ...p, isApplied: false, appliedBadge: null }
            : p
        )
      );

      setToastMsg(`Badge removed from ${product.title}`);

      if (activeDrawerProduct?.productId === product.productId) {
        setActiveDrawerProduct((prev) => ({
          ...prev,
          isApplied: false,
          appliedBadge: null,
        }));
      }
    } catch (err) {
      setToastMsg(`❌ ${err.message || "Failed to disable badge."}`);
    } finally {
      setApplyingSingleId(null);
    }
  };

  // ----------------------------------------------------
  // FILTERING & SEARCH
  // ----------------------------------------------------
  const filteredProducts = useMemo(() => {
    const activeKey = TAB_KEYS[selectedTabIndex] || "ALL";

    return products.filter((item) => {
      // Tab filter
      if (activeKey !== "ALL") {
        if (activeKey === "NONE" && item.recommendation?.badge !== "NONE") return false;
        if (activeKey !== "NONE" && item.recommendation?.badge !== activeKey) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchHandle = item.handle?.toLowerCase().includes(query);
        if (!matchTitle && !matchHandle) return false;
      }

      // Confidence filter
      if (selectedConfidence !== "ALL") {
        if (item.recommendation?.confidence !== selectedConfidence) return false;
      }

      // Risk filter
      if (selectedRisk !== "ALL") {
        if (item.stockRisk !== selectedRisk) return false;
      }

      return true;
    });
  }, [products, selectedTabIndex, searchQuery, selectedConfidence, selectedRisk]);

  // ----------------------------------------------------
  // RENDER METRIC CARDS (WITH MERCHANT GUIDANCE)
  // ----------------------------------------------------
  const renderSummaryCards = () => {
    if (!summary && products.length === 0) return null;

    const totalScanned = summary?.scanned ?? summary?.productsScanned ?? products.length;
    const totalRecs = summary?.recommendations ?? products.filter((p) => p.recommendation?.badge !== "NONE").length;
    const appliedCount = products.filter((p) => p.isApplied).length;

    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
        {/* CARD 1: PRODUCTS SCANNED */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "8px",
          padding: "18px 20px",
          border: "1px solid #E1E3E5",
          boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#6D7175", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Products Scanned
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#202223", marginTop: "6px" }}>
              {totalScanned}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "10px" }}>
            Real active Shopify catalog items
          </div>
        </div>

        {/* CARD 2: ACTIONABLE RECOMMENDATIONS */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "8px",
          padding: "18px 20px",
          border: "1px solid #E1E3E5",
          boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#6D7175", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Recommended Badges
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#202223", marginTop: "6px" }}>
              {totalRecs}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "10px" }}>
            {totalScanned > 0 ? `${Math.round((totalRecs / totalScanned) * 100)}% of catalog qualifies` : "0%"}
          </div>
        </div>

        {/* CARD 3: ACTIVE APPLIED BADGES */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "8px",
          padding: "18px 20px",
          border: "1px solid #E1E3E5",
          boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#6D7175", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Applied on Storefront
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#202223", marginTop: "6px" }}>
              {appliedCount}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "10px" }}>
            Active product-specific badges
          </div>
        </div>

        {/* CARD 4: MERCHANT GUIDANCE CARD (RECOMMENDATIONS ONLY) */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "8px",
          padding: "18px 20px",
          border: "1px solid #E1E3E5",
          boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{
              fontSize: "11px",
              fontWeight: "600",
              color: "#6D7175",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span>💡 SMART RECOMMENDATIONS</span>
            </div>
            <div style={{ fontSize: "12px", color: "#202223", marginTop: "4px", lineHeight: "1.4" }}>
              We suggest the badge that may work best for each product.
            </div>
          </div>
          <div style={{ fontSize: "11px", color: "#6D7175", marginTop: "8px", lineHeight: "1.45" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span>✓</span> <span>Suggested based on live product data</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span>✓</span> <span>You have full control over final decision</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span>✓</span> <span>Choose any badge you prefer per product</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // TAB PILLS
  // ----------------------------------------------------
  const tabCounts = useMemo(() => {
    return {
      ALL: products.length,
      LOW_STOCK: products.filter((p) => p.recommendation?.badge === "LOW_STOCK").length,
      CLEARANCE: products.filter((p) => p.recommendation?.badge === "CLEARANCE").length,
      BUNDLE: products.filter((p) => p.recommendation?.badge === "BUNDLE").length,
      PROGRESSIVE_MARKDOWN: products.filter((p) => p.recommendation?.badge === "PROGRESSIVE_MARKDOWN").length,
      PRE_ORDER: products.filter((p) => p.recommendation?.badge === "PRE_ORDER").length,
      NONE: products.filter((p) => p.recommendation?.badge === "NONE").length,
    };
  }, [products]);

  const tabItems = [
    { key: "ALL", label: "All", count: tabCounts.ALL },
    { key: "PRE_ORDER", label: "🛒 Pre-Order", count: tabCounts.PRE_ORDER },
    { key: "PROGRESSIVE_MARKDOWN", label: "📉 Markdown", count: tabCounts.PROGRESSIVE_MARKDOWN },
    { key: "CLEARANCE", label: "🏷️ Clearance", count: tabCounts.CLEARANCE },
    { key: "BUNDLE", label: "📦 Bundle", count: tabCounts.BUNDLE },
    { key: "LOW_STOCK", label: "🔥 Low Stock", count: tabCounts.LOW_STOCK },
    { key: "NONE", label: "⚪ No Badge", count: tabCounts.NONE },
  ];

  // ----------------------------------------------------
  // MAIN RENDER
  // ----------------------------------------------------
  return (
    <Frame>
      <Page
        fullWidth
        title="Smart Badge Recommendations"
        subtitle="Scan your products and automatically find the best badge for each product."
        primaryAction={{
          content: scanning ? "Scanning products..." : "Scan All Products",
          onAction: handleScanProducts,
          loading: scanning,
          disabled: loading,
        }}
        secondaryActions={[
          {
            content: "Refresh",
            icon: RefreshIcon,
            onAction: loadInitialData,
            loading,
            disabled: scanning,
          },
        ]}
      >
        <BlockStack gap="400">
          {/* ERROR BANNER */}
          {errorMsg && (
            <Banner
              title="Scan Failed"
              tone="critical"
              onDismiss={() => setErrorMsg(null)}
            >
              <p>{errorMsg}</p>
              <div style={{ marginTop: "8px" }}>
                <Button onClick={handleScanProducts} size="slim">
                  Try Again
                </Button>
              </div>
            </Banner>
          )}

          {/* SCANNING STATE */}
          {scanning && (
            <Card>
              <BlockStack gap="300" align="center">
                <Spinner size="large" />
                <Text variant="headingMd" as="h3" alignment="center">
                  Scanning Shopify products & live sales data...
                </Text>
                <Text variant="bodySm" tone="subdued" alignment="center">
                  Analyzing real inventory levels, sales velocity, stockout risks, and co-purchase pairings.
                </Text>
                <ProgressBar size="small" />
              </BlockStack>
            </Card>
          )}

          {/* SUMMARY METRIC CARDS */}
          {!scanning && renderSummaryCards()}

          {/* MERCHANT GUIDANCE HELPER BANNER */}
          {!scanning && products.length > 0 && (
            <div style={{
              background: "#F7F8F9",
              border: "1px solid #E1E3E5",
              borderRadius: "8px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ fontSize: "15px" }}>💡</span>
              <div style={{ fontSize: "13px", color: "#303030", lineHeight: "1.4" }}>
                <strong>Smart Stock analyzes your product data and suggests the badge that may work best.</strong> These recommendations are for guidance only — we suggest the badge that may work best based on inventory and velocity, but the final decision is yours.
              </div>
            </div>
          )}

          {/* MAIN PRODUCT TABLE CONTAINER */}
          {!scanning && products.length > 0 && (
            <div style={{
              background: "#FFFFFF",
              borderRadius: "8px",
              border: "1px solid #E1E3E5",
              boxShadow: "0 1px 0 rgba(0,0,0,0.05)",
              overflow: "hidden"
            }}>
              {/* TAB PILLS HEADER */}
              <div style={{
                display: "flex",
                gap: "8px",
                padding: "10px 14px",
                borderBottom: "1px solid #E1E3E5",
                background: "#F7F8F9",
                overflowX: "auto",
                whiteSpace: "nowrap"
              }}>
                {tabItems.map((tab) => {
                  const isActive = (TAB_KEYS[selectedTabIndex] || "ALL") === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        const targetIdx = TAB_KEYS.indexOf(tab.key);
                        if (targetIdx !== -1) setSelectedTabIndex(targetIdx);
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        fontWeight: isActive ? "600" : "500",
                        color: isActive ? "#FFFFFF" : "#5C5F62",
                        background: isActive ? "#303030" : "#FFFFFF",
                        border: isActive ? "1px solid #303030" : "1px solid #D2D5D8",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{tab.label}</span>
                      <span style={{
                        background: isActive ? "rgba(255,255,255,0.2)" : "#F1F2F4",
                        color: isActive ? "#FFFFFF" : "#5C5F62",
                        padding: "1px 6px",
                        borderRadius: "8px",
                        fontSize: "10px",
                        fontWeight: "700"
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* SEARCH & FILTERS BAR */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "minmax(240px, 2fr) minmax(140px, 1fr) minmax(140px, 1fr)",
                gap: "12px",
                padding: "12px 16px",
                borderBottom: "1px solid #E1E3E5",
                background: "#FFFFFF"
              }}>
                <TextField
                  placeholder="Search products by title or handle..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  prefix={<SearchIcon width="16" height="16" />}
                  clearButton
                  onClearButtonClick={() => setSearchQuery("")}
                  autoComplete="off"
                />
                <Select
                  label="Confidence"
                  labelHidden
                  options={[
                    { label: "All Confidence", value: "ALL" },
                    { label: "High Confidence", value: "HIGH" },
                    { label: "Medium Confidence", value: "MEDIUM" },
                    { label: "Low Confidence", value: "LOW" },
                  ]}
                  value={selectedConfidence}
                  onChange={setSelectedConfidence}
                />
                <Select
                  label="Stock Risk"
                  labelHidden
                  options={[
                    { label: "All Stock Risks", value: "ALL" },
                    { label: "Critical Risk", value: "CRITICAL" },
                    { label: "High Risk", value: "HIGH" },
                    { label: "Medium Risk", value: "MEDIUM" },
                    { label: "Safe Stock", value: "SAFE" },
                  ]}
                  value={selectedRisk}
                  onChange={setSelectedRisk}
                />
              </div>

              {/* RESPONSIVE FULLY SIZED TABLE */}
              <div style={{ overflowX: "auto", width: "100%" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "13px",
                }}>
                  <thead>
                    <tr style={{
                      background: "#F7F8F9",
                      borderBottom: "1px solid #E1E3E5",
                      color: "#6D7175",
                      fontSize: "11px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      <th style={{ padding: "12px 16px", width: "30%" }}>Product</th>
                      <th style={{ padding: "12px 12px", width: "10%" }}>Inventory</th>
                      <th style={{ padding: "12px 12px", width: "10%" }}>Velocity</th>
                      <th style={{ padding: "12px 12px", width: "10%" }}>Stock Risk</th>
                      <th style={{ padding: "12px 12px", width: "14%" }}>Suggested Badge</th>
                      <th style={{ padding: "12px 12px", width: "8%" }}>Score</th>
                      <th style={{ padding: "12px 16px", width: "18%" }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#6D7175" }}>
                          No products found matching the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product, idx) => {
                        const {
                          productId,
                          title,
                          handle,
                          image,
                          inventory,
                          salesVelocity,
                          stockRisk,
                          recommendation,
                          isApplied,
                        } = product;

                        const badgeInfo = BADGE_CONFIG[recommendation?.badge] || BADGE_CONFIG.NONE;
                        const isNone = recommendation?.badge === "NONE";

                        const rawInv = Number(inventory) || 0;
                        const displayInv = Math.max(0, rawInv);

                        let riskColor = "#303030";
                        let riskBg = "#F1F2F4";
                        let riskBorder = "#D2D5D8";
                        if (stockRisk === "CRITICAL" || stockRisk === "HIGH") {
                          riskColor = "#D82C0D";
                          riskBg = "#FFF4F2";
                          riskBorder = "#FED3D1";
                        } else if (stockRisk === "MEDIUM") {
                          riskColor = "#916A00";
                          riskBg = "#FFF8DB";
                          riskBorder = "#FFECA1";
                        }

                        return (
                          <tr
                            key={productId || idx}
                            style={{
                              borderBottom: "1px solid #E1E3E5",
                              background: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                              transition: "background 0.15s ease",
                            }}
                          >
                            {/* PRODUCT INFO */}
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ flexShrink: 0 }}>
                                  <Thumbnail
                                    source={image || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
                                    alt={title}
                                    size="small"
                                  />
                                </div>
                                <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
                                  <div
                                    style={{
                                      color: "#202223",
                                      fontWeight: "600",
                                      fontSize: "13px",
                                      lineHeight: "1.4",
                                    }}
                                  >
                                    {title}
                                  </div>
                                  {handle && (
                                    <div style={{ fontSize: "11px", color: "#6D7175", marginTop: "2px" }}>
                                      /{handle}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* INVENTORY */}
                            <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                              <span style={{
                                fontWeight: displayInv === 0 ? "600" : "400",
                                color: displayInv === 0 ? "#D82C0D" : "#202223"
                              }}>
                                {displayInv} {displayInv === 1 ? "unit" : "units"}
                              </span>
                            </td>

                            {/* SALES VELOCITY */}
                            <td style={{ padding: "12px 12px", whiteSpace: "nowrap", color: "#5C5F62" }}>
                              {salesVelocity != null ? `${Number(salesVelocity).toFixed(2)}/d` : "0.00/d"}
                            </td>

                            {/* STOCK RISK */}
                            <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                              <span style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: "600",
                                background: riskBg,
                                color: riskColor,
                                border: `1px solid ${riskBorder}`,
                              }}>
                                {stockRisk || "SAFE"}
                              </span>
                            </td>

                            {/* BEST BADGE (SUGGESTED) */}
                            <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                              {isNone ? (
                                <span style={{ color: "#6D7175", fontSize: "12px" }}>No Badge</span>
                              ) : (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    background: badgeInfo.bg,
                                    color: badgeInfo.color,
                                    border: `1px solid ${badgeInfo.border}`,
                                  }}>
                                    {badgeInfo.badgeLabel}
                                  </span>
                                  {isApplied && (
                                    <span style={{
                                      fontSize: "10px",
                                      fontWeight: "600",
                                      color: "#1B5E20",
                                      background: "#F1F8F5",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      border: "1px solid #C8E6C9",
                                    }}>
                                      ✓ Active
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* SCORE & CONFIDENCE */}
                            <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                              {isNone ? (
                                <span style={{ color: "#6D7175" }}>—</span>
                              ) : (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <strong style={{ color: "#202223", fontSize: "13px" }}>
                                    {recommendation?.score ?? 0}
                                  </strong>
                                  {recommendation?.confidence && (
                                    <span style={{
                                      fontSize: "10px",
                                      fontWeight: "600",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      background: recommendation.confidence === "HIGH" ? "#F1F8F5" : "#FFF8DB",
                                      color: recommendation.confidence === "HIGH" ? "#1B5E20" : "#916A00",
                                      border: recommendation.confidence === "HIGH" ? "1px solid #C8E6C9" : "1px solid #FFECA1",
                                    }}>
                                      {recommendation.confidence}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* REASON */}
                            <td style={{ padding: "12px 16px" }}>
                              <div
                                title={recommendation?.reason || "Product is performing normally."}
                                style={{
                                  fontSize: "12px",
                                  color: isNone ? "#6D7175" : "#5C5F62",
                                  lineHeight: "1.4",
                                }}
                              >
                                {recommendation?.reason || "Product is performing normally."}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INITIAL EMPTY STATE */}
          {!scanning && !loading && products.length === 0 && (
            <Card>
              <EmptyState
                heading="Find the best badge for every product automatically"
                action={{
                  content: "🔍 Scan All Products",
                  onAction: handleScanProducts,
                  loading: scanning,
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Smart Stock will analyze your real Shopify inventory, sales velocity, stockout risks, and co-purchase order relationships to recommend the single most effective badge for each product.
                </p>
              </EmptyState>
            </Card>
          )}
        </BlockStack>


        {/* TOAST NOTIFICATION */}
        {toastMsg && (
          <Toast content={toastMsg} onDismiss={() => setToastMsg(null)} duration={4000} />
        )}
      </Page>
    </Frame>
  );
}
