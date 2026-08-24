import React, { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Banner,
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  Button,
  Modal,
  FormLayout,
  TextField,
  Select,
  Spinner,
  Badge,
} from "@shopify/polaris";
import { useNavigate, useParams } from "react-router";
import {
  fetchDeadStockVariantDetail,
  executeClearanceSale,
  executeAddToCollection,
  executeProgressiveMarkdown,
  executeStopProgressiveMarkdown,
  executeCreateBundle,
  executeDeleteBundle,
  fetchCompanionProducts,
  fetchProductActions,
  executeDeleteClearanceSale,
} from "../../services/deadStockApi";
import { fetchClearanceSaleConfigApi } from "../../services/appApi";
import CreateDeadStockBundleModal from "../../components/DeadStock/CreateDeadStockBundleModal";

const clampDiscount = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) return 5;
  return Math.min(50, Math.max(5, number));
};

const clampAdjustment = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;              
  return Math.min(50, Math.max(0, number));
};

export default function DeadStockProduct({ variantId: propVariantId, shop = "", onBack }) {
  const params = useParams();
  const navigate = useNavigate();
  const variantId = propVariantId || params.variantId || "";
  const activeShop = shop || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("shop") : "") || "";
  const handleBack = onBack || (() => navigate("/app/dead-stock"));

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [actionsLog, setActionsLog] = useState([]);
  const [clearanceEnabled, setClearanceEnabled] = useState(true);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'clearance' | 'bundle' | 'markdown' | 'collection' | null
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteBundleConfirmOpen, setDeleteBundleConfirmOpen] = useState(false);
  const [isDeletingBundle, setIsDeletingBundle] = useState(false);
  const [deleteMarkdownConfirmOpen, setDeleteMarkdownConfirmOpen] = useState(false);
  const [isDeletingMarkdown, setIsDeletingMarkdown] = useState(false);
  const [clearanceErrors, setClearanceErrors] = useState({});

  // Form states
  // Clearance Sale
  const [clearanceDiscount, setClearanceDiscount] = useState("20");
  const [clearanceDuration, setClearanceDuration] = useState("14");
  const [clearanceStartDate, setClearanceStartDate] = useState("");

  // Create Bundle
  const [bundleName, setBundleName] = useState("");
  const [companionProductId, setCompanionProductId] = useState("");
  const [companionOptions, setCompanionOptions] = useState([]);
  const [companionList, setCompanionList] = useState([]);
  const [bundleDiscount, setBundleDiscount] = useState("15");

  // Progressive Markdown
  const [startingDiscount, setStartingDiscount] = useState("10");
  const [increasePercent, setIncreasePercent] = useState("10");
  const [decreasePercent, setDecreasePercent] = useState("3");
  const [minimumDiscount, setMinimumDiscount] = useState("5");
  const [maximumDiscount, setMaximumDiscount] = useState("50");

  const [actionNotification, setActionNotification] = useState(null);

  const loadDetail = useCallback(
    async (showSpinner = false) => {
      if (!variantId) return;
      try {
        if (showSpinner) setLoading(true);
        setError("");

        const [productData, actions] = await Promise.all([
          fetchDeadStockVariantDetail(activeShop, variantId),
          fetchProductActions(activeShop, variantId).catch(() => []),
        ]);

        setProduct(productData);
        setActionsLog(actions || []);

        if (productData?.activeClearanceSale?.discountValue != null) {
          setClearanceDiscount(String(productData.activeClearanceSale.discountValue));
        } else {
          setClearanceDiscount("20");
        }

        if (productData?.activeBundle) {
          setBundleName(productData.activeBundle.bundleName || `${productData.title} + Companion Bundle`);
          setBundleDiscount(String(productData.activeBundle.discountPercent || 15));
          if (productData.activeBundle.companionProductId) {
            setCompanionProductId(productData.activeBundle.companionProductId);
          }
        } else if (productData?.title) {
          setBundleName(`${productData.title} + Companion Bundle`);
        }
      } catch (err) {
        setError(err.message || "Unable to load product detail.");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [variantId, activeShop]
  );

  useEffect(() => {
    loadDetail(true);
  }, [loadDetail]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const actionParam = new URLSearchParams(window.location.search).get("action");
      if (actionParam === "clearance" || actionParam === "CLEARANCE_SALE") {
        openModal("clearance");
      } else if (actionParam === "bundle" || actionParam === "DEAD_STOCK_BUNDLE") {
        openModal("bundle");
      } else if (actionParam === "markdown" || actionParam === "PROGRESSIVE_MARKDOWN") {
        openModal("markdown");
      }
    }
  }, [variantId]);

  const openModal = async (type) => {
    setModalError("");
    if (type === "clearance") {
      setClearanceErrors({});
      if (product?.activeClearanceSale) {
        setClearanceDiscount(String(product.activeClearanceSale.discountValue || product.activeClearanceSale.discountPercent || "20"));
        if (product.activeClearanceSale.startDate && product.activeClearanceSale.endDate) {
          const start = new Date(product.activeClearanceSale.startDate);
          const end = new Date(product.activeClearanceSale.endDate);
          const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            setClearanceDuration(String(diffDays));
          }
          const sStr = start.toISOString().split("T")[0];
          setClearanceStartDate(sStr >= todayDateValue() ? sStr : todayDateValue());
        }
      }
    }
    if (type === "markdown" && product?.activeMarkdownRule) {
      setStartingDiscount(String(product.activeMarkdownRule.startingDiscount ?? 10));
      setIncreasePercent(String(product.activeMarkdownRule.increasePercent ?? product.activeMarkdownRule.incrementPercent ?? 10));
      setDecreasePercent(String(product.activeMarkdownRule.decreasePercent ?? 3));
      setMinimumDiscount(String(product.activeMarkdownRule.minimumDiscount ?? 5));
      setMaximumDiscount(String(product.activeMarkdownRule.maximumDiscount ?? 50));
    } else if (type === "markdown") {
      setStartingDiscount("10");
      setIncreasePercent("10");
      setDecreasePercent("3");
      setMinimumDiscount("5");
      setMaximumDiscount("50");
    }
    setActiveModal(type);

    if (type === "bundle" && companionOptions.length === 0) {
      try {
        const companions = await fetchCompanionProducts(activeShop, product?.id || variantId);
        setCompanionList(companions || []);
        const options = (companions || []).map((c) => ({
          label: `${c.title} (${c.stock} in stock)`,
          value: c.id,
        }));
        setCompanionOptions(options);
        if (options.length > 0) {
          setCompanionProductId(options[0].value);
        }
      } catch (err) {
        console.error("Failed to load companion products:", err);
      }
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalError("");
    setClearanceErrors({});
  };

  const todayDateValue = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  };

  const getClearanceFieldError = (field, value) => {
    let message = "";
    if (field === "startDate") {
      if (!value) message = "Start date is required.";
      else {
        const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const parsedDate = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : null;
        const isValidDate = parsedDate && parsedDate.getFullYear() === Number(parts[1]) && parsedDate.getMonth() === Number(parts[2]) - 1 && parsedDate.getDate() === Number(parts[3]);
        if (!isValidDate) message = "Please enter a valid start date.";
        else if (value < todayDateValue()) message = "Start date cannot be in the past.";
      }
    }
    if (field === "discount" && (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 100)) message = "Discount must be greater than 0 and no more than 100%.";
    if (field === "duration" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) message = "Duration must be greater than 0 days.";
    return message;
  };

  const validateClearanceField = (field, value) => {
    const message = getClearanceFieldError(field, value);
    setClearanceErrors((current) => ({ ...current, [field]: message }));
    return message;
  };

  const clearanceFormInvalid =
    Boolean(getClearanceFieldError("startDate", clearanceStartDate)) ||
    Boolean(getClearanceFieldError("discount", clearanceDiscount)) ||
    Boolean(getClearanceFieldError("duration", clearanceDuration));

  const validateClearanceForm = () => {
    const errors = {
      startDate: validateClearanceField("startDate", clearanceStartDate),
      discount: validateClearanceField("discount", clearanceDiscount),
      duration: validateClearanceField("duration", clearanceDuration),
    };
    setClearanceErrors(errors);
    return errors;
  };

  // Submit Handlers
  const handleClearanceSubmit = async () => {
    if (isSubmitting || isDeleting) return;
    const validationErrors = validateClearanceForm();
    if (Object.values(validationErrors).some(Boolean)) return;
    try {
      setIsSubmitting(true);
      setModalError("");

      const discount = Number(clearanceDiscount);
      const duration = Number(clearanceDuration);
      const isEdit = Boolean(product.activeClearanceSale);

      const result = await executeClearanceSale(activeShop, product?.id || variantId, {
        variantId: product?.shopifyVariantId || variantId,
        discountPercent: discount,
        durationDays: duration,
        startDate: clearanceStartDate,
        title: `Clearance ${clearanceDiscount}% Off - ${product?.title}`,
      });

      setActionSuccess(`✓ Clearance Sale ${isEdit ? "Updated" : "Created"}! ${result.discountPercent || discount}% automatic discount has been created in Shopify.`);
      closeModal();
      await loadDetail();
    } catch (err) {
      setModalError(err.message || "Failed to save clearance sale.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearanceDelete = async () => {
    if (isSubmitting || isDeleting) return;
    try {
      setIsDeleting(true);
      setModalError("");
      await executeDeleteClearanceSale(activeShop, product?.id || variantId);
      setActionSuccess("Clearance Sale Deleted successfully.");
      setDeleteConfirmOpen(false);
      closeModal();
      await loadDetail();
    } catch (err) {
      setModalError(err.message || "Failed to delete clearance sale.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBundleDeleteDirect = async () => {
    if (isDeletingBundle || isSubmitting) return;
    try {
      setIsDeletingBundle(true);
      setModalError("");
      await executeDeleteBundle(activeShop, product?.id || variantId);
      setActionSuccess("✓ Bundle deleted successfully! It has been removed from MongoDB and storefront.");
      setDeleteBundleConfirmOpen(false);
      closeModal();
      await loadDetail();
    } catch (err) {
      setModalError(err.message || "Failed to delete bundle.");
    } finally {
      setIsDeletingBundle(false);
    }
  };

  const handleCollectionSubmit = async () => {
    try {
      setIsSubmitting(true);
      setModalError("");

      await executeAddToCollection(activeShop, product?.id || variantId, {
        variantId: product?.shopifyVariantId || variantId,
      });

      setActionSuccess("✓ Product Added! Product was added to Flash Clearance collection.");
      closeModal();
      await loadDetail();
    } catch (err) {
      setModalError(err.message || "Failed to add product to Flash Clearance collection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkdownSubmit = async () => {
    try {
      setIsSubmitting(true);
      setModalError("");

      const start = Number(startingDiscount);
      const inc = Number(increasePercent);
      const dec = Number(decreasePercent);
      const min = Number(minimumDiscount);
      const max = Number(maximumDiscount);

      if (isNaN(start) || start < 5 || start > 50) {
        throw new Error("Starting discount must be between 5% and 50%.");
      }
      if (isNaN(min) || min < 5 || min > 50) {
        throw new Error("Minimum discount must be between 5% and 50%.");
      }
      if (isNaN(max) || max < 5 || max > 50) {
        throw new Error("Maximum discount must be between 5% and 50%.");
      }
      if (isNaN(inc) || inc < 0 || inc > 50) {
        throw new Error("Increase by percentage must be between 0% and 50%.");
      }
      if (isNaN(dec) || dec < 0 || dec > 50) {
        throw new Error("Decrease by percentage must be between 0% and 50%.");
      }
      if (min > max) {
        throw new Error("Minimum discount cannot be greater than maximum discount.");
      }
      if (start < min || start > max) {
        throw new Error("Starting discount must be between minimum and maximum discount.");
      }

      const result = await executeProgressiveMarkdown(activeShop, product?.id || variantId, {
        variantId: product?.shopifyVariantId || variantId,
        startingDiscount: start,
        increasePercent: inc,
        decreasePercent: dec,
        minimumDiscount: min,
        maximumDiscount: max,
      });

      const nextDate = result.rule?.nextEvaluationAt || result.rule?.nextRunAt
        ? new Date(result.rule.nextEvaluationAt || result.rule.nextRunAt).toLocaleString()
        : "in 24 hours";
      setActionSuccess(`✓ Progressive Markdown Enabled! Starting: ${start}%, Next 24h evaluation: ${nextDate}`);
      closeModal();
      await loadDetail();
    } catch (err) {
      setModalError(err.message || "Failed to enable progressive markdown rule.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBundleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setModalError("");

      const selectedCompanion = companionList.find(
        (c) => (c.productId || c.id) === companionProductId
      );

      await executeCreateBundle(activeShop, product?.id || variantId, {
        deadStockProductId: product?.shopifyProductId || product?.productId || product?.id,
        deadStockVariantId: product?.shopifyVariantId || product?.variantId || variantId,
        companionProductId: selectedCompanion?.productId || selectedCompanion?.id || companionProductId,
        companionVariantId: selectedCompanion?.variantId || null,
        deadStockTitle: product?.title || product?.productTitle || "",
        companionTitle: selectedCompanion?.title || "",
        deadStockImage: product?.image || "",
        companionImage: selectedCompanion?.image || "",
        deadStockPrice: product?.currentPrice || product?.costPrice || 0,
        companionPrice: selectedCompanion?.price || 0,
        bundleName,
        discountPercent: Number(bundleDiscount),
      });

      setActionSuccess(
        product?.activeBundle
          ? "✓ Bundle Updated! Bundle configuration updated successfully."
          : "✓ Bundle Created! Bundle configuration saved successfully."
      );
      closeModal();
      await loadDetail();
    } catch (err) {
      setModalError(err.message || "Failed to save bundle.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBundleDelete = async () => {
    if (isSubmitting || isDeletingBundle) return;
    try {
      setIsDeletingBundle(true);
      setModalError("");
      await executeDeleteBundle(activeShop, product?.id || variantId);
      setActionSuccess("✓ Bundle deleted successfully! It has been removed from your storefront.");
      setDeleteBundleConfirmOpen(false);
      closeModal();
      await loadDetail();
    } catch (err) {
      setModalError(err.message || "Failed to delete bundle.");
    } finally {
      setIsDeletingBundle(false);
    }
  };

  const handleMarkdownDelete = async () => {
    if (isSubmitting || isDeletingMarkdown) return;
    try {
      setIsDeletingMarkdown(true);
      setModalError("");
      const targetId = product?.shopifyVariantId || product?.variantId || product?.shopifyProductId || product?.productId || product?.id || variantId;
      await executeStopProgressiveMarkdown(activeShop, targetId);
      setActionSuccess("✓ Progressive Markdown deleted! Original price restored on Shopify & storefront.");
      setDeleteMarkdownConfirmOpen(false);
      closeModal();
      setProduct((prev) => (prev ? { ...prev, activeMarkdownRule: null } : prev));
      await loadDetail();
    } catch (err) {
      setModalError(err.message || "Failed to stop progressive markdown.");
    } finally {
      setIsDeletingMarkdown(false);
    }
  };

  if (loading) {
    return (
      <Page title="Loading Product Detail">
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Spinner accessibilityLabel="Loading product detail" size="large" />
        </div>
      </Page>
    );
  }

  if (error || !product) {
    return (
      <Page
        backAction={{ content: "Dead Stock", onAction: handleBack }}
        title="Error Loading Detail"
      >
        <Banner tone="critical">
          <p>{error || "Product detail unavailable."}</p>
        </Banner>
      </Page>
    );
  }

  const stock = Number(product.currentStock ?? product.stock ?? 0);
  const sellingPrice = Number(product.currentPrice ?? product.price ?? 0);
  const compareAtPrice = Number(product.compareAtPrice ?? 0);
  const unitCost = Number(product.unitCost ?? product.costPrice ?? 0);
  const stockValue = Number((stock * (sellingPrice > 0 ? sellingPrice : unitCost)).toFixed(2));
  const sku = product.sku && product.sku.trim() !== "" ? product.sku : "N/A";
  const daysUnsold = product.daysUnsold ?? 0;
  const salesVelocity = product.salesVelocity ?? 0;

  const formattedSellingPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(sellingPrice);
  const formattedCompareAt = compareAtPrice > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(compareAtPrice) : null;
  const formattedStockValue = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(stockValue);
  const isClearanceActive = Boolean(
    product?.activeClearanceSale &&
      (product.activeClearanceSale.status === "ACTIVE" ||
        product.activeClearanceSale.status === "SCHEDULED")
  );

  return (
    <Page
      fullWidth
      backAction={{ content: "Back to Dead Stock", onAction: handleBack }}
      title={product.title || "Dead Stock Product"}
      subtitle={`SKU: ${sku}`}
    >
      <Layout>
        {actionNotification && (
          <Layout.Section>
            <Banner
              tone={actionNotification.tone || "info"}
              title={actionNotification.title}
              onDismiss={() => setActionNotification(null)}
            >
              <p>{actionNotification.message}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionSuccess && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setActionSuccess("")}>
              <p>{actionSuccess}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Product Overview Header */}
        <Layout.Section>
          <Card>
            <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title}
                  style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "12px",
                    objectFit: "cover",
                    border: "1px solid #E2E8F0",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100px",
                    height: "100px",
                    borderRadius: "12px",
                    backgroundColor: "#EEF2FF",
                    color: "#4F46E5",
                    fontSize: "36px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {product.title?.charAt(0) || "?"}
                </div>
              )}

              <BlockStack gap="100">
                <Text variant="headingLg" as="h1">
                  {product.title}
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  SKU: {sku} | ID: {product.shopifyProductId || product.id}
                </Text>
                {actionsLog.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    {actionsLog.slice(0, 3).map((act) => (
                      <Badge
                        key={act._id}
                        tone={act.status === "COMPLETED" || act.status === "ACTIVE" ? "success" : "critical"}
                      >
                        {act.actionType}: {act.status}
                      </Badge>
                    ))}
                  </div>
                )}
              </BlockStack>
            </div>
          </Card>
        </Layout.Section>

        {/* Metrics Grid */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
            {/* Card 1: Shopify Selling Price */}
            <Card>
              <BlockStack gap="100">
                <Text variant="headingXs" tone="subdued" as="h3">SHOPIFY SELLING PRICE</Text>
                <Text variant="headingLg" as="p">{formattedSellingPrice}</Text>
                {formattedCompareAt && (
                  <Text variant="bodySm" tone="subdued" as="span">
                    Original: <span style={{ textDecoration: "line-through" }}>{formattedCompareAt}</span>
                  </Text>
                )}
              </BlockStack>
            </Card>

            {/* Card 2: Current Inventory Stock */}
            <Card>
              <BlockStack gap="100">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingXs" tone="subdued" as="h3">CURRENT STOCK</Text>
                  <Badge tone={stock > 0 ? "success" : "critical"}>
                    {stock > 0 ? "In Stock" : "Out of Stock"}
                  </Badge>
                </InlineStack>
                <Text variant="headingLg" as="p">{stock} units</Text>
              </BlockStack>
            </Card>

            {/* Card 3: Potential Stock Value */}
            <Card>
              <BlockStack gap="100">
                <Text variant="headingXs" tone="critical" as="h3">POTENTIAL STOCK VALUE</Text>
                <Text variant="headingLg" tone="critical" as="p">{formattedStockValue}</Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {stock > 0 ? `Total inventory retail value` : `No inventory value`}
                </Text>
              </BlockStack>
            </Card>

            {/* Card 4: Days Unsold */}
            <Card>
              <BlockStack gap="100">
                <Text variant="headingXs" tone="subdued" as="h3">DAYS UNSOLD</Text>
                <Text variant="headingLg" as="p">
                  {daysUnsold >= 900 || daysUnsold === 0 ? "Stagnant (60+ days)" : `${daysUnsold} days`}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">Dead stock stagnation</Text>
              </BlockStack>
            </Card>

            {/* Card 5: Last Sold Date */}
            <Card>
              <BlockStack gap="100">
                <Text variant="headingXs" tone="subdued" as="h3">LAST SOLD DATE</Text>
                <Text variant="headingMd" as="p">
                  {product.lastSoldAt ? new Date(product.lastSoldAt).toLocaleDateString() : "Never sold"}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {product.lastSoldAt ? "Based on Shopify orders" : "No orders found for this SKU"}
                </Text>
              </BlockStack>
            </Card>

            {/* Card 6: Sales Velocity */}
            <Card>
              <BlockStack gap="100">
                <Text variant="headingXs" tone="subdued" as="h3">SALES VELOCITY</Text>
                <Text variant="headingMd" as="p">
                  {salesVelocity ? `${salesVelocity.toFixed(2)} units/day` : "0.00 units/day"}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {salesVelocity > 0 ? "Daily average (last 30d)" : "0 sales in last 30 days"}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Recommended Recovery Actions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Recommended Dead Stock Recovery Actions</Text>

              <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "10px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    minHeight: "180px",
                  }}
                >
                  <BlockStack gap="100">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingSm" as="h3">
                        🏷️ Clearance Sale
                      </Text>

                      <Badge tone={isClearanceActive ? "success" : "subdued"}>
                        {isClearanceActive ? "● Enabled" : "○ Not Configured"}
                      </Badge>
                    </InlineStack>

                    <BlockStack gap="050">
                      <Text variant="bodySm" tone="subdued">
                        Why: 60+ days unsold
                      </Text>

                      <Text variant="bodySm" tone="subdued">
                        Best for: Fast recovery
                      </Text>

                      <Text variant="bodySm" tone="subdued">
                        How: Immediate discount
                      </Text>

                      <Text variant="bodySm" tone="subdued">
                        Result: Quick stock movement
                      </Text>
                    </BlockStack>
                  </BlockStack>

                  <InlineStack gap="200" align="start">
                    <Button
                      size="slim"
                      onClick={() => openModal("clearance")}
                    >
                      {isClearanceActive ? "Edit Sale" : "Launch Sale"}
                    </Button>
                    <Button
                      size="slim"
                      variant="tertiary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/app/customization/clearance-sale");
                      }}
                    >
                      Customize
                    </Button>
                  </InlineStack>
                </div>

                <div
                  style={{
                    padding: "20px",
                    borderRadius: "10px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    minHeight: "180px",
                  }}
                >
                  <BlockStack gap="100">
  <InlineStack align="space-between" blockAlign="center">
    <Text variant="headingSm" as="h3">
      📦 Dead Stock Bundle
    </Text>

    <Badge tone={product?.activeBundle ? "success" : "subdued"}>
      {product?.activeBundle ? "● Active Bundle" : "○ Not Configured"}
    </Badge>
  </InlineStack>

  <BlockStack gap="050">
    <Text variant="bodySm" tone="subdued">
      Why: Low product demand
    </Text>

    <Text variant="bodySm" tone="subdued">
      Best for: Avoiding heavy discounts
    </Text>

    <Text variant="bodySm" tone="subdued">
      How: Bundle with a companion product
    </Text>

    <Text variant="bodySm" tone="subdued">
      Result: Increase product value
    </Text>
  </BlockStack>
</BlockStack>
                  <InlineStack gap="200" align="start">
                    <Button
                      size="slim"
                      onClick={() => openModal("bundle")}
                    >
                      {product?.activeBundle ? "Edit Bundle" : "Create Bundle"}
                    </Button>
                  </InlineStack>
                </div>

                <div
                  style={{
                    padding: "20px",
                    borderRadius: "10px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    minHeight: "180px",
                  }}
                >
                  <BlockStack gap="100">
  <InlineStack align="space-between" blockAlign="center">
    <Text variant="headingSm" as="h3">
      📉 Progressive Markdown
    </Text>

    <Badge tone={product?.activeMarkdownRule ? "success" : "subdued"}>
      {product?.activeMarkdownRule
        ? `● Active (${product.activeMarkdownRule.currentDiscount}% OFF)`
        : "○ Not Configured"}
    </Badge>
  </InlineStack>

  <BlockStack gap="050">
    <Text variant="bodySm" tone="subdued">
      Why: Sales performance needs monitoring
    </Text>

    <Text variant="bodySm" tone="subdued">
      Best for: Controlled discounting
    </Text>

    <Text variant="bodySm" tone="subdued">
      How: Adjust discount every 24 hours
    </Text>

    <Text variant="bodySm" tone="subdued">
      Result: Optimize discount and recover stock
    </Text>
  </BlockStack>
</BlockStack>

                  <InlineStack gap="200" align="start">
                    <Button
                      size="slim"
                      onClick={() => openModal("markdown")}
                    >
                      {product?.activeMarkdownRule ? "Manage Rule" : "Create Markdown"}
                    </Button>
                  </InlineStack>
                </div>
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Action Audit Log Table (First 3 Actions) */}
        {actionsLog.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">Action Log</Text>
                  {actionsLog.length > 3 && (
                    <Text variant="bodySm" tone="subdued" as="span">
                      Showing latest 3 of {actionsLog.length} actions
                    </Text>
                  )}
                </InlineStack>
                {actionsLog.slice(0, 3).map((log) => (
                  <div
                    key={log._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      backgroundColor: "#F8FAFC",
                      borderRadius: "8px",
                      fontSize: "13px",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <div>
                      <strong>{log.actionType}</strong> — {new Date(log.createdAt).toLocaleString()}
                      {log.error && <div style={{ color: "#EF4444", marginTop: "2px" }}>Error: {log.error}</div>}
                    </div>
                    <Badge tone={log.status === "COMPLETED" || log.status === "ACTIVE" ? "success" : "critical"}>
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {/* Clearance Sale Modal */}
      {activeModal === "clearance" && (
        <Modal
          open
          onClose={closeModal}
          title={product.activeClearanceSale ? "Edit Clearance Sale" : "Create Clearance Sale"}
          footer={(
            <InlineStack align="end" gap="200">
              <Button onClick={closeModal} disabled={isSubmitting || isDeleting}>
                Cancel
              </Button>
              {product.activeClearanceSale && (
                <Button
                  tone="critical"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isSubmitting || isDeleting}
                >
                  Delete Sale
                </Button>
              )}
              <Button
                variant="primary"
                onClick={handleClearanceSubmit}
                loading={isSubmitting}
                disabled={isSubmitting || isDeleting || clearanceFormInvalid}
              >
                {product.activeClearanceSale ? "Update Sale" : "Create Sale"}
              </Button>
            </InlineStack>
          )}
        >
          <Modal.Section>
            <FormLayout>
              {modalError && (
                <Banner tone="critical">
                  <p>{modalError}</p>
                </Banner>
              )}
              <TextField label="Product" value={product.title} disabled autocomplete="off" />
              <TextField
                label="Current price"
                value={product.currentPrice != null ? `$${Number(product.currentPrice).toFixed(2)}` : "Unavailable"}
                disabled
                autocomplete="off"
              />
              <TextField label="Current Inventory" value={`${stock} units`} disabled autocomplete="off" />
              <Select
                label="Discount"
                options={[
                  { label: "10%", value: "10" },
                  { label: "15%", value: "15" },
                  { label: "20%", value: "20" },
                  { label: "25%", value: "25" },
                  { label: "30%", value: "30" },
                  { label: "Custom", value: "custom" },
                ]}
                value={["10", "15", "20", "25", "30"].includes(clearanceDiscount) ? clearanceDiscount : "custom"}
                onChange={(value) => {
                  const nextValue = value === "custom" ? "" : value;
                  setClearanceDiscount(nextValue);
                  validateClearanceField("discount", nextValue);
                }}
                error={clearanceErrors.discount}
              />
              {!["10", "15", "20", "25", "30"].includes(clearanceDiscount) && (
                <TextField
                  label="Custom discount (%)"
                  type="number"
                  value={clearanceDiscount}
                  onChange={(value) => {
                    setClearanceDiscount(value);
                    validateClearanceField("discount", value);
                  }}
                  onBlur={() => validateClearanceField("discount", clearanceDiscount)}
                  error={clearanceErrors.discount}
                  autoComplete="off"
                />
              )}
              <Select
                label="Duration"
                options={[
                  { label: "7 days", value: "7" },
                  { label: "14 days", value: "14" },
                  { label: "30 days", value: "30" },
                  { label: "Custom", value: "custom" },
                ]}
                value={["7", "14", "30"].includes(clearanceDuration) ? clearanceDuration : "custom"}
                onChange={(value) => {
                  const nextValue = value === "custom" ? "" : value;
                  setClearanceDuration(nextValue);
                  validateClearanceField("duration", nextValue);
                }}
                error={clearanceErrors.duration}
              />
              {!["7", "14", "30"].includes(clearanceDuration) && (
                <TextField
                  label="Custom duration (days)"
                  type="number"
                  value={clearanceDuration}
                  onChange={(value) => {
                    setClearanceDuration(value);
                    validateClearanceField("duration", value);
                  }}
                  onBlur={() => validateClearanceField("duration", clearanceDuration)}
                  error={clearanceErrors.duration}
                  autoComplete="off"
                />
              )}
              <TextField
                label="Start date"
                type="date"
                min={todayDateValue()}
                value={clearanceStartDate}
                onChange={(value) => {
                  setClearanceStartDate(value);
                  validateClearanceField("startDate", value);
                }}
                onBlur={() => validateClearanceField("startDate", clearanceStartDate)}
                error={clearanceErrors.startDate}
                autoComplete="off"
              />
            
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}

      {deleteConfirmOpen && (
        <Modal
          open
          onClose={() => setDeleteConfirmOpen(false)}
          title="Delete Clearance Sale"
          primaryAction={{
            content: "Delete Sale",
            onAction: handleClearanceDelete,
            destructive: true,
            loading: isDeleting,
          }}
          secondaryActions={[{ content: "Cancel", onAction: () => setDeleteConfirmOpen(false), disabled: isDeleting }]}
        >
          <Modal.Section>
            <Text as="p">Are you sure you want to delete this clearance sale? This action cannot be undone.</Text>
          </Modal.Section>
        </Modal>
      )}

      {/* Delete Bundle Confirm Modal */}
      {deleteBundleConfirmOpen && (
        <Modal
          open
          onClose={() => !isDeletingBundle && setDeleteBundleConfirmOpen(false)}
          title="Delete Dead Stock Bundle"
          primaryAction={{
            content: "Delete Bundle",
            onAction: handleBundleDeleteDirect,
            destructive: true,
            loading: isDeletingBundle,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setDeleteBundleConfirmOpen(false),
              disabled: isDeletingBundle,
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete this dead stock bundle? This will remove the bundle offer from your storefront immediately.
            </Text>
          </Modal.Section>
        </Modal>
      )}

      {/* Add to Clearance Collection Modal */}
      {activeModal === "collection" && (
        <Modal
          open
          onClose={closeModal}
          title="Add to Flash Clearance Collection"
          primaryAction={{
            content: "Add to Flash Clearance",
            onAction: handleCollectionSubmit,
            loading: isSubmitting,
          }}
          secondaryActions={[{ content: "Cancel", onAction: closeModal }]}
        >
          <Modal.Section>
            <FormLayout>
              {modalError && (
                <Banner tone="critical">
                  <p>{modalError}</p>
                </Banner>
              )}
              <p>
                This will automatically add <strong>{product.title}</strong> to your store's{" "}
                <strong>Flash Clearance</strong> collection in Shopify. If the collection does not exist, it will be created automatically.
              </p>
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}

      {/* Progressive Markdown Modal */}
      {activeModal === "markdown" && (
        <Modal
          open
          onClose={closeModal}
          title="Progressive Markdown"
          footer={(
            <InlineStack align="end" gap="200">
              <Button onClick={closeModal} disabled={isSubmitting || isDeletingMarkdown}>
                Cancel
              </Button>
              {product?.activeMarkdownRule && (
                <Button
                  tone="critical"
                  onClick={() => setDeleteMarkdownConfirmOpen(true)}
                  disabled={isSubmitting || isDeletingMarkdown}
                >
                  Delete Rule
                </Button>
              )}
              <Button
                variant="primary"
                onClick={handleMarkdownSubmit}
                loading={isSubmitting}
                disabled={isSubmitting || isDeletingMarkdown}
              >
                {product?.activeMarkdownRule ? "Update Rule" : "Enable Rule"}
              </Button>
            </InlineStack>
          )}
        >
          <Modal.Section>
            <FormLayout>
              {modalError && (
                <Banner tone="critical">
                  <p>{modalError}</p>
                </Banner>
              )}
              <TextField
                label="Starting Discount (%)"
                type="number"
                value={startingDiscount}
                onChange={(val) => setStartingDiscount(val)}
                onBlur={() => setStartingDiscount(String(clampDiscount(startingDiscount)))}
                autoComplete="off"
                min={5}
                max={50}
                step={1}
              />
              <TextField
                label="Increase By (%)"
                type="number"
                value={increasePercent}
                onChange={(val) => setIncreasePercent(val)}
                onBlur={() => setIncreasePercent(String(clampAdjustment(increasePercent)))}
                autoComplete="off"
                min={0}
                max={50}
                step={1}
                helpText="Applied when 0 units are sold in the last 24 hours"
              />
              <TextField
                label="Decrease By (%)"
                type="number"
                value={decreasePercent}
                onChange={(val) => setDecreasePercent(val)}
                onBlur={() => setDecreasePercent(String(clampAdjustment(decreasePercent)))}
                autoComplete="off"
                min={0}
                max={50}
                step={1}
                helpText="Applied when 2 or more units are sold in the last 24 hours"
              />
              <TextField
                label="Minimum Discount (%)"
                type="number"
                value={minimumDiscount}
                onChange={(val) => setMinimumDiscount(val)}
                onBlur={() => setMinimumDiscount(String(clampDiscount(minimumDiscount)))}
                autoComplete="off"
                min={5}
                max={50}
                step={1}
              />
              <TextField
                label="Maximum Discount (%)"
                type="number"
                value={maximumDiscount}
                onChange={(val) => setMaximumDiscount(val)}
                onBlur={() => setMaximumDiscount(String(clampDiscount(maximumDiscount)))}
                autoComplete="off"
                min={5}
                max={50}
                step={1}
              />
              <TextField
                label="Evaluation Frequency"
                value="Every 24 Hours"
                disabled
                autoComplete="off"
                helpText="Automatic 24-hour evaluation cycle checks product sales and adjusts discounts accordingly"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}

      {/* Delete Progressive Markdown Confirm Modal */}
      {deleteMarkdownConfirmOpen && (
        <Modal
          open
          onClose={() => !isDeletingMarkdown && setDeleteMarkdownConfirmOpen(false)}
          title="Delete Progressive Markdown Rule"
          primaryAction={{
            content: "Delete Rule",
            onAction: handleMarkdownDelete,
            destructive: true,
            loading: isDeletingMarkdown,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setDeleteMarkdownConfirmOpen(false),
              disabled: isDeletingMarkdown,
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete this progressive markdown rule? This will immediately restore the original price on Shopify and remove the markdown discount from your storefront.
            </Text>
          </Modal.Section>
        </Modal>
      )}

      {/* Dead Stock BOGO Bundle Modal */}
      {activeModal === "bundle" && (
        <CreateDeadStockBundleModal
          open={activeModal === "bundle"}
          onClose={closeModal}
          shop={activeShop}
          deadStockProduct={product}
          initialBundle={product?.activeBundle}
          onSuccess={(savedBundle) => {
            setActionSuccess(
              product?.activeBundle
                ? "✓ BOGO Bundle Updated! Configuration updated successfully."
                : "✓ BOGO Bundle Created! Configuration saved successfully."
            );
            loadDetail();
          }}
          onDeleted={() => {
            setActionSuccess("✓ Bundle deleted successfully! It has been removed from your storefront.");
            setProduct((prev) => (prev ? { ...prev, activeBundle: null } : prev));
            loadDetail();
          }}
        />
      )}
    </Page>
  );
}
