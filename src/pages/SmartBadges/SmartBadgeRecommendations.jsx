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
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FCA5A5",
    description: "Display urgent low stock counter on storefront when inventory is below threshold.",
  },
  CLEARANCE: {
    label: "Clearance",
    badgeLabel: "🏷️ Clearance Sale",
    tone: "warning",
    icon: "🏷️",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FCD34D",
    description: "Apply fixed clearance discount to liquidate stagnant or high-value surplus inventory.",
  },
  BUNDLE: {
    label: "Bundle Offer",
    badgeLabel: "📦 Bundle Offer",
    tone: "info",
    icon: "📦",
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#93C5FD",
    description: "Pair with frequently co-purchased companion items for bundle & save offer.",
  },
  PROGRESSIVE_MARKDOWN: {
    label: "Markdown",
    badgeLabel: "📉 Markdown",
    tone: "attention",
    icon: "📉",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#C4B5FD",
    description: "Automatically increase discount progressively over time until target sales are reached.",
  },
  PRE_ORDER: {
    label: "Pre-Order",
    badgeLabel: "🛒 Pre-Order",
    tone: "success",
    icon: "🛒",
    color: "#059669",
    bg: "#ECFDF5",
    border: "#6EE7B7",
    description: "Allow customers to pre-order out-of-stock or upcoming items with deposit percentage.",
  },
  NONE: {
    label: "No Badge",
    badgeLabel: "No Badge",
    tone: "subdued",
    icon: "⚪",
    color: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
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
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Products Scanned
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#0F172A", marginTop: "8px" }}>
              {totalScanned}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "12px" }}>
            Real active Shopify catalog items
          </div>
        </div>

        {/* CARD 2: ACTIONABLE RECOMMENDATIONS */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #BBF7D0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>⚡ Recommended Badges</span>
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#15803D", marginTop: "8px" }}>
              {totalRecs}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#16A34A", marginTop: "12px", fontWeight: "500" }}>
            {totalScanned > 0 ? `${Math.round((totalRecs / totalScanned) * 100)}% of your catalog qualifies` : "0%"}
          </div>
        </div>

        {/* CARD 3: ACTIVE APPLIED BADGES */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Applied on Storefront
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: appliedCount > 0 ? "#2563EB" : "#64748B", marginTop: "8px" }}>
              {appliedCount}
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "12px" }}>
            Active product-specific badges
          </div>
        </div>

        {/* CARD 4: MERCHANT GUIDANCE CARD (RECOMMENDATIONS ONLY) */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          padding: "18px 20px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "#2563EB",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span>💡 SMART RECOMMENDATIONS</span>
            </div>
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px", lineHeight: "1.45" }}>
              We analyze each product and suggest the badge that may work best for it.
            </div>
          </div>
          <div style={{ fontSize: "11px", color: "#64748B", marginTop: "10px", lineHeight: "1.5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#166534" }}>
              <span>✓</span> <span>Suggested based on live product data</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#166534" }}>
              <span>✓</span> <span>You have full control over final decision</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#166534" }}>
              <span>✓</span> <span>Choose any badge you want for each product</span>
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
  // PRODUCT DETAIL MODAL (WITH BADGE CHOICE)
  // ----------------------------------------------------
  const renderDetailModal = () => {
    if (!activeDrawerProduct) return null;
    const p = activeDrawerProduct;
    const recommendedBadge = p.recommendation?.badge || "NONE";
    const recommendedInfo = BADGE_CONFIG[recommendedBadge] || BADGE_CONFIG.NONE;
    const chosenBadge = selectedBadgeForProduct || recommendedBadge;
    const chosenInfo = BADGE_CONFIG[chosenBadge] || BADGE_CONFIG.NONE;
    const isCurrentlyApplying = applyingSingleId === p.productId;

    return (
      <Modal
        open={Boolean(activeDrawerProduct)}
        onClose={() => setActiveDrawerProduct(null)}
        title={p.title}
        primaryAction={{
          content: p.isApplied && chosenBadge === p.appliedBadge
            ? "Update Badge"
            : `Apply ${chosenInfo.label || "Badge"}`,
          onAction: () => handleApplySingle(p, chosenBadge),
          loading: isCurrentlyApplying,
        }}
        secondaryActions={[
          ...(p.isApplied
            ? [
                {
                  content: "Remove Active Badge",
                  destructive: true,
                  onAction: () => handleDisableSingle(p),
                  loading: isCurrentlyApplying,
                },
              ]
            : []),
          {
            content: "Close",
            onAction: () => setActiveDrawerProduct(null),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* PRODUCT HEADER */}
            <InlineStack gap="400" align="start">
              <Thumbnail
                source={p.image || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
                alt={p.title}
                size="large"
              />
              <BlockStack gap="100">
                <Text variant="headingMd" as="h3">
                  {p.title}
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={p.isApplied ? "success" : "subdued"}>
                    {p.isApplied ? `Active on Storefront: ${BADGE_CONFIG[p.appliedBadge]?.badgeLabel || p.appliedBadge}` : "No Badge Applied"}
                  </Badge>
                  {p.stockRisk && (
                    <Badge tone={p.stockRisk === "CRITICAL" ? "critical" : p.stockRisk === "HIGH" ? "warning" : "info"}>
                      Stock Risk: {p.stockRisk}
                    </Badge>
                  )}
                </InlineStack>
              </BlockStack>
            </InlineStack>

            <Divider />

            {/* SYSTEM RECOMMENDATION BANNER */}
            <Card background="bg-surface-secondary">
              <BlockStack gap="200">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px" }}>💡</span>
                    <strong style={{ fontSize: "13px", color: "#1E293B" }}>
                      System Suggested Badge:
                    </strong>
                    <span style={{
                      display: "inline-block",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                      background: recommendedInfo.bg,
                      color: recommendedInfo.color,
                      border: `1px solid ${recommendedInfo.border}`,
                    }}>
                      {recommendedInfo.badgeLabel}
                    </span>
                  </div>
                  {p.recommendation?.score > 0 && (
                    <span style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#166534",
                      background: "#DCFCE7",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}>
                      Score: {p.recommendation.score}/100 ({p.recommendation.confidence})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", lineHeight: "1.45" }}>
                  {p.recommendation?.reason || "Based on sales velocity, inventory coverage, and demand analysis."}
                </div>
                <div style={{ fontSize: "11px", color: "#2563EB", fontWeight: "500", marginTop: "2px" }}>
                  💡 This is a suggestion only — you can select and apply any badge below.
                </div>
              </BlockStack>
            </Card>

            {/* CHOOSE BADGE FOR THIS PRODUCT */}
            <Card padding="300">
              <BlockStack gap="200">
                <Text variant="headingSm" as="h4">
                  Select Badge to Apply:
                </Text>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                  {ALL_BADGE_OPTIONS.map((opt) => {
                    const isSelected = chosenBadge === opt.value;
                    const isRecommended = recommendedBadge === opt.value;
                    const bConfig = BADGE_CONFIG[opt.value];

                    return (
                      <div
                        key={opt.value}
                        onClick={() => setSelectedBadgeForProduct(opt.value)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: isSelected ? "2px solid #2563EB" : "1px solid #E2E8F0",
                          background: isSelected ? "#EFF6FF" : "#FFFFFF",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ fontSize: "13px", color: isSelected ? "#1E40AF" : "#0F172A" }}>
                              {opt.label}
                            </strong>
                            {isRecommended && (
                              <span style={{
                                fontSize: "10px",
                                fontWeight: "700",
                                background: "#DCFCE7",
                                color: "#166534",
                                padding: "1px 6px",
                                borderRadius: "4px",
                              }}>
                                ★ Suggested
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                            {bConfig?.description}
                          </div>
                        </div>
                        <div style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          border: isSelected ? "5px solid #2563EB" : "2px solid #CBD5E1",
                          background: "#FFFFFF",
                          flexShrink: 0,
                        }} />
                      </div>
                    );
                  })}
                </div>
              </BlockStack>
            </Card>

            {/* LIVE METRICS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodyXs" tone="subdued">Total Inventory</Text>
                <Text variant="headingMd" as="h4">{Math.max(0, p.inventory || 0)} units</Text>
              </Box>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodyXs" tone="subdued">Sales Velocity</Text>
                <Text variant="headingMd" as="h4">{Number(p.salesVelocity || 0).toFixed(2)}/day</Text>
              </Box>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodyXs" tone="subdued">30-Day Units Sold</Text>
                <Text variant="headingMd" as="h4">{p.unitsSold30d || 0} units</Text>
              </Box>
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>
    );
  };

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
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ fontSize: "16px" }}>💡</span>
              <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.4" }}>
                <strong>Smart Stock analyzes your product data and suggests the badge that may work best.</strong> These recommendations are for guidance only — you are always free to click any product to review or apply any badge you prefer.
              </div>
            </div>
          )}

          {/* MAIN PRODUCT TABLE CONTAINER */}
          {!scanning && products.length > 0 && (
            <div style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              overflow: "hidden"
            }}>
              {/* TAB PILLS HEADER */}
              <div style={{
                display: "flex",
                gap: "8px",
                padding: "12px 16px",
                borderBottom: "1px solid #E2E8F0",
                background: "#F8FAFC",
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
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "13px",
                        fontWeight: isActive ? "700" : "500",
                        color: isActive ? "#0F172A" : "#64748B",
                        background: isActive ? "#FFFFFF" : "transparent",
                        border: isActive ? "1px solid #CBD5E1" : "1px solid transparent",
                        boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{tab.label}</span>
                      <span style={{
                        background: isActive ? "#E2E8F0" : "#F1F5F9",
                        color: isActive ? "#1E293B" : "#64748B",
                        padding: "1px 6px",
                        borderRadius: "10px",
                        fontSize: "11px",
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
                borderBottom: "1px solid #E2E8F0",
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
                      background: "#F8FAFC",
                      borderBottom: "1px solid #E2E8F0",
                      color: "#64748B",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      <th style={{ padding: "14px 16px", width: "30%" }}>Product</th>
                      <th style={{ padding: "14px 12px", width: "10%" }}>Inventory</th>
                      <th style={{ padding: "14px 12px", width: "10%" }}>Velocity</th>
                      <th style={{ padding: "14px 12px", width: "10%" }}>Stock Risk</th>
                      <th style={{ padding: "14px 12px", width: "14%" }}>Suggested Badge</th>
                      <th style={{ padding: "14px 12px", width: "8%" }}>Score</th>
                      <th style={{ padding: "14px 16px", width: "18%" }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#64748B" }}>
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

                        let riskColor = "#16A34A";
                        let riskBg = "#DCFCE7";
                        if (stockRisk === "CRITICAL") {
                          riskColor = "#DC2626";
                          riskBg = "#FEE2E2";
                        } else if (stockRisk === "HIGH") {
                          riskColor = "#D97706";
                          riskBg = "#FEF3C7";
                        } else if (stockRisk === "MEDIUM") {
                          riskColor = "#4F46E5";
                          riskBg = "#EEF2FF";
                        }

                        return (
                          <tr
                            key={productId || idx}
                            onClick={() => handleOpenProductDetail(product)}
                            style={{
                              borderBottom: "1px solid #F1F5F9",
                              background: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                              cursor: "pointer",
                              transition: "background 0.15s ease",
                            }}
                          >
                            {/* PRODUCT INFO */}
                            <td style={{ padding: "14px 16px" }}>
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
                                      color: "#0F172A",
                                      fontWeight: "600",
                                      fontSize: "13px",
                                      lineHeight: "1.4",
                                    }}
                                  >
                                    {title}
                                  </div>
                                  {handle && (
                                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                                      /{handle}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* INVENTORY */}
                            <td style={{ padding: "14px 12px", whiteSpace: "nowrap" }}>
                              <span style={{
                                fontWeight: displayInv === 0 ? "700" : "500",
                                color: displayInv === 0 ? "#DC2626" : "#334155"
                              }}>
                                {displayInv} {displayInv === 1 ? "unit" : "units"}
                              </span>
                            </td>

                            {/* SALES VELOCITY */}
                            <td style={{ padding: "14px 12px", whiteSpace: "nowrap", color: "#334155" }}>
                              {salesVelocity != null ? `${Number(salesVelocity).toFixed(2)}/d` : "0.00/d"}
                            </td>

                            {/* STOCK RISK */}
                            <td style={{ padding: "14px 12px", whiteSpace: "nowrap" }}>
                              <span style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "700",
                                background: riskBg,
                                color: riskColor,
                              }}>
                                {stockRisk || "SAFE"}
                              </span>
                            </td>

                            {/* BEST BADGE (SUGGESTED) */}
                            <td style={{ padding: "14px 12px", whiteSpace: "nowrap" }}>
                              {isNone ? (
                                <span style={{ color: "#94A3B8", fontSize: "12px" }}>No Badge</span>
                              ) : (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    fontWeight: "700",
                                    background: badgeInfo.bg,
                                    color: badgeInfo.color,
                                    border: `1px solid ${badgeInfo.border}`,
                                  }}>
                                    {badgeInfo.badgeLabel}
                                  </span>
                                  {isApplied && (
                                    <span style={{
                                      fontSize: "10px",
                                      fontWeight: "700",
                                      color: "#166534",
                                      background: "#DCFCE7",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      border: "1px solid #BBF7D0",
                                    }}>
                                      ✓ Active
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* SCORE & CONFIDENCE */}
                            <td style={{ padding: "14px 12px", whiteSpace: "nowrap" }}>
                              {isNone ? (
                                <span style={{ color: "#94A3B8" }}>—</span>
                              ) : (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <strong style={{ color: "#0F172A", fontSize: "13px" }}>
                                    {recommendation?.score ?? 0}
                                  </strong>
                                  {recommendation?.confidence && (
                                    <span style={{
                                      fontSize: "10px",
                                      fontWeight: "700",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      background: recommendation.confidence === "HIGH" ? "#DCFCE7" : "#FEF3C7",
                                      color: recommendation.confidence === "HIGH" ? "#15803D" : "#B45309",
                                    }}>
                                      {recommendation.confidence}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* REASON */}
                            <td style={{ padding: "14px 16px" }}>
                              <div
                                title={recommendation?.reason || "Product is performing normally."}
                                style={{
                                  fontSize: "12px",
                                  color: isNone ? "#94A3B8" : "#475569",
                                  lineHeight: "1.45",
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

        {/* PRODUCT DETAIL MODAL WITH BADGE PICKER */}
        {renderDetailModal()}

        {/* TOAST NOTIFICATION */}
        {toastMsg && (
          <Toast content={toastMsg} onDismiss={() => setToastMsg(null)} duration={4000} />
        )}
      </Page>
    </Frame>
  );
}
