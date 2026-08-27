import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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
import LowStockCustomizeModal from "../../components/LowStockCustomizeModal";
import PreOrderCustomizeModal from "../../components/PreOrderCustomizeModal";

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

  const navigate = useNavigate();
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
  const [lowStockCustomizeOpen, setLowStockCustomizeOpen] = useState(false);
  const [preOrderCustomizeOpen, setPreOrderCustomizeOpen] = useState(false);
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
    depositAmount: 0,
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
                depositAmount: typeof d.depositAmount === "number" ? d.depositAmount : 0,
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
const rawDaysLeft =
  item.daysUntilStockout !== null &&
  item.daysUntilStockout !== undefined &&
  item.daysUntilStockout !== ""
    ? item.daysUntilStockout
    : item.daysLeftToStockout;

const daysLeft =
  rawDaysLeft !== null &&
  rawDaysLeft !== undefined &&
  rawDaysLeft !== "" &&
  Number.isFinite(Number(rawDaysLeft))
    ? Number(rawDaysLeft)
    : null;

  const risk =
    (
      item.riskLevel ||
      "SAFE"
    ).toUpperCase();

  const recommendedQuantity =
    Number(
      item.reorderQuantity || 0
    );

  // ==================================================
  // INTELLIGENT DEMAND & STOCKOUT ANALYSIS
  // ==================================================
const getDynamicAnalysis = (
  currentStockVal,
  daysVal,
  velVal
) => {
  const safeStock = Number(currentStockVal ?? 0);
  const safeVelocity = Number(velVal ?? 0);

  const safeDays =
    daysVal !== null &&
    daysVal !== undefined &&
    Number.isFinite(Number(daysVal))
      ? Number(daysVal)
      : null;

  // OUT OF STOCK
  if (safeStock <= 0) {
    return {
      riskLevel: "CRITICAL",
      riskTone: "critical",
      riskLabel: "🔴 CRITICAL",
      statusBadge: "🚨 Out of Stock",
      actionLabel: "🚨 Immediate Reorder",
      prediction: `Inventory is exhausted (${safeStock} units). Create a purchase order immediately to prevent lost sales.`,
      needsReorder: true,
    };
  }

  // NO SALES DATA
  if (safeVelocity <= 0 || safeDays === null) {
    return {
      riskLevel: "SAFE",
      riskTone: "success",
      riskLabel: "🟢 SAFE",
      statusBadge: "✅ Stock Stable",
      actionLabel: "✓ Stock Stable",
      prediction: `Current inventory is ${safeStock} units. There is currently insufficient sales velocity data to predict a stockout date.`,
      needsReorder: false,
    };
  }

  // CRITICAL: 0–7 DAYS
  if (safeDays <= 7) {
    return {
      riskLevel: "CRITICAL",
      riskTone: "critical",
      riskLabel: "🔴 CRITICAL",
      statusBadge: "🚨 Stockout Risk Detected",
      actionLabel: "🚨 Immediate Reorder",
      prediction: `High stockout risk! At the current sales velocity of ${safeVelocity.toFixed(
        2
      )} units/day, inventory is predicted to run out in ${safeDays.toFixed(
        1
      )} days.`,
      needsReorder: true,
    };
  }

  // HIGH: 8–14 DAYS
  if (safeDays <= 14) {
    return {
      riskLevel: "HIGH",
      riskTone: "warning",
      riskLabel: "🟠 HIGH",
      statusBadge: "📦 Restock Required",
      actionLabel: "📦 Reorder Stock",
      prediction: `Restock is recommended. Current inventory provides approximately ${safeDays.toFixed(
        1
      )} days of coverage at ${safeVelocity.toFixed(2)} units/day.`,
      needsReorder: true,
    };
  }

  // MEDIUM: 15–30 DAYS
  if (safeDays <= 30) {
    return {
      riskLevel: "MEDIUM",
      riskTone: "attention",
      riskLabel: "🟡 MEDIUM",
      statusBadge: "👀 Demand Watch",
      actionLabel: "👀 Monitor Demand",
      prediction: `Demand is stable. Current inventory provides approximately ${safeDays.toFixed(
        1
      )} days of stock coverage.`,
      needsReorder: false,
    };
  }

  // SAFE: MORE THAN 30 DAYS
  return {
    riskLevel: "SAFE",
    riskTone: "success",
    riskLabel: "🟢 SAFE",
    statusBadge: "✅ Healthy Stock Level",
    actionLabel: "✓ Stock Stable",
    prediction: `Stock coverage is healthy with approximately ${safeDays.toFixed(
      1
    )} days remaining at current sales velocity (${safeVelocity.toFixed(
      2
    )} units/day).`,
    needsReorder: false,
  };
};          

const dynamicAnalysis = getDynamicAnalysis(
  stock,
  daysLeft,
  velocity
);

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
        subtitle={`SKU: ${item.sku || "N/A"}`}
        titleMetadata={
          <InlineStack gap="200" blockAlign="center">
            <Badge tone={dynamicAnalysis.riskTone}>
              {dynamicAnalysis.riskLabel}
            </Badge>
            <Badge tone={dynamicAnalysis.riskTone}>
              {dynamicAnalysis.statusBadge}
            </Badge>
          </InlineStack>
        }
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

          {/* MAIN PRODUCT DASHBOARD */}
          <Layout.Section>
            <BlockStack gap="400">
              {/* METRICS ROW */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                }}
              >
                {/* 1. CURRENT STOCK */}
                <Card padding="400">
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">
                      CURRENT STOCK
                    </Text>
                    <Text
                      variant="headingXl"
                      as="p"
                      fontWeight="bold"
                      tone={stock <= 0 ? "critical" : undefined}
                    >
                      {stock} units
                    </Text>
                  </BlockStack>
                </Card>

                {/* 2. SALES VELOCITY */}
                <Card padding="400">
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">
                      SALES VELOCITY
                    </Text>
                    <Text variant="headingXl" as="p" fontWeight="bold">
                      {velocity.toFixed(2)} / day
                    </Text>
                  </BlockStack>
                </Card>

                {/* 3. DAYS UNTIL STOCKOUT */}
                <Card padding="400">
                  <BlockStack gap="100">
                    <Text
                      variant="bodySm"
                      tone={
                        dynamicAnalysis.riskLevel === "CRITICAL"
                          ? "critical"
                          : dynamicAnalysis.riskLevel === "HIGH"
                          ? "warning"
                          : "subdued"
                      }
                    >
                      DAYS UNTIL STOCKOUT
                    </Text>
                    <Text
                      variant="headingXl"
                      as="p"
                      fontWeight="bold"
                      tone={
                        dynamicAnalysis.riskLevel === "CRITICAL"
                          ? "critical"
                          : dynamicAnalysis.riskLevel === "HIGH"
                          ? "warning"
                          : undefined
                      }
                    >
                      {typeof daysLeft === "number"
                        ? `${daysLeft.toFixed(1)} days`
                        : "N/A"}
                    </Text>
                  </BlockStack>
                </Card>

                {/* 4. SOLD LAST 30 DAYS */}
                <Card padding="400">
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">
                      SOLD LAST 30 DAYS
                    </Text>
                    <Text variant="headingXl" as="p" fontWeight="bold">
                      {sold30} units
                    </Text>
                  </BlockStack>
                </Card>
              </div>

              {/* STOCKOUT SHIELD ANALYSIS */}
              <Card padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h3" fontWeight="semibold">
                      🛡️ Stockout & Demand Analysis
                    </Text>
                    <Badge tone={dynamicAnalysis.riskTone}>
                      {dynamicAnalysis.statusBadge}
                    </Badge>
                  </InlineStack>

                  <Text variant="bodyMd" as="p">
                    {dynamicAnalysis.prediction}
                  </Text>

                  <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone={dynamicAnalysis.riskTone}>
                        Recommended Action: {dynamicAnalysis.actionLabel}
                      </Badge>

                      {recommendedQuantity > 0 && (
                        <Badge tone="info">
                          Suggested Restock: {recommendedQuantity} units
                        </Badge>
                      )}
                    </InlineStack>

                    {dynamicAnalysis.needsReorder && (
                      <Button variant="primary" onClick={openReorderModal}>
                        Create Reorder Request
                      </Button>
                    )}
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* PROTECTION CONTROLS & RECOMMENDED ACTIONS */}
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3" fontWeight="semibold">
                  Protection Controls & Recommended Actions
                </Text>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {/* LOW STOCK BADGE */}
                  <Card padding="400">
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingSm" as="h4" fontWeight="semibold">
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

                      <Text variant="bodySm" tone="subdued">
                        Display dynamic urgency stock count on customer storefront to protect margins & drive conversion.
                      </Text>

                      <InlineStack gap="200" align="start">
                        <Button
                          onClick={handleToggleBadge}
                          loading={badgeLoading}
                          variant={
                            (item.lowStockBadge?.enabled ?? item.urgencyBadgeEnabled)
                              ? "secondary"
                              : "primary"
                          }
                        >
                          {(item.lowStockBadge?.enabled ?? item.urgencyBadgeEnabled)
                            ? "Disable Badge"
                            : "Enable Badge"}
                        </Button>
                        <Button
                          variant="plain"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/app/customization");
                          }}
                        >
                          Customize
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Card>

                  {/* PRE-ORDER */}
                  <Card padding="400">
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingSm" as="h4" fontWeight="semibold">
                          📦 Launch Pre-Order
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

                      <Text variant="bodySm" tone="subdued">
                        Accept customer pre-orders and deposit payments for this item before official inventory release.
                      </Text>

                      <InlineStack gap="200" align="start">
                        <Button
                          onClick={() => setLaunchModalOpen(true)}
                          variant={
                            (launchConfig?.preOrderEnabled ?? false)
                              ? "secondary"
                              : "primary"
                          }
                        >
                          {(launchConfig?.preOrderEnabled ?? false)
                            ? "Configure Pre-Order"
                            : "Setup Pre-Order"}
                        </Button>
                        <Button
                          variant="plain"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/app/customization");
                          }}
                        >
                          Customize
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                </div>
              </BlockStack>
            </BlockStack>
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
                value={launchForm.depositPercentage === "" ? "" : String(launchForm.depositPercentage ?? 50)}
                onChange={(val) => {
                  if (val === "") {
                    setLaunchForm((prev) => ({ ...prev, depositPercentage: "" }));
                    return;
                  }
                  const num = parseInt(val, 10);
                  const pct = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
                  const prodPrice = Number(item.price || item.currentPrice || 0);
                  const calcAmt = prodPrice > 0 ? Number(((prodPrice * pct) / 100).toFixed(2)) : 0;
                  setLaunchForm((prev) => ({
                    ...prev,
                    depositPercentage: pct,
                    depositAmount: pct === 0 ? (prev.depositAmount || 0) : calcAmt,
                  }));
                }}
                helpText="Percentage of total price (0% - 100%). Set 0% for custom fixed dollar deposit."
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
                  (() => {
                    const prodPrice = Number(item.price || item.currentPrice || 0);
                    if (launchForm.depositPercentage === 0 || launchForm.depositPercentage === "0") {
                      return launchForm.depositAmount != null && launchForm.depositAmount !== "" ? String(launchForm.depositAmount) : "0";
                    }
                    if (prodPrice > 0 && launchForm.depositPercentage !== "" && launchForm.depositPercentage != null) {
                      return ((prodPrice * Number(launchForm.depositPercentage)) / 100).toFixed(2);
                    }
                    return launchForm.depositAmount != null && launchForm.depositAmount !== "" ? String(launchForm.depositAmount) : "";
                  })()
                }
                onChange={(val) => {
                  const prodPrice = Number(item.price || item.currentPrice || 0);
                  if (val === "") {
                    setLaunchForm((prev) => ({
                      ...prev,
                      depositAmount: "",
                      depositPercentage: prev.depositPercentage === 0 ? 0 : "",
                    }));
                    return;
                  }
                  const amt = parseFloat(val);
                  const safeAmt = isNaN(amt) ? 0 : Math.max(0, amt);
                  if (prodPrice > 0) {
                    if (launchForm.depositPercentage === 0 || launchForm.depositPercentage === "0") {
                      // Preserve 0% if merchant chose fixed dollar amount
                      setLaunchForm((prev) => ({ ...prev, depositAmount: safeAmt, depositPercentage: 0 }));
                    } else {
                      const calculatedPct = Math.max(0, Math.min(100, Math.round((safeAmt / prodPrice) * 100)));
                      setLaunchForm((prev) => ({ ...prev, depositAmount: safeAmt, depositPercentage: calculatedPct }));
                    }
                  } else {
                    setLaunchForm((prev) => ({ ...prev, depositAmount: safeAmt }));
                  }
                }}
                helpText={
                  (() => {
                    const prodPrice = Number(item.price || item.currentPrice || 0);
                    const isZeroPct = launchForm.depositPercentage === 0 || launchForm.depositPercentage === "0";
                    const currentDepositAmt = isZeroPct
                      ? Number(launchForm.depositAmount || 0)
                      : (prodPrice > 0 && launchForm.depositPercentage !== "" ? (prodPrice * Number(launchForm.depositPercentage || 0)) / 100 : Number(launchForm.depositAmount || 0));
                    if (prodPrice > 0) {
                      const remaining = Math.max(0, prodPrice - currentDepositAmt);
                      return `Remaining Balance: $${remaining.toFixed(2)} (Deposit: $${currentDepositAmt.toFixed(2)})`;
                    }
                    return "Calculates or sets deposit amount from price";
                  })()
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

      {/* Low Stock Badge Customization Modal */}
      <LowStockCustomizeModal
        open={lowStockCustomizeOpen}
        onClose={() => setLowStockCustomizeOpen(false)}
        shop={shop}
        onSaved={() => {
          setNoticeTone("success");
          setNotice("✓ Low Stock Badge customization saved!");
        }}
      />

      {/* Pre-Order Customization Modal */}
      <PreOrderCustomizeModal
        open={preOrderCustomizeOpen}
        onClose={() => setPreOrderCustomizeOpen(false)}
        shop={shop}
        onSaved={() => {
          setNoticeTone("success");
          setNotice("✓ Pre-Order styling customization saved!");
        }}
      />
    </>
  );
}