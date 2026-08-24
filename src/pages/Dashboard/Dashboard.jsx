import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Divider,
  Spinner,
  Box,
} from "@shopify/polaris";
import { useNavigate } from "react-router";
import { fetchDashboardData } from "../../services/appApi";

export default function Dashboard({ shopDomain = "" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalCashRecovered: 0,
    growthPercentage: 14.8,
    badgeBreakdown: [
      {
        key: "clearance",
        icon: "🏷️",
        title: "Clearance Sale",
        badgesUsed: 0,
        cashRecovered: 0,
        link: "/app/dead-stock",
      },
      {
        key: "bundle",
        icon: "📦",
        title: "Bundle Offer",
        badgesUsed: 0,
        cashRecovered: 0,
        link: "/app/bundles",
      },
      {
        key: "markdown",
        icon: "📉",
        title: "Progressive Markdown",
        badgesUsed: 0,
        cashRecovered: 0,
        link: "/app/dead-stock",
      },
      {
        key: "urgency",
        icon: "🛡️",
        title: "Urgency Badge",
        badgesUsed: 0,
        cashRecovered: 0,
        link: "/app/high-demand",
      },
    ],
    smartRecipes: [
      {
        id: "recipe-clear-summer",
        title: "Clear Summer Inventory",
        description: "Identify slow-moving summer products and recommend the best recovery strategy.",
        productsDetected: 0,
        potentialRecovery: 0,
        recommendedAction: "Clearance Sale",
        recommendedBadge: "🏷️",
        link: "/app/dead-stock",
      },
      {
        id: "recipe-bfcm-urgency",
        title: "BFCM Low-Stock Urgency Badges",
        description: "Identify high-demand products that may run out of stock during BFCM and recommend urgency badges.",
        productsAtRisk: 0,
        potentialRevenueProtected: 0,
        recommendedAction: "Low-Stock Urgency Badge",
        recommendedBadge: "🛡️",
        link: "/app/high-demand",
      },
    ],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchDashboardData(shopDomain);
      if (res && res.totalCashRecovered !== undefined) {
        setData(res);
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopDomain]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const totalFormatted = formatCurrency(data.totalCashRecovered);

  return (
    <Page
      fullWidth
      title="Dashboard"
      subtitle="Overview of your inventory recovery, sales performance, and active automations."
      primaryAction={{
        content: "Refresh Data",
        loading: loading,
        onAction: loadData,
      }}
    >
      <Layout>
        {/* ==================================================
            1. CASH UNLOCKED ROI SCOREBOARD
            ================================================== */}
        <Layout.Section>
          <Card padding="500">
            <BlockStack gap="400">
              {/* Header Hero Area */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                  paddingBottom: "4px",
                }}
              >
                <BlockStack gap="100">
                  <Text
                    variant="bodySm"
                    fontWeight="semibold"
                    tone="subdued"
                    style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
                  >
                    💰 Total Cash Recovered by this App
                  </Text>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                    <span
                      style={{
                        fontSize: "36px",
                        fontWeight: "800",
                        color: "#1A1A1A",
                        lineHeight: 1.15,
                        letterSpacing: "-0.5px",
                      }}
                    >
                      {totalFormatted}
                    </span>
                    {loading && <Spinner size="small" />}
                  </div>
                  <Text variant="bodySm" tone="subdued">
                    Recovered through Smart Stock
                  </Text>
                </BlockStack>

                <div
                  style={{
                    backgroundColor: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>📈</span>
                  <Text variant="bodySm" fontWeight="semibold" tone="success">
                    +{data.growthPercentage || 14.8}% vs last 30 days
                  </Text>
                </div>
              </div>

              <Divider />

              {/* Badge-Wise Recovery Breakdown Section */}
              <BlockStack gap="300">
                <Text variant="headingSm" as="h4" fontWeight="semibold">
                  Badge-Wise Recovery Breakdown
                </Text>

                {/* 4-Card Equal Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "14px",
                  }}
                >
                  {(data.badgeBreakdown || []).map((badge) => (
                    <div
                      key={badge.key || badge.title}
                      style={{
                        backgroundColor: "#FAFAFA",
                        border: "1px solid #E5E7EB",
                        borderRadius: "10px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "14px",
                        minHeight: "120px",
                      }}
                    >
                      {/* Badge Top Header */}
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="150" blockAlign="center">
                          <span style={{ fontSize: "18px" }}>{badge.icon}</span>
                          <Text variant="bodySm" fontWeight="semibold">
                            {badge.title}
                          </Text>
                        </InlineStack>
                        <Badge tone="info">{`Badges Used: ${badge.badgesUsed || 0}`}</Badge>
                      </InlineStack>

                      {/* Cash Recovered & Action */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-end",
                        }}
                      >
                        <BlockStack gap="050">
                          <Text variant="bodyXs" tone="subdued">
                            Cash Recovered
                          </Text>
                          <span
                            style={{
                              fontSize: "20px",
                              fontWeight: "700",
                              color: "#111827",
                            }}
                          >
                            {formatCurrency(badge.cashRecovered)}
                          </span>
                        </BlockStack>

                        <Button
                          size="slim"
                          variant="plain"
                          onClick={() => badge.link && navigate(badge.link)}
                        >
                          Manage →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Total Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#F9FAFB",
                    padding: "14px 20px",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    marginTop: "6px",
                  }}
                >
                  <Text variant="bodyMd" fontWeight="semibold" tone="subdued">
                    Total Cash Recovered:
                  </Text>
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: "800",
                      color: "#111827",
                    }}
                  >
                    {totalFormatted}
                  </span>
                </div>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ==================================================
            2. SMART RECIPES
            ================================================== */}
        <Layout.Section>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="050">
                <Text variant="headingMd" as="h2">
                  ⚡ Smart Recipes
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Automated recovery recommendations based on your store's live inventory analytics.
                </Text>
              </BlockStack>
            </InlineStack>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              {(data.smartRecipes || []).map((recipe, index) => {
                const isSummer = index === 0;
                return (
                  <Card key={recipe.id || recipe.title} padding="400">
                    <BlockStack gap="300">
                      {/* Recipe Header */}
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingSm" as="h3" fontWeight="semibold">
                          {recipe.title}
                        </Text>
                        <Badge tone={isSummer ? "attention" : "warning"}>
                          {isSummer ? "Slow Moving" : "High Risk"}
                        </Badge>
                      </InlineStack>

                      <Text variant="bodySm" tone="subdued">
                        {recipe.description}
                      </Text>

                      {/* Stat Metrics Box */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "14px",
                          backgroundColor: "#F9FAFB",
                          padding: "14px 16px",
                          borderRadius: "8px",
                          border: "1px solid #E5E7EB",
                        }}
                      >
                        <BlockStack gap="050">
                          <Text variant="bodyXs" tone="subdued">
                            {isSummer ? "Products Detected" : "Products at Risk"}
                          </Text>
                          <span style={{ fontSize: "16px", fontWeight: "700", color: "#1F2937" }}>
                            {isSummer
                              ? `${recipe.productsDetected || 0} products`
                              : `${recipe.productsAtRisk || 0} products`}
                          </span>
                        </BlockStack>

                        <BlockStack gap="050">
                          <Text variant="bodyXs" tone="subdued">
                            {isSummer ? "Potential Recovery" : "Potential Revenue Protected"}
                          </Text>
                          <span style={{ fontSize: "16px", fontWeight: "700", color: "#15803D" }}>
                            {formatCurrency(
                              isSummer
                                ? recipe.potentialRecovery
                                : recipe.potentialRevenueProtected
                            )}
                          </span>
                        </BlockStack>
                      </div>

                      {/* Footer Actions */}
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="100" blockAlign="center">
                          <Text variant="bodyXs" tone="subdued">
                            Recommended:
                          </Text>
                          <Badge tone="info">
                            {`${recipe.recommendedBadge || ""} ${recipe.recommendedAction || "Clearance Sale"}`}
                          </Badge>
                        </InlineStack>

                        <Button
                          variant="primary"
                          onClick={() => {
                            if (recipe.link) {
                              navigate(recipe.link);
                            }
                          }}
                        >
                          Run Recipe
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                );
              })}
            </div>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
