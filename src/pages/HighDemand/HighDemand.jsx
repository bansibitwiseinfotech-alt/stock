import React, { useEffect, useState } from "react";

import {
  Page,
  Layout,
  Card,
  Banner,
  IndexTable,
  Badge,
  Button,
  Select,
  Thumbnail,
  InlineStack,
  Text,
  BlockStack,
  Box,
  Spinner,
} from "@shopify/polaris";

import HighDemandProduct from "./HighDemandProduct";

export default function HighDemand({
  shopDomain = "",
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVariantId, setSelectedVariantId] =
    useState(null);
  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const [riskLevelFilter, setRiskLevelFilter] =
    useState("all");

  // ==================================================
  // LOAD HIGH-DEMAND DATA
  // ==================================================

  const loadData = async () => {
    if (!shopDomain) {
      setProducts([]);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/high-demand?shop=${encodeURIComponent(
          shopDomain
        )}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to load high-demand data"
        );
      }

      setProducts(
        Array.isArray(data.products)
          ? data.products
          : []
      );
    } catch (err) {
      console.error(
        "Failed to load high demand data:",
        err
      );

      setError(
        err.message ||
          "Failed to load high-demand products."
      );

      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // ==================================================
  // LOAD ON SHOP CHANGE
  // ==================================================

  useEffect(() => {
    loadData();
  }, [shopDomain]);

  // ==================================================
  // DETAIL PAGE
  // ==================================================

  if (selectedVariantId || selectedProduct) {
    const activeItem =
      selectedProduct ||
      products.find(
        (p) => p.variantId === selectedVariantId
      ) ||
      {};

    return (
      <HighDemandProduct
        productId={activeItem.productId || ""}
        variantId={
          activeItem.variantId || selectedVariantId
        }
        shop={shopDomain}
        riskLevel={activeItem.riskLevel || "SAFE"}
        currentStock={activeItem.currentStock ?? 0}
        salesVelocity={
          activeItem.salesVelocity ?? 0
        }
        daysUntilStockout={
          activeItem.daysUntilStockout ?? null
        }
        sold30Days={
          activeItem.last30DaysSales ??
          activeItem.sold30Days ??
          0
        }
        initialProduct={activeItem}
        onBack={() => {
          setSelectedVariantId(null);
          setSelectedProduct(null);
        }}
      />
    );
  }

  // ==================================================
  // FILTER PRODUCTS
  // ==================================================

  const filteredProducts = products.filter(
    (product) => {
      const level = (
        product.riskLevel || "SAFE"
      ).toUpperCase();

      if (riskLevelFilter === "all") {
        return true;
      }

      if (riskLevelFilter === "High") {
        return (
          level === "HIGH" ||
          level === "CRITICAL"
        );
      }

      if (riskLevelFilter === "Medium") {
        return level === "MEDIUM";
      }

      if (riskLevelFilter === "Low") {
        return (
          level === "SAFE" ||
          level === "LOW"
        );
      }

      return true;
    }
  );

  // ==================================================
  // COUNTS & METRICS
  // ==================================================

  const criticalCount = products.filter(
    (product) => String(product.riskLevel).toUpperCase() === "CRITICAL"
  ).length;

  const highCount = products.filter(
    (product) => String(product.riskLevel).toUpperCase() === "HIGH"
  ).length;

  const mediumCount = products.filter(
    (product) => String(product.riskLevel).toUpperCase() === "MEDIUM"
  ).length;

  const safeCount = products.filter(
    (product) => {
      const r = String(product.riskLevel).toUpperCase();
      return r === "SAFE" || r === "LOW";
    }
  ).length;

  const highRiskCount = criticalCount + highCount;

  // ==================================================
  // RISK HELPERS (SIMPLE POLARIS PALETTE)
  // ==================================================

  const getRiskBadgeStyle = (risk) => {
    const level = String(risk || "SAFE").toUpperCase();
    if (level === "CRITICAL") {
      return {
        bg: "#FFF4F2",
        color: "#D82C0D",
        border: "#FED3D1",
        label: "Critical",
      };
    }
    if (level === "HIGH") {
      return {
        bg: "#FFF8DB",
        color: "#916A00",
        border: "#FFECA1",
        label: "High Risk",
      };
    }
    if (level === "MEDIUM") {
      return {
        bg: "#FFF8DB",
        color: "#916A00",
        border: "#FFECA1",
        label: "Medium",
      };
    }
    return {
      bg: "#F1F2F4",
      color: "#303030",
      border: "#D2D5D8",
      label: "Safe",
    };
  };

  // ==================================================
  // TABLE ROWS
  // ==================================================

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const rowMarkup = filteredProducts.map((item, index) => {
    const title = item.productName || item.title || "Product";
    const variantTitle =
      item.variantTitle && item.variantTitle !== "Default Title"
        ? ` (${item.variantTitle})`
        : "";

    const stock = Number(item.currentStock) || 0;
    const sold30Days = Number(item.last30DaysSales) || 0;
    const velocity = Number(item.salesVelocity || 0).toFixed(2);
    const daysLeft =
      item.daysUntilStockout !== null && item.daysUntilStockout !== undefined
        ? Number(item.daysUntilStockout)
        : null;

    const risk = String(item.riskLevel || "SAFE").toUpperCase();
    const riskStyle = getRiskBadgeStyle(risk);
    const reorderQuantity = Number(item.reorderQuantity) || 0;
    const reorderStatus = item.reorderStatus || "INSUFFICIENT_DATA";

    return (
      <IndexTable.Row
        id={item.variantId || String(index)}
        key={item.variantId || index}
        position={index}
      >
        {/* PRODUCT */}
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center">
            {item.image ? (
              <Thumbnail source={item.image} alt={title} size="small" />
            ) : null}

            <BlockStack gap="050">
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {title}
                {variantTitle}
              </Text>

              {item.sku ? (
                <Text variant="bodySm" tone="subdued" as="span">
                  SKU: {item.sku}
                </Text>
              ) : null}
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>

        {/* CURRENT STOCK */}
        <IndexTable.Cell>
          <span style={{
            fontWeight: stock <= 0 ? "600" : "400",
            color: stock <= 0 ? "#D82C0D" : "#202223",
          }}>
            {stock}
          </span>
        </IndexTable.Cell>

        {/* SOLD 30 DAYS */}
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone="subdued">
            {sold30Days}
          </Text>
        </IndexTable.Cell>

        {/* SALES VELOCITY */}
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone="subdued">
            {velocity} / day
          </Text>
        </IndexTable.Cell>

        {/* DAYS LEFT */}
        <IndexTable.Cell>
          <span style={{
            fontWeight: typeof daysLeft === "number" && daysLeft <= 0 ? "600" : "400",
            color: typeof daysLeft === "number" && daysLeft <= 0 ? "#D82C0D" : "#202223",
          }}>
            {typeof daysLeft === "number" ? `${daysLeft} days` : "N/A"}
          </span>
        </IndexTable.Cell>

        {/* RISK */}
        <IndexTable.Cell>
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "600",
            background: riskStyle.bg,
            color: riskStyle.color,
            border: `1px solid ${riskStyle.border}`,
          }}>
            {riskStyle.label}
          </span>
        </IndexTable.Cell>

        {/* REORDER */}
        <IndexTable.Cell>
          {reorderStatus === "REORDER_REQUIRED" ? (
            <BlockStack gap="050">
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                📦 {reorderQuantity} units
              </Text>
              <Text variant="bodySm" tone="subdued" as="span">
                30-day coverage
              </Text>
            </BlockStack>
          ) : reorderStatus === "INSUFFICIENT_DATA" ? (
            <span style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: "500",
              background: "#F1F2F4",
              color: "#5C5F62",
              border: "1px solid #D2D5D8",
            }}>
              Insufficient Data
            </span>
          ) : (
            <span style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: "600",
              background: "#F1F8F5",
              color: "#1B5E20",
              border: "1px solid #C8E6C9",
            }}>
              Stock Sufficient
            </span>
          )}
        </IndexTable.Cell>

        {/* ACTION */}
        <IndexTable.Cell>
          <Button
            size="slim"
            onClick={() => {
              setSelectedProduct(item);
              setSelectedVariantId(item.variantId);
            }}
          >
            Manage
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // ==================================================
  // UI
  // ==================================================

  return (
    <Page
      fullWidth
      title="High-Demand Stockout Shield"
      subtitle="Protect high-demand products from running out of stock."
      primaryAction={{
        content: loading ? "Refreshing..." : "Refresh",
        onAction: loadData,
        loading,
      }}
    >
      <BlockStack gap="400">
        {/* ERROR BANNER */}
        {error && (
          <Banner
            title="Unable to load High-Demand data"
            tone="critical"
            onDismiss={() => setError("")}
          >
            <p>{error}</p>
          </Banner>
        )}

        {/* 4 SUMMARY METRIC CARDS (SIMPLE POLARIS DESIGN) */}
        {!loading && products.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
            {/* CARD 1: PRODUCTS ANALYZED */}
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
                  Products Analyzed
                </div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#202223", marginTop: "6px" }}>
                  {products.length}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "10px" }}>
                Active catalog variants evaluated
              </div>
            </div>

            {/* CARD 2: AT STOCKOUT RISK */}
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
                  Stockout Risk
                </div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: highRiskCount > 0 ? "#D82C0D" : "#202223", marginTop: "6px" }}>
                  {highRiskCount}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "10px" }}>
                {criticalCount} critical, {highCount} high risk
              </div>
            </div>

            {/* CARD 3: DEMAND WATCH */}
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
                  Demand Watch
                </div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#202223", marginTop: "6px" }}>
                  {mediumCount}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "10px" }}>
                Moderate sales velocity items
              </div>
            </div>

            {/* CARD 4: STOCK STABLE */}
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
                  Stock Stable
                </div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#202223", marginTop: "6px" }}>
                  {safeCount}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "10px" }}>
                Sufficient inventory coverage
              </div>
            </div>
          </div>
        )}

        {/* MAIN TABLE CONTAINER */}
        <Card padding="0">
          <Box padding="300" borderBlockEndWidth="025" borderColor="border">
            <InlineStack gap="300" align="space-between" blockAlign="center">
              <div style={{ width: "220px" }}>
                <Select
                  label="Risk Level"
                  labelHidden
                  options={[
                    { label: "All Risk Levels", value: "all" },
                    { label: "High Risk (Critical & High)", value: "High" },
                    { label: "Medium Risk", value: "Medium" },
                    { label: "Low / Safe Risk", value: "Low" },
                  ]}
                  value={riskLevelFilter}
                  onChange={setRiskLevelFilter}
                />
              </div>

              <Text variant="bodySm" tone="subdued" as="span">
                Showing {filteredProducts.length} of {products.length} products
              </Text>
            </InlineStack>
          </Box>

          {/* LOADING */}
          {loading ? (
            <Box padding="800">
              <InlineStack align="center" blockAlign="center">
                <Spinner size="small" accessibilityLabel="Loading high-demand products" />
              </InlineStack>
            </Box>
          ) : filteredProducts.length === 0 ? (
            <Box padding="800">
              <BlockStack gap="200" align="center">
                <Text variant="headingMd" as="h3" alignment="center">
                  {products.length === 0
                    ? "No High-Demand Products Found"
                    : "No Products Match This Filter"}
                </Text>

                <Text variant="bodyMd" tone="subdued" alignment="center" as="p">
                  {products.length === 0
                    ? "Your inventory currently has no products with high-demand stockout risk."
                    : "Try selecting a different risk level filter above."}
                </Text>
              </BlockStack>
            </Box>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={filteredProducts.length}
              headings={[
                { title: "PRODUCT" },
                { title: "STOCK" },
                { title: "SOLD (30D)" },
                { title: "VELOCITY" },
                { title: "DAYS LEFT" },
                { title: "RISK LEVEL" },
                { title: "REORDER" },
                { title: "ACTION" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}