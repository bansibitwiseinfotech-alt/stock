import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  InlineGrid,
} from "@shopify/polaris";
import ClearanceSaleCustomizeModal from "../../components/ClearanceSaleCustomizeModal";
import BundleCustomizeModal from "../../components/BundleCustomizeModal";
import MarkdownCustomizeModal from "../../components/MarkdownCustomizeModal";
import LowStockCustomizeModal from "../../components/LowStockCustomizeModal";
import PreOrderCustomizeModal from "../../components/PreOrderCustomizeModal";
import {
  fetchClearanceSaleConfigApi,
  saveClearanceSaleConfigApi,
  fetchBundleConfigApi,
  saveBundleConfigApi,
  fetchMarkdownConfigApi,
  saveMarkdownConfigApi,
  fetchLowStockConfigApi,
  saveLowStockConfigApi,
  fetchPreOrderConfigApi,
  savePreOrderConfigApi,
} from "../../services/appApi";

export default function CustomizationIndex({ shopDomain = "", initialConfig = null }) {
  const [config, setConfig] = useState(
    initialConfig || {
      enabled: true,
      badgeTitle: "Clearance Sale",
      supportingText: "Limited time offer",
    }
  );
  const [bundleConfig, setBundleConfig] = useState({
    enabled: true,
    headerTitle: "Frequently Bought Together",
    buttonText: "Add Both to Cart",
    showDiscountBadge: true,
  });
  const [markdownConfig, setMarkdownConfig] = useState({
    enabled: true,
    badgeText: "{discount}% OFF",
    showStrikethroughPrice: true,
    badgeBackgroundColor: "#E53935",
    badgeTextColor: "#FFFFFF",
  });
  const [lowStockConfig, setLowStockConfig] = useState({
    enabled: true,
    badgeText: "🔥 Only {stock} left in stock!",
    subtext: "Selling fast – high demand detected.",
    threshold: 5,
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
    textColor: "#991B1B",
    subtextColor: "#B91C1C",
  });
  const [preOrderConfig, setPreOrderConfig] = useState({
    enabled: true,
    buttonText: "PRE-ORDER NOW",
    badgeText: "🛒 PRE-ORDER",
    launchLabel: "NEW LAUNCH",
    cardBackgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    textColor: "#111827",
    accentColor: "#4F46E5",
    badgeBackgroundColor: "#0F172A",
    badgeTextColor: "#FFFFFF",
    borderRadius: 12,
  });

  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [togglingBundle, setTogglingBundle] = useState(false);
  const [togglingMarkdown, setTogglingMarkdown] = useState(false);
  const [togglingLowStock, setTogglingLowStock] = useState(false);
  const [togglingPreOrder, setTogglingPreOrder] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null);
  const [customizeSaleOpen, setCustomizeSaleOpen] = useState(false);
  const [customizeBundleOpen, setCustomizeBundleOpen] = useState(false);
  const [customizeMarkdownOpen, setCustomizeMarkdownOpen] = useState(false);
  const [customizeLowStockOpen, setCustomizeLowStockOpen] = useState(false);
  const [customizePreOrderOpen, setCustomizePreOrderOpen] = useState(false);

  useEffect(() => {
    if (shopDomain) {
      setLoading(true);
      Promise.all([
        !initialConfig ? fetchClearanceSaleConfigApi(shopDomain).catch(() => null) : Promise.resolve(initialConfig),
        fetchBundleConfigApi(shopDomain).catch(() => null),
        fetchMarkdownConfigApi(shopDomain).catch(() => null),
        fetchLowStockConfigApi(shopDomain).catch(() => null),
        fetchPreOrderConfigApi(shopDomain).catch(() => null),
      ])
        .then(([saleData, bData, mData, lsData, poData]) => {
          if (saleData) setConfig(saleData);
          if (bData) setBundleConfig(bData);
          if (mData) setMarkdownConfig(mData);
          if (lsData) setLowStockConfig(lsData);
          if (poData) setPreOrderConfig(poData);
        })
        .finally(() => setLoading(false));
    }
  }, [shopDomain, initialConfig]);

  const handleToggleStatus = async () => {
    const nextState = !config.enabled;
    setToggling(true);
    try {
      const updated = await saveClearanceSaleConfigApi(shopDomain, {
        ...config,
        enabled: nextState,
      });
      if (updated && updated.data) {
        setConfig(updated.data);
      } else {
        setConfig((prev) => ({ ...prev, enabled: nextState }));
      }
      setBannerMessage({
        tone: "success",
        text: nextState
          ? "Clearance Sale storefront component is now enabled."
          : "Clearance Sale storefront component is now disabled.",
      });
    } catch (err) {
      setBannerMessage({
        tone: "critical",
        text: "Failed to update Clearance Sale status.",
      });
    } finally {
      setToggling(false);
    }
  };

  const handleToggleBundleStatus = async () => {
    const nextState = !bundleConfig.enabled;
    setTogglingBundle(true);
    try {
      const updated = await saveBundleConfigApi(shopDomain, {
        ...bundleConfig,
        enabled: nextState,
      });
      if (updated && updated.data) {
        setBundleConfig(updated.data);
      } else {
        setBundleConfig((prev) => ({ ...prev, enabled: nextState }));
      }
      setBannerMessage({
        tone: "success",
        text: nextState
          ? "Bundle Offer storefront component is now enabled."
          : "Bundle Offer storefront component is now disabled.",
      });
    } catch (err) {
      setBannerMessage({
        tone: "critical",
        text: "Failed to update Bundle Offer status.",
      });
    } finally {
      setTogglingBundle(false);
    }
  };

  const handleToggleMarkdownStatus = async () => {
    const nextState = !markdownConfig.enabled;
    setTogglingMarkdown(true);
    try {
      const updated = await saveMarkdownConfigApi(shopDomain, {
        ...markdownConfig,
        enabled: nextState,
      });
      if (updated && updated.data) {
        setMarkdownConfig(updated.data);
      } else {
        setMarkdownConfig((prev) => ({ ...prev, enabled: nextState }));
      }
      setBannerMessage({
        tone: "success",
        text: nextState
          ? "Progressive Markdown storefront component is now enabled."
          : "Progressive Markdown storefront component is now disabled.",
      });
    } catch (err) {
      setBannerMessage({
        tone: "critical",
        text: "Failed to update Progressive Markdown status.",
      });
    } finally {
      setTogglingMarkdown(false);
    }
  };

  const handleToggleLowStockStatus = async () => {
    const nextState = !lowStockConfig.enabled;
    setTogglingLowStock(true);
    try {
      const updated = await saveLowStockConfigApi(shopDomain, {
        ...lowStockConfig,
        enabled: nextState,
      });
      if (updated && updated.data) {
        setLowStockConfig(updated.data);
      } else {
        setLowStockConfig((prev) => ({ ...prev, enabled: nextState }));
      }
      setBannerMessage({
        tone: "success",
        text: nextState
          ? "Low Stock Badge storefront component is now enabled."
          : "Low Stock Badge storefront component is now disabled.",
      });
    } catch (err) {
      setBannerMessage({
        tone: "critical",
        text: "Failed to update Low Stock Badge status.",
      });
    } finally {
      setTogglingLowStock(false);
    }
  };

  const handleTogglePreOrderStatus = async () => {
    const nextState = !preOrderConfig.enabled;
    setTogglingPreOrder(true);
    try {
      const updated = await savePreOrderConfigApi(shopDomain, {
        ...preOrderConfig,
        enabled: nextState,
      });
      if (updated && updated.data) {
        setPreOrderConfig(updated.data);
      } else {
        setPreOrderConfig((prev) => ({ ...prev, enabled: nextState }));
      }
      setBannerMessage({
        tone: "success",
        text: nextState
          ? "Pre-Order storefront component is now enabled."
          : "Pre-Order storefront component is now disabled.",
      });
    } catch (err) {
      setBannerMessage({
        tone: "critical",
        text: "Failed to update Pre-Order status.",
      });
    } finally {
      setTogglingPreOrder(false);
    }
  };

  const themeEditorUrl = shopDomain
    ? `https://${shopDomain}/admin/themes/current/editor?context=apps`
    : "#";

  return (
    <Page
      fullWidth
      title="Storefront Customization"
      subtitle="Control how promotional badges, bundle widgets, pre-order launches, and progressive discounts appear to customers on your live store."
    >
      <Layout>
        {bannerMessage && (
          <Layout.Section>
            <Banner
              tone={bannerMessage.tone}
              onDismiss={() => setBannerMessage(null)}
            >
              <p>{bannerMessage.text}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* App Embed Status Card */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center" wrap>
              <InlineStack gap="300" blockAlign="center">
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "10px",
                    backgroundColor: "#EEF2FF",
                    color: "#4F46E5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  ⚡
                </div>
                <BlockStack gap="050">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingSm" as="h2">
                      Storefront App Embed Status
                    </Text>
                    <Badge tone="success">● Connected & Active</Badge>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    Smart Stock App Embed injects dynamic promotions directly into your storefront theme without touching code.
                  </Text>
                </BlockStack>
              </InlineStack>

              <Button
                url={themeEditorUrl}
                target="_blank"
                external
                variant="secondary"
              >
                Open Theme Customizer
              </Button>
            </InlineStack>
          </Card>
        </Layout.Section>

        {/* Storefront Feature Card Grid */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3, lg: 3 }} gap="400">
            {/* 🏷️ CLEARANCE SALE CARD */}
            <Card>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "260px",
                  gap: "16px",
                }}
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <span style={{ fontSize: "20px" }}>🏷️</span>
                      <Text variant="headingSm" as="h3">
                        Clearance Sale
                      </Text>
                    </InlineStack>
                    <Badge tone={config.enabled ? "success" : "subdued"}>
                      {config.enabled ? "● Enabled" : "○ Disabled"}
                    </Badge>
                  </InlineStack>

                  <Text variant="bodySm" tone="subdued">
                    Renders an eye-catching clearance badge and urgency banner on discounted excess stock items.
                  </Text>

                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                      color: "#475569",
                    }}
                  >
                    <strong>Title:</strong> {config.badgeTitle || "Clearance Sale"} <br />
                    <strong>Subtext:</strong> {config.supportingText || "Limited time offer"}
                  </div>
                </BlockStack>

                <BlockStack gap="200">
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Button
                      size="slim"
                      variant="plain"
                      tone={config.enabled ? "critical" : "success"}
                      onClick={handleToggleStatus}
                      loading={toggling}
                      disabled={loading}
                    >
                      {config.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="primary"
                      size="slim"
                      onClick={() => setCustomizeSaleOpen(true)}
                    >
                      Customize Style
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            </Card>

            {/* 📦 BUNDLE OFFER (FREQUENTLY BOUGHT TOGETHER) CARD */}
            <Card>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "260px",
                  gap: "16px",
                }}
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <span style={{ fontSize: "20px" }}>📦</span>
                      <Text variant="headingSm" as="h3">
                        Bundle Offer (FBT)
                      </Text>
                    </InlineStack>
                    <Badge tone={bundleConfig.enabled ? "success" : "subdued"}>
                      {bundleConfig.enabled ? "● Enabled" : "○ Disabled"}
                    </Badge>
                  </InlineStack>

                  <Text variant="bodySm" tone="subdued">
                    Displays a "Frequently Bought Together" combo widget with 1-click cart addition.
                  </Text>

                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                      color: "#475569",
                    }}
                  >
                    <strong>Heading:</strong> {bundleConfig.headerTitle || "Frequently Bought Together"} <br />
                    <strong>Button:</strong> {bundleConfig.buttonText || "Add Both to Cart"}
                  </div>
                </BlockStack>

                <BlockStack gap="200">
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Button
                      size="slim"
                      variant="plain"
                      tone={bundleConfig.enabled ? "critical" : "success"}
                      onClick={handleToggleBundleStatus}
                      loading={togglingBundle}
                      disabled={loading}
                    >
                      {bundleConfig.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="primary"
                      size="slim"
                      onClick={() => setCustomizeBundleOpen(true)}
                    >
                      Customize Style
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            </Card>

            {/* 📉 PROGRESSIVE MARKDOWN CARD */}
            <Card>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "260px",
                  gap: "16px",
                }}
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <span style={{ fontSize: "20px" }}>📉</span>
                      <Text variant="headingSm" as="h3">
                        Progressive Markdown
                      </Text>
                    </InlineStack>
                    <Badge tone={markdownConfig.enabled ? "success" : "subdued"}>
                      {markdownConfig.enabled ? "● Enabled" : "○ Disabled"}
                    </Badge>
                  </InlineStack>

                  <Text variant="bodySm" tone="subdued">
                    Displays progressive discount badges beside real pricing on active markdown products.
                  </Text>

                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                      color: "#475569",
                    }}
                  >
                    <strong>Badge:</strong> {markdownConfig.badgeText || "{discount}% OFF"} <br />
                    <strong>Strikethrough:</strong> {markdownConfig.showStrikethroughPrice !== false ? "Visible" : "Hidden"}
                  </div>
                </BlockStack>

                <BlockStack gap="200">
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Button
                      size="slim"
                      variant="plain"
                      tone={markdownConfig.enabled ? "critical" : "success"}
                      onClick={handleToggleMarkdownStatus}
                      loading={togglingMarkdown}
                      disabled={loading}
                    >
                      {markdownConfig.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="primary"
                      size="slim"
                      onClick={() => setCustomizeMarkdownOpen(true)}
                    >
                      Customize Style
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            </Card>

            {/* 🔥 LOW STOCK BADGE CARD */}
            <Card>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "260px",
                  gap: "16px",
                }}
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <span style={{ fontSize: "20px" }}>🔥</span>
                      <Text variant="headingSm" as="h3">
                        Low Stock Badge
                      </Text>
                    </InlineStack>
                    <Badge tone={lowStockConfig.enabled ? "success" : "subdued"}>
                      {lowStockConfig.enabled ? "● Enabled" : "○ Disabled"}
                    </Badge>
                  </InlineStack>

                  <Text variant="bodySm" tone="subdued">
                    Displays an urgency badge and remaining inventory count when stock drops below threshold.
                  </Text>

                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                      color: "#475569",
                    }}
                  >
                    <strong>Message:</strong> {lowStockConfig.badgeText || "🔥 Only {stock} left in stock!"} <br />
                    <strong>Threshold:</strong> Stock ≤ {lowStockConfig.threshold || 5} units
                  </div>
                </BlockStack>

                <BlockStack gap="200">
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Button
                      size="slim"
                      variant="plain"
                      tone={lowStockConfig.enabled ? "critical" : "success"}
                      onClick={handleToggleLowStockStatus}
                      loading={togglingLowStock}
                      disabled={loading}
                    >
                      {lowStockConfig.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="primary"
                      size="slim"
                      onClick={() => setCustomizeLowStockOpen(true)}
                    >
                      Customize Style
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            </Card>

            {/* 🛒 PRE-ORDER CARD */}
            <Card>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  minHeight: "260px",
                  gap: "16px",
                }}
              >
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <span style={{ fontSize: "20px" }}>🛒</span>
                      <Text variant="headingSm" as="h3">
                        Pre-Order
                      </Text>
                    </InlineStack>
                    <Badge tone={preOrderConfig.enabled ? "success" : "subdued"}>
                      {preOrderConfig.enabled ? "● Enabled" : "○ Disabled"}
                    </Badge>
                  </InlineStack>

                  <Text variant="bodySm" tone="subdued">
                    Allows customers to pre-order new product launches with partial deposit payments and launch schedules.
                  </Text>

                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                      color: "#475569",
                    }}
                  >
                    <strong>Button:</strong> {preOrderConfig.buttonText || "PRE-ORDER NOW"} <br />
                    <strong>Badge:</strong> {preOrderConfig.badgeText || "🛒 PRE-ORDER"}
                  </div>
                </BlockStack>

                <BlockStack gap="200">
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Button
                      size="slim"
                      variant="plain"
                      tone={preOrderConfig.enabled ? "critical" : "success"}
                      onClick={handleTogglePreOrderStatus}
                      loading={togglingPreOrder}
                      disabled={loading}
                    >
                      {preOrderConfig.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="primary"
                      size="slim"
                      onClick={() => setCustomizePreOrderOpen(true)}
                    >
                      Customize Style
                    </Button>
                  </InlineStack>
                </BlockStack>
              </div>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>

      <ClearanceSaleCustomizeModal
        open={customizeSaleOpen}
        onClose={() => setCustomizeSaleOpen(false)}
        shop={shopDomain}
        onSaved={(data) => {
          if (data) setConfig(data);
        }}
      />

      <BundleCustomizeModal
        open={customizeBundleOpen}
        onClose={() => setCustomizeBundleOpen(false)}
        shop={shopDomain}
        onSaved={(data) => {
          if (data) setBundleConfig(data);
        }}
      />

      <MarkdownCustomizeModal
        open={customizeMarkdownOpen}
        onClose={() => setCustomizeMarkdownOpen(false)}
        shop={shopDomain}
        onSaved={(data) => {
          if (data) setMarkdownConfig(data);
        }}
      />

      <LowStockCustomizeModal
        open={customizeLowStockOpen}
        onClose={() => setCustomizeLowStockOpen(false)}
        shop={shopDomain}
        onSaved={(data) => {
          if (data) setLowStockConfig(data);
        }}
      />

      <PreOrderCustomizeModal
        open={customizePreOrderOpen}
        onClose={() => setCustomizePreOrderOpen(false)}
        shop={shopDomain}
        onSaved={(data) => {
          if (data) setPreOrderConfig(data);
        }}
      />
    </Page>
  );
}
