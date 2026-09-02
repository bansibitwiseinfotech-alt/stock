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
  Pagination,
} from "@shopify/polaris";

import HighDemandProduct from "./HighDemandProduct";

export default function HighDemand({
  shopDomain = "",
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("high_demand_products");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
            setLoading(false);
          }
        }
      } catch (_) {}
    }
  }, []);
  const [error, setError] = useState("");
  const [selectedVariantId, setSelectedVariantId] =
    useState(null);
  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const [riskLevelFilter, setRiskLevelFilter] =
    useState("all");

  const ITEMS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [riskLevelFilter]);

  // ==================================================
  // LOAD HIGH-DEMAND DATA
  // ==================================================

  const loadData = async () => {
    if (!shopDomain) {
      setProducts([]);
      return;
    }

    try {
      if (products.length === 0) setLoading(true);
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

      if (Array.isArray(data.products)) {
        setProducts(data.products);
        try {
          sessionStorage.setItem("high_demand_products", JSON.stringify(data.products));
        } catch (_) {}
      }
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

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const rowMarkup = paginatedProducts.map((item, index) => {
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
          <div style={{ maxWidth: "340px", padding: "6px 0" }}>
            <InlineStack gap="300" blockAlign="center" wrap={false}>
              <div style={{ flexShrink: 0 }}>
                <Thumbnail
                  source={item.image || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
                  alt={title}
                  size="small"
                />
              </div>

              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <Text variant="bodyMd" fontWeight="bold" as="p" truncate>
                  {title}{variantTitle}
                </Text>

                <Text variant="bodySm" tone="subdued" as="p" truncate>
                  SKU: {item.sku && item.sku.trim() ? item.sku : "N/A"}
                </Text>
              </div>
            </InlineStack>
          </div>
        </IndexTable.Cell>

        {/* STOCK UNITS */}
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {stock} units
          </Text>
        </IndexTable.Cell>

        {/* SOLD 30 DAYS */}
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {sold30Days} units
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
          <Text variant="bodyMd" as="span">
           {typeof daysLeft === "number" ? `${daysLeft} days` : "N/A"}
          </Text>
        </IndexTable.Cell>

        {/* RISK LEVEL */}
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {riskStyle.label}
          </Text>
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
            Take Action
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
      title="High Demand"
      subtitle="Protect fast-selling products from running out of stock."
      
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

        {/* 4 SUMMARY METRIC CARDS */}
        {!loading && products.length > 0 && (
          <div className="high-demand-metrics-grid">
            {/* CARD 1: PRODUCTS ANALYZED */}
            <Card padding="400">
              <BlockStack gap="100">
                <Text variant="headingXs" tone="subdued" as="h3">
                  PRODUCTS ANALYZED
                </Text>
                <Text variant="heading2xl" as="p" fontWeight="bold">
                  {products.length}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Active catalog variants evaluated
                </Text>
              </BlockStack>
            </Card>

            {/* CARD 2: AT STOCKOUT RISK */}
            <Card padding="400">
              <BlockStack gap="100">
                <Text variant="headingXs" tone="subdued" as="h3">
                  STOCKOUT RISK
                </Text>
                <Text variant="heading2xl" as="p" fontWeight="bold">
                  {highRiskCount}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {criticalCount} critical, {highCount} high risk
                </Text>
              </BlockStack>
            </Card>

            {/* CARD 3: DEMAND WATCH */}
            <Card padding="400">
              <BlockStack gap="100">
                <Text variant="headingXs" tone="subdued" as="h3">
                  DEMAND WATCH
                </Text>
                <Text variant="heading2xl" as="p" fontWeight="bold">
                  {mediumCount}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Moderate sales velocity items
                </Text>
              </BlockStack>
            </Card>

            {/* CARD 4: STOCK STABLE */}
            <Card padding="400">
              <BlockStack gap="100">
                <Text variant="headingXs" tone="subdued" as="h3">
                  STOCK STABLE
                </Text>
                <Text variant="heading2xl" as="p" fontWeight="bold">
                  {safeCount}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Sufficient inventory coverage
                </Text>
              </BlockStack>
            </Card>
          </div>
        )}

        {/* MAIN TABLE CONTAINER */}
        <Card padding="0">
          <Box padding="300" borderBlockEndWidth="025" borderColor="border">
            <div className="high-demand-filter-bar">
              <div className="high-demand-filter-select">
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
                Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(filteredProducts.length, currentPage * ITEMS_PER_PAGE)} of {filteredProducts.length} products
              </Text>
            </div>
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
            <>
              <div className="table-responsive-container">
                <IndexTable
                  resourceName={resourceName}
                  itemCount={paginatedProducts.length}
                  headings={[
                    { title: "Product / SKU" },
                    { title: "Stock Units" },
                    { title: "Sold (30D)" },
                    { title: "Sales Velocity" },
                    { title: "Days Left" },
                    { title: "Risk Level" },
                    { title: "Action" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              </div>

              {/* PAGINATION FOOTER */}
              {filteredProducts.length > 0 && (
                <Box padding="300" borderBlockStartWidth="025" borderColor="border">
                  <InlineStack align="space-between" blockAlign="center" wrap gap="200">
                    <Text variant="bodySm" tone="subdued" as="span">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                      {Math.min(filteredProducts.length, currentPage * ITEMS_PER_PAGE)} of {filteredProducts.length} products
                    </Text>
                    <Pagination
                      hasPrevious={currentPage > 1}
                      onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      hasNext={currentPage < totalPages}
                      onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      label={`Page ${currentPage} of ${totalPages}`}
                    />
                  </InlineStack>
                </Box>
              )}
            </>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}