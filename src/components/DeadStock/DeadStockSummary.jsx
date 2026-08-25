import React from "react";
import { Card, Text, BlockStack, InlineStack, Badge } from "@shopify/polaris";

export default function DeadStockSummary({ summary, products = [] }) {
  let cash = summary?.totalCashTiedUp || 0;
  let count = summary?.deadStockSkuCount || 0;

  // If backend summary was 0 or not yet aggregated, calculate from loaded store products
  if (cash === 0 && products && products.length > 0) {
    const deadItems = products.filter((p) => (p.daysUnsold || 0) >= 60 && (p.cashTiedUp || 0) > 0);
    if (deadItems.length > 0) {
      cash = deadItems.reduce((sum, p) => sum + (p.cashTiedUp || 0), 0);
      count = deadItems.length;
    } else {
      const positiveItems = products.filter((p) => (p.cashTiedUp || 0) > 0);
      if (positiveItems.length > 0) {
        cash = positiveItems.reduce((sum, p) => sum + (p.cashTiedUp || 0), 0);
        count = positiveItems.length;
      }
    }
  }

  const formattedCash = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cash);

  return (
    <Card padding="400">
      <BlockStack gap="150">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingSm" as="h3" fontWeight="semibold">
            Cash tied up in dead stock
          </Text>
          <Badge tone="critical">{count} {count === 1 ? "SKU" : "SKUs"}</Badge>
        </InlineStack>
        <Text variant="heading2xl" as="p" fontWeight="bold">
          {formattedCash}
        </Text>
        <Text variant="bodySm" tone="subdued">
          {count} {count === 1 ? "SKU" : "SKUs"} sitting idle for over 60 days
        </Text>
      </BlockStack>
    </Card>
  );
}
