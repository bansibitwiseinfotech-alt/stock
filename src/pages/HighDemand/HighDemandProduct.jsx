import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Banner,
  Thumbnail,
  Box,
  Modal,
  TextField,
  Badge,
  Divider,
  Checkbox,
} from "@shopify/polaris";

import {
  fetchHighDemandVariantDetail,
  toggleUrgencyBadgeApi,
  togglePreOrderApi,
  toggleNotifyMeApi,
  fetchLaunchPreOrderByIdApi,
  saveLaunchPreOrderApi,
  deleteLaunchPreOrderApi,
} from "../../services/appApi";

function ColorPickerField({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>{label}</label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 8px",
          border: "1px solid #CBD5E1",
          borderRadius: "8px",
          background: "#FFFFFF",
        }}
      >
        <input
          type="color"
          value={value || "#FFFFFF"}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "30px",
            height: "30px",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            cursor: "pointer",
            padding: 0,
            background: "none",
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#FFFFFF"
          style={{
            border: "none",
            outline: "none",
            fontSize: "12px",
            fontFamily: "monospace",
            color: "#0F172A",
            width: "100%",
            textTransform: "uppercase",
          }}
        />
      </div>
    </div>
  );
}

export default function HighDemandProduct({
  variantId,
  shop = "",
  productId = "",
  riskLevel,
  currentStock,
  salesVelocity,
  daysUntilStockout,
  sold30Days,
  initialProduct = null,
  onBack,
}) {
  const [product, setProduct] = useState(
    initialProduct ||
      (variantId
        ? {
            productId: productId || "",
            variantId: variantId,
            riskLevel: riskLevel || "SAFE",
            currentStock: currentStock ?? 0,
            salesVelocity: salesVelocity ?? 0,
            daysUntilStockout: daysUntilStockout ?? null,
            daysLeftToStockout: daysUntilStockout ?? null,
            sold30Days: sold30Days ?? 0,
            last30DaysSales: sold30Days ?? 0,
          }
        : null)
  );

  const [loading, setLoading] = useState(!initialProduct);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [noticeTone, setNoticeTone] = useState("info");

  const [badgeLoading, setBadgeLoading] = useState(false);
  const [preOrderLoading, setPreOrderLoading] = useState(false);
  const [notifyMeLoading, setNotifyMeLoading] = useState(false);
  const [monitorLoading, setMonitorLoading] = useState(false);

  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderQuantity, setReorderQuantity] = useState("0");
  const [recentReorder, setRecentReorder] = useState(null);

  // New Product Launch Pre-Order State
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [launchConfig, setLaunchConfig] = useState(null);
  const [savingLaunch, setSavingLaunch] = useState(false);
  const [deletingLaunch, setDeletingLaunch] = useState(false);
  const [launchForm, setLaunchForm] = useState({
    preOrderEnabled: true,
    launchDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    shippingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    preOrderOpensAt: "",
    badgeText: "🛒 PRE-ORDER",
    launchLabel: "NEW LAUNCH",
    launchTitle: "New Product Launch",
    customerMessage: "Be the first to get the new product.",
    launchDetails: "",
    buttonText: "PRE-ORDER NOW",
    depositPercentage: 50,
    depositEnabled: true,
    cardBackgroundColor: "#FFFFFF",
    textColor: "#111827",
    accentColor: "#4F46E5",
    borderColor: "#E2E8F0",
    badgeBackgroundColor: "#0F172A",
    badgeTextColor: "#FFFFFF",
  });

  // ==================================================
  // LOAD PRODUCT & LAUNCH PRE-ORDER
  // ==================================================

  useEffect(() => {
    async function loadDetail() {
      try {
        setLoading(true);

        const data = await fetchHighDemandVariantDetail(
          shop,
          variantId
        );

        setProduct(data);

        const recommended = Number(
          data?.reorderQuantity || 0
        );

        setReorderQuantity(String(recommended));

        // Load Launch Pre-Order settings if product exists
        const currentProdId = data?.productId || productId;
        if (currentProdId) {
          try {
            const launchRes = await fetchLaunchPreOrderByIdApi(shop, currentProdId);
            if (launchRes?.success && launchRes?.data) {
              const d = launchRes.data;
              setLaunchConfig(d);
              setLaunchForm({
                preOrderEnabled: Boolean(d.preOrderEnabled),
                launchDate: d.launchDate ? new Date(d.launchDate).toISOString().split("T")[0] : "",
                shippingDate: d.shippingDate ? new Date(d.shippingDate).toISOString().split("T")[0] : "",
                preOrderOpensAt: d.preOrderOpensAt ? new Date(d.preOrderOpensAt).toISOString().split("T")[0] : "",
                badgeText: d.badgeText || "🛒 PRE-ORDER",
                launchLabel: d.launchLabel || "NEW LAUNCH",
                launchTitle: d.launchTitle || "New Product Launch",
                customerMessage: d.customerMessage || "Be the first to get the new product.",
                launchDetails: d.launchDetails || "",
                buttonText: d.buttonText || "PRE-ORDER NOW",
                depositPercentage: typeof d.depositPercentage === "number" ? d.depositPercentage : 50,
                depositEnabled: d.depositEnabled !== false,
                cardBackgroundColor: d.cardBackgroundColor || "#FFFFFF",
                textColor: d.textColor || "#111827",
                accentColor: d.accentColor || "#4F46E5",
                borderColor: d.borderColor || "#E2E8F0",
                badgeBackgroundColor: d.badgeBackgroundColor || "#0F172A",
                badgeTextColor: d.badgeTextColor || "#FFFFFF",
              });
            }
          } catch (_) {}
        }
      } catch (err) {
        console.error(
          "Failed to load high-demand detail:",
          err
        );
        setNoticeTone("critical");
        setNotice("Failed to load product details.");
      } finally {
        setLoading(false);
      }
    }

    if (variantId) {
      loadDetail();
    }
  }, [variantId, shop, productId]);

  const handleSaveLaunch = async () => {
    const targetProdId = product?.productId || productId;
    if (!targetProdId) {
      setNoticeTone("critical");
      setNotice("Product ID not found.");
      return;
    }

    try {
      setSavingLaunch(true);
      const payload = {
        productId: targetProdId,
        productTitle: product?.productName || product?.productTitle || "",
        productHandle: product?.handle || "",
        productImage: product?.image || "",
        ...launchForm,
      };

      const res = await saveLaunchPreOrderApi(shop, payload);
      if (res?.success) {
        setLaunchConfig(res.data);
        setNoticeTone("success");
        setNotice("✓ Product Launch Pre-Order configuration saved!");
        setLaunchModalOpen(false);
      }
    } catch (err) {
      setNoticeTone("critical");
      setNotice(err.message || "Failed to save launch pre-order.");
    } finally {
      setSavingLaunch(false);
    }
  };

  const handleDeleteLaunch = async () => {
    const targetProdId = product?.productId || productId;
    if (!targetProdId) {
      setNoticeTone("critical");
      setNotice("Product ID not found.");
      return;
    }

    try {
      setDeletingLaunch(true);
      const res = await deleteLaunchPreOrderApi(shop, targetProdId);
      if (res?.success) {
        setLaunchConfig(null);
        setLaunchForm((prev) => ({
          ...prev,
          preOrderEnabled: false,
        }));
        setNoticeTone("success");
        setNotice("✓ Product Launch Pre-Order deleted! It will no longer show on the storefront.");
        setLaunchModalOpen(false);
      }
    } catch (err) {
      setNoticeTone("critical");
      setNotice(err.message || "Failed to delete launch pre-order.");
    } finally {
      setDeletingLaunch(false);
    }
  };

  // ==================================================
  // URGENCY / LOW STOCK BADGE
  // ==================================================

  const handleToggleBadge = async () => {
    try {
      setBadgeLoading(true);
      const isCurrentlyEnabled = Boolean(
        product?.lowStockBadge?.enabled ?? product?.urgencyBadgeEnabled
      );
      const nextState = !isCurrentlyEnabled;

      const res = await toggleUrgencyBadgeApi(
        shop,
        variantId,
        nextState
      );

      setNoticeTone("success");
      setNotice(
        nextState
          ? "✓ Low Stock Badge Active"
          : "✓ Low Stock Badge Disabled"
      );

      setProduct((prev) => ({
        ...prev,
        urgencyBadgeEnabled: nextState,
        lowStockBadge: {
          ...(prev?.lowStockBadge || {}),
          enabled: nextState,
        },
      }));
    } catch (err) {
      console.error(err);
      setNoticeTone("critical");
      setNotice("⚠️ Unable to update Stockout Shield. Please try again.");
    } finally {
      setBadgeLoading(false);
    }
  };

  // ==================================================
  // PRE-ORDER
  // ==================================================

  const handleTogglePreOrder = async () => {
    try {
      setPreOrderLoading(true);
      const isCurrentlyEnabled = Boolean(
        product?.preOrder?.enabled ?? product?.preOrderEnabled
      );
      const nextState = !isCurrentlyEnabled;

      const res = await togglePreOrderApi(
        shop,
        variantId,
        nextState
      );

      setNoticeTone("success");
      setNotice(
        nextState
          ? "✓ Pre-Order Active"
          : "✓ Pre-Order Disabled"
      );

      setProduct((prev) => ({
        ...prev,
        preOrderEnabled: nextState,
        preOrder: {
          ...(prev?.preOrder || {}),
          enabled: nextState,
        },
      }));
    } catch (err) {
      console.error(err);
      setNoticeTone("critical");
      setNotice("⚠️ Unable to update Pre-Order. Please try again.");
    } finally {
      setPreOrderLoading(false);
    }
  };

  // ==================================================
  // NOTIFY ME (BACK-IN-STOCK WAITLIST)
  // ==================================================

  const handleToggleNotifyMe = async () => {
    try {
      setNotifyMeLoading(true);
      const isCurrentlyEnabled = Boolean(
        product?.notifyMe?.enabled ?? product?.notifyMeEnabled ?? true
      );
      const nextState = !isCurrentlyEnabled;

      const res = await toggleNotifyMeApi(
        shop,
        variantId,
        nextState
      );

      setNoticeTone("success");
      setNotice(
        nextState
          ? "✓ Notify Me Waitlist Active"
          : "✓ Notify Me Waitlist Disabled"
      );

      setProduct((prev) => ({
        ...prev,
        notifyMeEnabled: nextState,
        notifyMe: {
          ...(prev?.notifyMe || {}),
          enabled: nextState,
        },
      }));
    } catch (err) {
      console.error(err);
      setNoticeTone("critical");
      setNotice("⚠️ Unable to update Notify Me. Please try again.");
    } finally {
      setNotifyMeLoading(false);
    }
  };

  // ==================================================
  // MONITOR
  // ==================================================

  const handleToggleMonitor = async () => {
    try {
      setMonitorLoading(true);
      const isCurrentlyEnabled = Boolean(product?.monitor?.enabled);
      const nextState = !isCurrentlyEnabled;

      await fetch(`/api/high-demand/monitor/${encodeURIComponent(String(variantId).replace("gid://shopify/ProductVariant/", ""))}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, variantId, enabled: nextState }),
      });

      setNoticeTone("success");
      setNotice(
        nextState
          ? "✓ Product Monitoring Active"
          : "✓ Product Monitoring Disabled"
      );

      setProduct((prev) => ({
        ...prev,
        monitor: {
          ...(prev?.monitor || {}),
          enabled: nextState,
        },
      }));
    } catch (err) {
      console.error(err);
      setNoticeTone("critical");
      setNotice("⚠️ Unable to update monitor setting.");
    } finally {
      setMonitorLoading(false);
    }
  };

  // ==================================================
  // OPEN REORDER MODAL
  // ==================================================

  const openReorderModal = () => {
    const recommended = Number(
      product?.reorderQuantity || 0
    );

    setReorderQuantity(String(recommended > 0 ? recommended : 20));
    setReorderModalOpen(true);
  };

  // ==================================================
  // CONFIRM REORDER
  // ==================================================

  const handleConfirmReorder = async () => {
    try {
      const quantity = Number(reorderQuantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setNoticeTone("critical");
        setNotice("Reorder quantity must be greater than 0.");
        return;
      }

      setReorderLoading(true);

      const response = await fetch("/api/high-demand/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop,
          productId: product?.productId,
          variantId,
          productName: product?.productName || product?.title || "",
          variantTitle: product?.variantTitle || "",
          currentStock: product?.currentStock ?? 0,
          salesVelocity: product?.salesVelocity ?? 0,
          daysUntilStockout: product?.daysUntilStockout ?? null,
          requestedQuantity: quantity,
          reorderQuantity: quantity,
          riskLevel: product?.riskLevel || "CRITICAL",
          targetCoverageDays: Number(product?.targetCoverageDays || 30),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.message || "Failed to create reorder.");
      }

      setReorderModalOpen(false);
      setRecentReorder({
        quantity,
        status: data?.data?.status || "Pending",
        createdAt: data?.data?.createdAt || new Date().toISOString(),
      });

      setNoticeTone("success");
      setNotice(`✓ Reorder Request Created — Quantity: ${quantity} units, Status: ${data?.data?.status || "Pending"}`);
    } catch (err) {
      console.error("Reorder Error:", err);
      setNoticeTone("critical");
      setNotice(err.message || "⚠️ Failed to create reorder request.");
    } finally {
      setReorderLoading(false);
    }
  };

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <Page
        fullWidth
        backAction={{
          content: "High Demand",
          onAction: onBack,
        }}
        title="Loading..."
      >
        <Layout>
          <Layout.Section>
            <Card>
              <Text>
                Loading product details...
              </Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // ==================================================
  // FALLBACK
  // ==================================================

  const item = product || {
    productId: "",
    title: "Product",
    productName: "Product",
    sku: "",
    variantTitle: "Default Title",
    currentStock: 0,
    stock: 0,
    salesVelocity: 0,
    daysUntilStockout: null,
    daysLeftToStockout: null,
    last30DaysSales: 0,
    riskLevel: "SAFE",
    recommendedAction: "NO_ACTION",
    actionLabel: "✅ No Action",
    actionPriority: "LOW",
    actionMessage: "",
    reorderQuantity: 0,
    targetCoverageDays: 30,
    image: "",
    urgencyBadgeEnabled: false,
    preOrderEnabled: false,
  };

  // ==================================================
  // NORMALIZE VALUES
  // ==================================================

  const title =
    item.productName ||
    item.title ||
    "Product";

  const stock =
    Number(
      item.currentStock ??
        item.stock ??
        0
    );

  const velocity =
    Number(
      item.salesVelocity || 0
    );

  const daysLeft =
    item.daysUntilStockout !==
      null &&
    item.daysUntilStockout !==
      undefined
      ? item.daysUntilStockout
      : item.daysLeftToStockout;

  const risk =
    (
      item.riskLevel ||
      "SAFE"
    ).toUpperCase();

  const recommendedQuantity =
    Number(
      item.reorderQuantity || 0
    );

  const getRiskLabel = (r) => {
    switch (r) {
      case "CRITICAL":
        return "🔴 CRITICAL";
      case "HIGH":
        return "🟠 HIGH";
      case "MEDIUM":
        return "🟡 MEDIUM";
      default:
        return "🟢 SAFE";
    }
  };

  const getStatusLabel = (r) => {
    switch (r) {
      case "CRITICAL":
        return "🚨 Stockout Risk";
      case "HIGH":
        return "📦 Restock Needed";
      case "MEDIUM":
        return "👀 Demand Watch";
      default:
        return "✅ Stock Stable";
    }
  };

  const getRecommendedAction = (r) => {
    switch (r) {
      case "CRITICAL":
        return "🚨 Immediate Reorder";
      case "HIGH":
        return "📦 Reorder Stock";
      case "MEDIUM":
        return "👀 Monitor";
      default:
        return "✓ No Immediate Action Required";
    }
  };

  const getStockoutPrediction = (r, days, vel) => {
    const formattedDays =
      typeof days === "number"
        ? `${Number(days).toFixed(1)} days`
        : "N/A";

    switch (r) {
      case "CRITICAL":
        return `🚨 Stockout Prediction: Immediate stockout risk! At current velocity of ${vel.toFixed(
          2
        )}/day, inventory is predicted to run out in ${formattedDays}.`;
      case "HIGH":
        return `📦 Stockout Prediction: Restock needed. Inventory coverage is estimated at ${formattedDays}. Reordering stock is recommended.`;
      case "MEDIUM":
        return `👀 Demand Watch: Elevated demand detected at ${vel.toFixed(
          2
        )}/day (${formattedDays} coverage). Monitor inventory trends closely.`;
      default:
        return `✅ Stock Stable: Inventory coverage is healthy (${formattedDays}). No immediate restocking needed.`;
    }
  };

  const sold30 = Number(
    item.last30DaysSales ?? item.sold30Days ?? 0
  );

  // ==================================================
  // RETURN
  // ==================================================

  return (
    <>
      <Page
        fullWidth
        backAction={{
          content: "High Demand",
          onAction: onBack,
        }}
        title={title}
        subtitle={`SKU: ${
          item.sku || "N/A"
        }`}
      >
        <Layout>
          {/* NOTICE */}
          {notice && (
            <Layout.Section>
              <Banner
                tone={noticeTone}
                onDismiss={() => setNotice("")}
              >
                <p>{notice}</p>
              </Banner>
            </Layout.Section>
          )}

          {recentReorder && (
            <Layout.Section>
              <Banner tone="info" title="Recent Reorder Pending">
                <p>
                  <strong>{recentReorder.quantity} units</strong> requested on {new Date(recentReorder.createdAt).toLocaleTimeString()}. Status is currently <strong>{recentReorder.status}</strong>.
                </p>
              </Banner>
            </Layout.Section>
          )}

          {/* PRODUCT */}
          <Layout.Section>
            <Card>
              <BlockStack gap="500">

                {/* HEADER */}
                <InlineStack
                  gap="400"
                  blockAlign="center"
                >
                  {item.image && (
                    <Thumbnail
                      source={item.image}
                      alt={title}
                      size="large"
                    />
                  )}

                  <BlockStack gap="100">
                    <Text
                      variant="headingLg"
                      as="h2"
                    >
                      {title}
                    </Text>

                    <Text
                      variant="bodyMd"
                      tone="subdued"
                    >
                      SKU: {item.sku || "N/A"}
                    </Text>

                    <InlineStack gap="200">
                      <Badge
                        tone={
                          risk === "CRITICAL"
                            ? "critical"
                            : risk === "HIGH"
                            ? "warning"
                            : risk === "MEDIUM"
                            ? "attention"
                            : "success"
                        }
                      >
                        {getRiskLabel(risk)}
                      </Badge>
                      <Badge
                        tone={
                          risk === "CRITICAL"
                            ? "critical"
                            : risk === "HIGH"
                            ? "warning"
                            : risk === "MEDIUM"
                            ? "attention"
                            : "success"
                        }
                      >
                        {getStatusLabel(risk)}
                      </Badge>
                    </InlineStack>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {/* METRICS */}
                <InlineStack
                  gap="400"
                  wrap={false}
                >
                  <Box
                    width="25%"
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <Text
                      variant="bodySm"
                      tone="subdued"
                    >
                      CURRENT STOCK
                    </Text>

                    <Text
                      variant="headingLg"
                      as="h3"
                    >
                      {stock} units
                    </Text>
                  </Box>

                  <Box
                    width="25%"
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <Text
                      variant="bodySm"
                      tone="subdued"
                    >
                      SALES VELOCITY
                    </Text>

                    <Text
                      variant="headingLg"
                      as="h3"
                    >
                      {velocity.toFixed(2)} / day
                    </Text>
                  </Box>

                  <Box
                    width="25%"
                    padding="300"
                    background={
                      risk === "CRITICAL"
                        ? "bg-surface-critical-subdued"
                        : risk === "HIGH"
                        ? "bg-surface-warning-subdued"
                        : "bg-surface-secondary"
                    }
                    borderRadius="200"
                  >
                    <Text
                      variant="bodySm"
                      tone={
                        risk === "CRITICAL"
                          ? "critical"
                          : risk === "HIGH"
                          ? "warning"
                          : "subdued"
                      }
                    >
                      DAYS UNTIL STOCKOUT
                    </Text>

                    <Text
                      variant="headingLg"
                      as="h3"
                      tone={
                        risk === "CRITICAL"
                          ? "critical"
                          : risk === "HIGH"
                          ? "warning"
                          : undefined
                      }
                    >
                      {typeof daysLeft === "number"
                        ? `${daysLeft.toFixed(1)} days`
                        : "N/A"}
                    </Text>
                  </Box>

                  <Box
                    width="25%"
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <Text
                      variant="bodySm"
                      tone="subdued"
                    >
                      SOLD LAST 30 DAYS
                    </Text>

                    <Text
                      variant="headingLg"
                      as="h3"
                    >
                      {sold30} units
                    </Text>
                  </Box>
                </InlineStack>

                {/* WHY THIS PRODUCT IS AT RISK / STOCKOUT SHIELD */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text
                        variant="headingMd"
                        as="h3"
                      >
                        🛡️ Stockout Shield Analysis
                      </Text>
                      <Badge
                        tone={
                          risk === "CRITICAL"
                            ? "critical"
                            : risk === "HIGH"
                            ? "warning"
                            : risk === "MEDIUM"
                            ? "attention"
                            : "success"
                        }
                      >
                        {risk === "CRITICAL"
                          ? "⚠️ Stockout Risk Detected"
                          : risk === "HIGH"
                          ? "📦 Restock Required"
                          : risk === "MEDIUM"
                          ? "👀 Demand Watch Alert"
                          : "✅ Healthy Stock Level"}
                      </Badge>
                    </InlineStack>

                    <Text
                      variant="bodyMd"
                    >
                      {getStockoutPrediction(
                        risk,
                        daysLeft,
                        velocity
                      )}
                    </Text>

                    <InlineStack gap="300">
                      <Badge
                        tone={
                          risk === "CRITICAL"
                            ? "critical"
                            : risk === "HIGH"
                            ? "warning"
                            : risk === "MEDIUM"
                            ? "attention"
                            : "success"
                        }
                      >
                        Recommended Action: {getRecommendedAction(risk)}
                      </Badge>

                      {recommendedQuantity > 0 && (
                        <Badge tone="info">
                          Suggested Restock: {recommendedQuantity} units
                        </Badge>
                      )}
                    </InlineStack>
                  </BlockStack>
                </Card>

                {/* STOREFRONT PROTECTION CONTROLS & ACTIONS */}
                <Text
                  variant="headingMd"
                  as="h3"
                >
                  Protection Controls & Recommended Actions
                </Text>

                <InlineStack
                  gap="400"
                  wrap={false}
                >
                  {/* LOW STOCK BADGE */}
                  <Box width="50%">
                    <Card>
                      <BlockStack gap="300">
                        <InlineStack align="space-between">
                          <Text
                            variant="headingSm"
                            as="h4"
                          >
                            🔥 Low Stock Badge
                          </Text>
                          <Badge
                            tone={
                              (item.lowStockBadge?.enabled ?? item.urgencyBadgeEnabled)
                                ? "success"
                                : "subdued"
                            }
                          >
                            {(item.lowStockBadge?.enabled ?? item.urgencyBadgeEnabled)
                              ? "Status: ON"
                              : "Status: OFF"}
                          </Badge>
                        </InlineStack>

                        <Text
                          variant="bodySm"
                          tone="subdued"
                        >
                          Show urgency message on the customer storefront.
                        </Text>

                        <Button
                          onClick={handleToggleBadge}
                          loading={badgeLoading}
                          variant={
                            (item.lowStockBadge?.enabled ?? item.urgencyBadgeEnabled)
                              ? "primary"
                              : "secondary"
                          }
                        >
                          {(item.lowStockBadge?.enabled ?? item.urgencyBadgeEnabled)
                            ? "Remove Badge"
                            : "Apply Badge"}
                        </Button>
                      </BlockStack>
                    </Card>
                  </Box>

                  {/* PREORDER */}
                  <Box width="50%">
                    <Card>
                      <BlockStack gap="300">
                        <InlineStack align="space-between">
                          <Text
                            variant="headingSm"
                            as="h4"
                          >
                            🛒 Pre-Order
                          </Text>
                          <Badge
                            tone={
                              (launchConfig?.preOrderEnabled ?? false)
                                ? "success"
                                : "subdued"
                            }
                          >
                            {(launchConfig?.preOrderEnabled ?? false)
                              ? "Status: ON"
                              : "Status: OFF"}
                          </Badge>
                        </InlineStack>

                        <Text
                          variant="bodySm"
                          tone="subdued"
                        >
                          Accept orders for a new product before its official launch.
                        </Text>

                        <Button
                          onClick={() => setLaunchModalOpen(true)}
                          variant={
                            (launchConfig?.preOrderEnabled ?? false)
                              ? "primary"
                              : "secondary"
                          }
                        >
                          Apply Launch
                        </Button>
                      </BlockStack>
                    </Card>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>

      {/* ==================================================
          NEW PRODUCT LAUNCH PRE-ORDER CONFIGURATION MODAL
          ================================================== */}
      <Modal
        open={launchModalOpen}
        size="large"
        onClose={() => setLaunchModalOpen(false)}
        title="🚀 NEW PRODUCT LAUNCH PRE-ORDER"
        primaryAction={{
          content: savingLaunch ? "Saving..." : "SAVE LAUNCH",
          loading: savingLaunch,
          disabled: deletingLaunch,
          onAction: handleSaveLaunch,
        }}
        secondaryActions={[
          ...(launchConfig
            ? [
                {
                  content: deletingLaunch ? "Deleting..." : "Delete Launch",
                  destructive: true,
                  loading: deletingLaunch,
                  disabled: savingLaunch,
                  onAction: handleDeleteLaunch,
                },
              ]
            : []),
          {
            content: "Cancel",
            disabled: savingLaunch || deletingLaunch,
            onAction: () => setLaunchModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">
              Product: {title}
            </Text>

            <Divider />

            <Checkbox
              label="Pre-Order: ON"
              checked={launchForm.preOrderEnabled}
              onChange={(checked) => setLaunchForm((prev) => ({ ...prev, preOrderEnabled: checked }))}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <TextField
                label="Launch Date"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={launchForm.launchDate}
                onChange={(val) => setLaunchForm((prev) => ({ ...prev, launchDate: val }))}
                autoComplete="off"
              />
              <TextField
                label="Shipping Starts"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={launchForm.shippingDate}
                onChange={(val) => setLaunchForm((prev) => ({ ...prev, shippingDate: val }))}
                autoComplete="off"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <TextField
                label="Badge Text"
                value={launchForm.badgeText}
                onChange={(val) => setLaunchForm((prev) => ({ ...prev, badgeText: val }))}
                autoComplete="off"
              />
              <TextField
                label="Launch Label"
                value={launchForm.launchLabel}
                onChange={(val) => setLaunchForm((prev) => ({ ...prev, launchLabel: val }))}
                autoComplete="off"
              />
            </div>

            <TextField
              label="Launch Title"
              value={launchForm.launchTitle}
              onChange={(val) => setLaunchForm((prev) => ({ ...prev, launchTitle: val }))}
              autoComplete="off"
            />

            <TextField
              label="Customer Message"
              value={launchForm.customerMessage}
              onChange={(val) => setLaunchForm((prev) => ({ ...prev, customerMessage: val }))}
              multiline={2}
              autoComplete="off"
            />

            <TextField
              label="Launch Details"
              value={launchForm.launchDetails}
              onChange={(val) => setLaunchForm((prev) => ({ ...prev, launchDetails: val }))}
              placeholder="e.g. Official launch on 30 Aug 2026."
              autoComplete="off"
            />

            <TextField
              label="Button Text"
              value={launchForm.buttonText}
              onChange={(val) => setLaunchForm((prev) => ({ ...prev, buttonText: val }))}
              autoComplete="off"
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <TextField
                label="Deposit Percentage (%)"
                type="number"
                value={String(launchForm.depositPercentage ?? 50)}
                onChange={(val) => {
                  const num = val === "" ? "" : parseInt(val, 10);
                  const pct = num === "" ? "" : Math.max(1, Math.min(100, isNaN(num) ? 50 : num));
                  setLaunchForm((prev) => ({ ...prev, depositPercentage: pct }));
                }}
                helpText="Percentage of total price (1% - 100%)"
                autoComplete="off"
              />
              <TextField
                label={
                  Number(item.price || item.currentPrice || 0) > 0
                    ? `Deposit Price Amount ($ of $${Number(item.price || item.currentPrice).toLocaleString()})`
                    : "Deposit Price Amount ($)"
                }
                type="number"
                prefix="$"
                value={
                  Number(item.price || item.currentPrice || 0) > 0 && (launchForm.depositPercentage !== "" && launchForm.depositPercentage != null)
                    ? ((Number(item.price || item.currentPrice) * Number(launchForm.depositPercentage || 50)) / 100).toFixed(2)
                    : ""
                }
                onChange={(val) => {
                  const amt = parseFloat(val);
                  const prodPrice = Number(item.price || item.currentPrice || 0);
                  if (prodPrice > 0) {
                    if (isNaN(amt) || amt <= 0) {
                      setLaunchForm((prev) => ({ ...prev, depositPercentage: "" }));
                    } else {
                      const calculatedPct = Math.max(1, Math.min(100, Math.round((amt / prodPrice) * 100)));
                      setLaunchForm((prev) => ({ ...prev, depositPercentage: calculatedPct }));
                    }
                  }
                }}
                helpText={
                  Number(item.price || item.currentPrice || 0) > 0 && (launchForm.depositPercentage !== "" && launchForm.depositPercentage != null)
                    ? `Remaining Balance: $${(Number(item.price || item.currentPrice) - (Number(item.price || item.currentPrice) * Number(launchForm.depositPercentage || 50)) / 100).toFixed(2)}`
                    : "Calculates deposit amount from price"
                }
                autoComplete="off"
              />
            </div>

            <div style={{ marginTop: "4px" }}>
              <Checkbox
                label="Enable Partial Deposit Payment"
                helpText="When enabled, customer only pays the deposit amount at checkout."
                checked={launchForm.depositEnabled !== false}
                onChange={(checked) => setLaunchForm((prev) => ({ ...prev, depositEnabled: checked }))}
              />
            </div>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ==================================================
          REORDER CONFIRMATION MODAL
          ================================================== */}

      <Modal
        open={reorderModalOpen}
        onClose={() => {
          if (!reorderLoading) {
            setReorderModalOpen(false);
          }
        }}
        title="Confirm Reorder"
        primaryAction={{
          content: reorderLoading
            ? "Creating..."
            : "Confirm Reorder",
          onAction:
            handleConfirmReorder,
          loading: reorderLoading,
          disabled:
            !reorderQuantity ||
            Number(
              reorderQuantity
            ) <= 0,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () =>
              setReorderModalOpen(
                false
              ),
            disabled: reorderLoading,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">

            <Text
              variant="headingMd"
              as="h3"
            >
              📦 {title}
            </Text>

            <Text
              variant="bodyMd"
              tone="subdued"
            >
              Review the reorder before
              creating the request.
            </Text>

            <Divider />

            <InlineStack
              align="space-between"
            >
              <Text>Current Stock</Text>

              <Text fontWeight="bold">
                {stock} units
              </Text>
            </InlineStack>

            <InlineStack
              align="space-between"
            >
              <Text>Sales Velocity</Text>

              <Text fontWeight="bold">
                {velocity.toFixed(
                  2
                )} / day
              </Text>
            </InlineStack>

            <InlineStack
              align="space-between"
            >
              <Text>Days Until Stockout</Text>

              <Text
                fontWeight="bold"
                tone="critical"
              >
                {typeof daysLeft ===
                "number"
                  ? `${daysLeft.toFixed(
                      1
                    )} days`
                  : "N/A"}
              </Text>
            </InlineStack>

            <InlineStack
              align="space-between"
            >
              <Text>Risk</Text>

              <Badge
                tone={
                  risk === "CRITICAL" ||
                  risk === "HIGH"
                    ? "critical"
                    : "warning"
                }
              >
                {risk}
              </Badge>
            </InlineStack>

            <TextField
              label="Reorder Quantity"
              type="number"
              value={
                reorderQuantity
              }
              onChange={
                setReorderQuantity
              }
              min="1"
              autoComplete="off"
              helpText={`Recommended quantity: ${recommendedQuantity} units`}
            />

            <Banner tone="warning">
              <p>
                This will create a reorder
                request with <strong>
                  PENDING
                </strong>{" "}
                status. Shopify inventory
                will not be changed yet.
              </p>
            </Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}