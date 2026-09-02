import React from "react";
import { useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Card,
  Text,
  BlockStack,
  Divider,
  Box,
  Badge,
  InlineStack,
  List,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function PrivacyPolicy() {
  const { shop } = useLoaderData();
  const navigate = useNavigate();

  const handleBack = () => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    navigate(`/app/billing${search}`);
  };

  return (
    <Page
      fullWidth
      title="Privacy Policy"
      subtitle="How Smart Stock manages, processes, and protects your Shopify store data."
      backAction={{
        content: "Billing & Plans",
        onAction: handleBack,
      }}
      compactTitle
    >
      <BlockStack gap="400">
        <Text as="p">
          This Privacy Policy applies to the <strong>Smart Stock</strong> application installed on Shopify store:{" "}
          <strong>{shop || "your store"}</strong>.
        </Text>

        <Card padding="500">
          <BlockStack gap="500">
            {/* HEADER */}
            <BlockStack gap="100">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h1" variant="headingXl">
                  Smart Stock Privacy Policy
                </Text>
                <Badge tone="success">Active</Badge>
              </InlineStack>
              <Text as="p" tone="subdued" variant="bodySm">
                Effective Date: September 1, 2026 | Last Updated: September 1, 2026
              </Text>
            </BlockStack>

            <Divider />

            {/* 1. INTRODUCTION */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                1. Overview & Commitment
              </Text>
              <Text as="p">
                Smart Stock ("we", "us", or "our") is designed specifically for Shopify merchants to automate inventory intelligence, detect dead stock, launch clearance sales and pre-orders, and optimize store revenue. We respect your privacy and are committed to protecting all data accessed through your Shopify store.
              </Text>
            </BlockStack>

            <Divider />

            {/* 2. INFORMATION WE ACCESS & COLLECT */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                2. Information We Access & Collect
              </Text>
              <Text as="p">
                To provide inventory analytics, dead-stock monitoring, and automated storefront badges, Smart Stock accesses only the minimum necessary store data via authorized Shopify API scopes:
              </Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    <strong>Product & Inventory Data:</strong> Product IDs, titles, handles, variant IDs, SKUs, inventory quantities, price, cost per item, and inventory location levels.
                  </List.Item>
                  <List.Item>
                    <strong>Order & Sales History:</strong> Order line items, fulfillment status, and order timestamps (used strictly to compute inventory velocity and days without sales).
                  </List.Item>
                  <List.Item>
                    <strong>Shop Details:</strong> Store name, myshopify domain, primary currency, and store owner email address.
                  </List.Item>
                  <List.Item>
                    <strong>Merchant Configuration:</strong> Custom discount thresholds, badge text, styling preferences, email digest schedules, and selected subscription tier.
                  </List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 3. HOW WE USE STORE DATA */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                3. How We Use Store Information
              </Text>
              <Text as="p">
                Data collected is used exclusively to power Smart Stock features within your store:
              </Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    <strong>Dead Stock Detection:</strong> Identifying SKUs with 30+, 60+, or 90+ days without sales and calculating tied-up working capital.
                  </List.Item>
                  <List.Item>
                    <strong>High Demand & Stockout Alerts:</strong> Analyzing sales velocity to predict imminent stockouts and calculate revenue at risk.
                  </List.Item>
                  <List.Item>
                    <strong>Clearance & Pre-Order Automation:</strong> Generating automated clearance discounts, BOGO bundles, progressive markdowns, and storefront pre-order badges.
                  </List.Item>
                  <List.Item>
                    <strong>Weekly Inventory Digests:</strong> Delivering scheduled performance emails containing cash recovered, dead-stock counts, and stockout warnings to the email address you configure.
                  </List.Item>
                  <List.Item>
                    <strong>Subscription Management:</strong> Managing app plan quotas, billing cycles, and feature access via Shopify Billing API.
                  </List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 4. DATA STORAGE & SECURITY */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                4. Data Security & Storage
              </Text>
              <Text as="p">
                We implement industry-standard security safeguards to protect your store data:
              </Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                 {/* <List.Item>
                    All API communications between Shopify, our backend servers, and your browser are encrypted in transit via <strong>TLS 1.3 / HTTPS</strong>.
                  </List.Item>*/}
                  <List.Item>
                    Shopify session tokens and API keys are securely stored with restricted access and never logged or exposed.
                  </List.Item>
                  <List.Item>
                    <strong>We never sell, rent, or monetize your store data or customer information to third parties or advertising networks.</strong>
                  </List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 5. DATA RETENTION & DELETION */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                5. Data Retention & Shopify Mandatory Webhooks
              </Text>
              <Text as="p">
                Smart Stock fully complies with Shopify's data protection requirements and GDPR/CCPA mandatory webhooks:
              </Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    <strong>App Uninstallation:</strong> When you uninstall Smart Stock, an automated webhook (<code>app/uninstalled</code>) immediately deactivates your subscription and cleans up active sessions.
                  </List.Item>
                  <List.Item>
                    <strong>Shop Redact Webhooks:</strong> We automatically process <code>shop/redact</code> webhooks within 48 hours to erase stored store-specific configurations and analytics data from our databases.
                  </List.Item>
                  <List.Item>
                    <strong>Customer Data Privacy:</strong> Smart Stock does not store personal customer profiles or payment card numbers. Any customer data associated with orders is processed in compliance with <code>customers/data_request</code> and <code>customers/redact</code> webhooks.
                  </List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 6. THIRD-PARTY SERVICES */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                6. Third-Party Infrastructure
              </Text>
              <Text as="p">
                Smart Stock operates using trusted, enterprise-grade cloud providers for core functionality:
              </Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    <strong>Shopify API & App Bridge:</strong> To securely authenticate and integrate with your store admin.
                  </List.Item>
                  <List.Item>
                    <strong>Database & Hosting Providers:</strong> Secure database infrastructure for storing store analytics and app preferences.
                  </List.Item>
                  <List.Item>
                    <strong>Transactional Email Service:</strong> Delivering scheduled weekly inventory digest reports requested by the store merchant.
                  </List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 7. CONTACT US */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                7. Contact Us & Privacy Inquiries
              </Text>
              <Text as="p">
                If you have questions regarding this Privacy Policy, your store data, or would like to request explicit data deletion, please contact our support team:
              </Text>
              <Box
                padding="300"
                style={{
                  backgroundColor: "#F6F6F7",
                  borderRadius: "8px",
                  border: "1px solid #E1E3E5",
                }}
              >
                <BlockStack gap="100">
                  <Text as="p">
                    <strong>App:</strong> Smart Stock
                  </Text>
                  <Text as="p">
                    <strong>Support Email:</strong>{" "}
                    <a href="mailto:support@smartstock.app" style={{ color: "#008060", fontWeight: "600", textDecoration: "none" }}>
                      support@smartstock.app
                    </a>
                  </Text>
                  <Text as="p">
                    <strong>Website:</strong>{" "}
                    <a href="https://smartstock.app" target="_blank" rel="noopener noreferrer" style={{ color: "#008060", textDecoration: "none" }}>
                      https://smartstock.app
                    </a>
                  </Text>
                </BlockStack>
              </Box>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}