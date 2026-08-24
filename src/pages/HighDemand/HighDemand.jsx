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
  // COUNTS
  // ==================================================

  const criticalCount = products.filter(
    (product) =>
      String(product.riskLevel).toUpperCase() ===
      "CRITICAL"
  ).length;

  const highCount = products.filter(
    (product) =>
      String(product.riskLevel).toUpperCase() ===
      "HIGH"
  ).length;

  const highRiskCount =
    criticalCount + highCount;

  // ==================================================
  // RISK HELPERS
  // ==================================================

  const getRiskTone = (risk) => {
    switch (
      String(risk || "SAFE").toUpperCase()
    ) {
      case "CRITICAL":
        return "critical";

      case "HIGH":
        return "warning";

      case "MEDIUM":
        return "attention";

      default:
        return "success";
    }
  };

  const getRiskLabel = (risk) => {
    const level = String(
      risk || "SAFE"
    ).toUpperCase();

    if (level === "CRITICAL") {
      return "🔴 CRITICAL";
    }

    if (level === "HIGH") {
      return "🟠 HIGH";
    }

    if (level === "MEDIUM") {
      return "🟡 MEDIUM";
    }

    return "🟢 SAFE";
  };

  const getStatusDisplayLabel = (risk) => {
    const level = String(
      risk || "SAFE"
    ).toUpperCase();

    if (level === "CRITICAL") {
      return "🚨 Stockout Risk";
    }

    if (level === "HIGH") {
      return "📦 Restock Needed";
    }

    if (level === "MEDIUM") {
      return "👀 Demand Watch";
    }

    return "✅ Stock Stable";
  };

  const getDaysTone = (risk) => {
    const level = String(
      risk || "SAFE"
    ).toUpperCase();

    if (level === "CRITICAL") {
      return "critical";
    }

    if (level === "HIGH") {
      return "warning";
    }

    if (level === "MEDIUM") {
      return "warning";
    }

    return "subdued";
  };

  // ==================================================
  // TABLE ROWS
  // ==================================================

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const rowMarkup = filteredProducts.map(
    (item, index) => {
      const title =
        item.productName ||
        item.title ||
        "Product";

      const variantTitle =
        item.variantTitle &&
        item.variantTitle !==
          "Default Title"
          ? ` (${item.variantTitle})`
          : "";

      const stock =
        Number(item.currentStock) || 0;

      const sold30Days =
        Number(item.last30DaysSales) || 0;

      const velocity =
        Number(item.salesVelocity || 0).toFixed(
          2
        );

      const daysLeft =
        item.daysUntilStockout !== null &&
        item.daysUntilStockout !== undefined
          ? Number(
              item.daysUntilStockout
            )
          : null;

      const risk = String(
        item.riskLevel || "SAFE"
      ).toUpperCase();

      const isHighRisk =
        risk === "HIGH" ||
        risk === "CRITICAL";

      const reorderQuantity =
        Number(
          item.reorderQuantity
        ) || 0;

      const reorderStatus =
        item.reorderStatus ||
        "INSUFFICIENT_DATA";

      const statusLabel =
        getStatusDisplayLabel(risk);

      return (
        <IndexTable.Row
          id={
            item.variantId ||
            String(index)
          }
          key={
            item.variantId ||
            index
          }
          position={index}
        >
          {/* PRODUCT */}
          <IndexTable.Cell>
            <InlineStack
              gap="300"
              blockAlign="center"
            >
              {item.image ? (
                <Thumbnail
                  source={item.image}
                  alt={title}
                  size="small"
                />
              ) : null}

              <BlockStack gap="100">
                <Text
                  variant="bodyMd"
                  fontWeight="bold"
                  as="span"
                >
                  {title}
                  {variantTitle}
                </Text>

                {item.sku ? (
                  <Text
                    variant="bodySm"
                    tone="subdued"
                    as="span"
                  >
                    SKU: {item.sku}
                  </Text>
                ) : null}
              </BlockStack>
            </InlineStack>
          </IndexTable.Cell>

          {/* CURRENT STOCK */}
          <IndexTable.Cell>
            <Text
              variant="bodyMd"
              fontWeight="bold"
              as="span"
            >
              {stock}
            </Text>
          </IndexTable.Cell>

          {/* SOLD 30 DAYS */}
          <IndexTable.Cell>
            <Text
              variant="bodyMd"
              as="span"
            >
              {sold30Days}
            </Text>
          </IndexTable.Cell>

          {/* SALES VELOCITY */}
          <IndexTable.Cell>
            <Text
              variant="bodyMd"
              as="span"
            >
              {velocity} / day
            </Text>
          </IndexTable.Cell>

          {/* DAYS LEFT */}
          <IndexTable.Cell>
            <Text
              variant="bodyMd"
              fontWeight="bold"
              tone={getDaysTone(risk)}
              as="span"
            >
              {typeof daysLeft ===
              "number"
                ? `${daysLeft} days`
                : "N/A"}
            </Text>
          </IndexTable.Cell>

          {/* RISK */}
          <IndexTable.Cell>
            <Badge
              tone={getRiskTone(risk)}
            >
              {getRiskLabel(risk)}
            </Badge>
          </IndexTable.Cell>

          {/* REORDER */}
          <IndexTable.Cell>
            {reorderStatus ===
            "REORDER_REQUIRED" ? (
              <BlockStack gap="100">
                <Text
                  variant="bodyMd"
                  fontWeight="bold"
                  as="span"
                >
                  📦{" "}
                  {reorderQuantity} units
                </Text>

                <Text
                  variant="bodySm"
                  tone="subdued"
                  as="span"
                >
                  30-day coverage
                </Text>
              </BlockStack>
            ) : reorderStatus ===
              "INSUFFICIENT_DATA" ? (
              <Badge tone="attention">
                Insufficient Data
              </Badge>
            ) : (
              <Badge tone="success">
                Stock Sufficient
              </Badge>
            )}
          </IndexTable.Cell>

          {/* ACTION / STATUS */}
          <IndexTable.Cell>
            <Button
              variant={
                risk === "CRITICAL" ||
                risk === "HIGH"
                  ? "primary"
                  : "secondary"
              }
              tone={
                risk === "CRITICAL"
                  ? "critical"
                  : undefined
              }
              onClick={() => {
                setSelectedProduct(item);
                setSelectedVariantId(
                  item.variantId
                );
              }}
            >
              {statusLabel}
            </Button>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  // ==================================================
  // UI
  // ==================================================

  return (
    <Page
      fullWidth
      title="High-Demand Stockout Shield"
      subtitle="Protect high-demand products from running out of stock."
      primaryAction={{
        content: loading
          ? "Refreshing..."
          : "Refresh",
        onAction: loadData,
        loading,
      }}
    >
      <Layout>
        {/* ERROR */}
        {error ? (
          <Layout.Section>
            <Banner
              title="Unable to load High-Demand data"
              tone="critical"
              onDismiss={() =>
                setError("")
              }
            >
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        ) : null}

        {/* SUMMARY */}
        <Layout.Section>
          <Banner
            title={`${highRiskCount} SKUs at Stockout Risk`}
            tone={
              highRiskCount > 0
                ? "critical"
                : "success"
            }
          >
            <p>
              {highRiskCount > 0
                ? `${criticalCount} critical and ${highCount} high-risk products detected from real 30-day sales velocity.`
                : "No high-demand stockout risk detected."}
            </p>
          </Banner>
        </Layout.Section>

        {/* FILTER + TABLE */}
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <InlineStack
                gap="300"
                align="space-between"
                blockAlign="end"
              >
                <Select
                  label="Risk Level"
                  options={[
                    {
                      label:
                        "All Risk Levels",
                      value: "all",
                    },
                    {
                      label:
                        "High Risk",
                      value: "High",
                    },
                    {
                      label:
                        "Medium Risk",
                      value: "Medium",
                    },
                    {
                      label:
                        "Low Risk",
                      value: "Low",
                    },
                  ]}
                  value={
                    riskLevelFilter
                  }
                  onChange={
                    setRiskLevelFilter
                  }
                />

                <Text
                  variant="bodySm"
                  tone="subdued"
                  as="span"
                >
                  Showing{" "}
                  {
                    filteredProducts.length
                  }{" "}
                  of{" "}
                  {products.length}{" "}
                  products
                </Text>
              </InlineStack>
            </Box>

            {/* LOADING */}
            {loading ? (
              <Box
                padding="800"
              >
                <InlineStack
                  align="center"
                  blockAlign="center"
                >
                  <Spinner
                    size="small"
                    accessibilityLabel="Loading high-demand products"
                  />
                </InlineStack>
              </Box>
            ) : filteredProducts.length ===
              0 ? (
              /* EMPTY STATE */
              <Box padding="800">
                <BlockStack
                  gap="200"
                  align="center"
                >
                  <Text
                    variant="headingMd"
                    as="h3"
                    alignment="center"
                  >
                    {products.length ===
                    0
                      ? "✅ No High-Demand Products"
                      : "No Products Match This Filter"}
                  </Text>

                  <Text
                    variant="bodyMd"
                    tone="subdued"
                    alignment="center"
                    as="p"
                  >
                    {products.length ===
                    0
                      ? "Your inventory currently has no products with high-demand stockout risk."
                      : "Try selecting a different risk level."}
                  </Text>
                </BlockStack>
              </Box>
            ) : (
              <IndexTable
                resourceName={
                  resourceName
                }
                itemCount={
                  filteredProducts.length
                }
                headings={[
                  {
                    title: "PRODUCT",
                  },
                  {
                    title: "STOCK",
                  },
                  {
                    title: "SOLD (30D)",
                  },
                  {
                    title: "VELOCITY",
                  },
                  {
                    title: "DAYS LEFT",
                  },
                  {
                    title: "RISK LEVEL",
                  },
                  {
                    title: "REORDER",
                  },
                  {
                    title: "ACTION",
                  },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}