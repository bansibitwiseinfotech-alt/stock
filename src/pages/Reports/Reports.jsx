import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Badge,
} from "@shopify/polaris";
import { fetchReportsData } from "../../services/appApi";

export default function Reports({ shopDomain = "" }) {
  const [data, setData] = useState({
    totalCashRecovered: 14250,
    growthPercentage: 12.5,
    salesGenerated: 32450,
    ordersCount: 450,
    productsSold: 1250,
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchReportsData(shopDomain);
        if (res) setData(res);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [shopDomain]);

  return (
    <Page
      fullWidth
      title="Reports"
      subtitle="Track performance and the financial impact of your inventory actions."
    >
      <Layout>
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" fontWeight="bold">CASH RECOVERED</Text>
                <Text variant="headingLg" as="h2">${data.totalCashRecovered.toLocaleString()}</Text>
                <Badge tone="success">+{data.growthPercentage}% vs last 30d</Badge>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" fontWeight="bold">SALES GENERATED</Text>
                <Text variant="headingLg" as="h2">${data.salesGenerated.toLocaleString()}</Text>
                <Badge tone="success">+15.2% vs last 30d</Badge>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" fontWeight="bold">ORDERS</Text>
                <Text variant="headingLg" as="h2">{data.ordersCount}</Text>
                <Badge tone="success">+10.3% vs last 30d</Badge>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" fontWeight="bold">PRODUCTS SOLD</Text>
                <Text variant="headingLg" as="h2">{data.productsSold}</Text>
                <Badge tone="success">+18.5% vs last 30d</Badge>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
