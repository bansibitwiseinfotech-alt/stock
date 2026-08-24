import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  ProgressBar,
  Box,
  Banner,
} from "@shopify/polaris";
import { fetchDashboardData } from "../../services/appApi";

export default function Dashboard({ shopDomain = "" }) {
  const [data, setData] = useState({
    totalCashRecovered: 14250,
    growthPercentage: 12.5,
    cashAtRisk: 4500,
    deadStockSkuCount: 3,
    stockoutRiskCount: 2,
    lowStockCount: 5,
    totalProducts: 320,
    inventoryOverview: {
      healthy: { count: 280, percentage: 81 },
      atRisk: { count: 25, percentage: 11 },
      deadStock: { count: 3, percentage: 5 },
      outOfStock: { count: 10, percentage: 3 },
    },
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchDashboardData(shopDomain);
        if (res) setData(res);
      } catch (err) {
        console.error("Dashboard Load Error:", err);
      }
    }
    load();
  }, [shopDomain]);

  const formattedRecovered = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(data.totalCashRecovered);
  const formattedAtRisk = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(data.cashAtRisk);

  return (
    <Page
      title="Dashboard"
      subtitle="Monday, 6 May 2026"
      primaryAction={{
        content: "Refresh Data",
        onAction: () => window.location.reload(),
      }}
    >
      <Layout>
        {/* 1. Cash Unlocked ROI Scoreboard Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Enable Smart Stock storefront intelligence</Text>
              <Text as="p" tone="subdued">
                Turn on the Smart Stock app embed in your Shopify theme to activate live dead-stock promotions, stock alerts, urgency badges, and conversion messaging.
              </Text>
              <InlineStack>
                <Button
                  url={`https://${shopDomain}/admin/themes/current/editor?context=apps`}
                  target="_top"
                  variant="primary"
                >
                  Enable Smart Stock
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3" tone="subdued">
                    Total Cash Recovered by this App
                  </Text>
                  <Text variant="heading2xl" as="h1">
                    {formattedRecovered}
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">+{data.growthPercentage}% vs last 30 days</Badge>
                  </InlineStack>
                </BlockStack>
                <Box
                  padding="400"
                  borderRadius="full"
                  background="bg-surface-success-subdued"
                >
                  <Text variant="headingXl" as="span">💲</Text>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* 2. Metric Cards Grid */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Box flex="1">
              <Card>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="critical" fontWeight="bold">Cash-At-Risk</Text>
                  <Text variant="headingLg" as="h2">{formattedAtRisk}</Text>
                  <Text variant="bodySm" tone="subdued">{data.deadStockSkuCount} SKUs</Text>
                </BlockStack>
              </Card>
            </Box>

            <Box flex="1">
              <Card>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="warning" fontWeight="bold">Stockout Risk</Text>
                  <Text variant="headingLg" as="h2">{data.stockoutRiskCount} SKUs</Text>
                  <Text variant="bodySm" tone="subdued">Will run out soon</Text>
                </BlockStack>
              </Card>
            </Box>

            <Box flex="1">
              <Card>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued" fontWeight="bold">Low Stock</Text>
                  <Text variant="headingLg" as="h2">{data.lowStockCount} SKUs</Text>
                  <Text variant="bodySm" tone="subdued">Below threshold</Text>
                </BlockStack>
              </Card>
            </Box>

            <Box flex="1">
              <Card>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued" fontWeight="bold">Total Products</Text>
                  <Text variant="headingLg" as="h2">{data.totalProducts}</Text>
                  <Text variant="bodySm" tone="subdued">All active products</Text>
                </BlockStack>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>

        {/* 3. Bottom Grid: Inventory Overview + This Week Action Plan */}
        <Layout.Section variant="oneHalf">
          <Card title="Inventory Overview">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">Inventory Breakdown</Text>
              
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd">🟢 Healthy</Text>
                  <Text variant="bodyMd" fontWeight="bold">280 (81%)</Text>
                </InlineStack>
                <ProgressBar progress={81} tone="success" size="small" />
              </BlockStack>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd">🟡 At Risk</Text>
                  <Text variant="bodyMd" fontWeight="bold">25 (11%)</Text>
                </InlineStack>
                <ProgressBar progress={11} tone="highlight" size="small" />
              </BlockStack>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd">🔴 Dead Stock</Text>
                  <Text variant="bodyMd" fontWeight="bold">{data.deadStockSkuCount} (5%)</Text>
                </InlineStack>
                <ProgressBar progress={5} tone="critical" size="small" />
              </BlockStack>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd">⚪ Out of Stock</Text>
                  <Text variant="bodyMd" fontWeight="bold">10 (3%)</Text>
                </InlineStack>
                <ProgressBar progress={3} tone="primary" size="small" />
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card title="This Week's Action Plan">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">Action Plan</Text>

              <Banner title="Dead Stock Alert" tone="critical">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm">{formattedAtRisk} at risk — {data.deadStockSkuCount} SKUs</Text>
                  <Button url="/app/dead-stock" variant="primary" tone="critical">Take Action</Button>
                </InlineStack>
              </Banner>

              <Banner title="Stockout Warning" tone="warning">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm">{data.stockoutRiskCount} SKUs will run out soon</Text>
                  <Button url="/app/high-demand">Take Action</Button>
                </InlineStack>
              </Banner>

              <Banner title="Low Stock Warning" tone="info">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm">{data.lowStockCount} SKUs below threshold</Text>
                  <Button url="/app/automations">View All</Button>
                </InlineStack>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
