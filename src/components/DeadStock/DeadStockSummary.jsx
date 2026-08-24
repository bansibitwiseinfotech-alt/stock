import React from "react";
import { Banner, Text, BlockStack } from "@shopify/polaris";

export default function DeadStockSummary({ summary }) {
  const cash = summary?.totalCashTiedUp || 0;
  const count = summary?.deadStockSkuCount || 0;
  const formattedCash = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cash);

  return (
    <Banner title="Cash Tied Up in Dead Stock" tone="critical">
      <BlockStack gap="100">
        <Text variant="heading2xl" as="p" tone="critical">
          {formattedCash}
        </Text>
        <Text variant="bodyMd" tone="subdued">
          {count} {count === 1 ? "SKU" : "SKUs"} sitting idle for over 60 days
        </Text>
      </BlockStack>
    </Banner>
  );
}
