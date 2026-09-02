import React from "react";
import { useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Card,
  Text,
  BlockStack,
  Divider,
  Box,
  InlineStack,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function TermsAndConditions() {
  const { shop } = useLoaderData();
  const navigate = useNavigate();

  const handleBack = () => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    navigate(`/app/billing${search}`);
  };

  return (
    <Page
      fullWidth
      title="Terms & Conditions"
      subtitle="Terms of service and usage guidelines for the Smart Stock Shopify application."
      backAction={{
        content: "Billing & Plans",
        onAction: handleBack,
      }}
      compactTitle
    >
      <BlockStack gap="400">
        <Text as="p">
          These Terms &amp; Conditions govern the use of the <strong>Smart Stock</strong> application installed on Shopify store:{" "}
          <strong>{shop || "your store"}</strong>.
        </Text>

        <Card padding="500">
          <BlockStack gap="500">
            {/* HEADER */}
            <BlockStack gap="100">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h1" variant="headingXl">
                  Smart Stock Terms &amp; Conditions
                </Text>
              </InlineStack>
              <Text as="p" tone="subdued" variant="bodySm">
                Last Updated: September 1, 2026
              </Text>
            </BlockStack>

            <Text as="p">
              Please read these Terms of Service ("Terms") carefully before installing or using the <strong>Smart Stock</strong> Shopify App ("App" or "Service"). By installing, accessing, or using the App, you ("Merchant", "you", or "your") agree to be bound by these Terms. The Service is provided by <strong>Bitwise Infotech</strong>, located in Rajkot, Gujarat, India.
            </Text>

            <Divider />

            {/* 1. ACCEPTANCE OF TERMS */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                1. Acceptance of Terms
              </Text>
              <Text as="p">
                By installing Smart Stock through the Shopify App Store, you acknowledge that you have read, understood, and agreed to these Terms and our Privacy Policy.
              </Text>
            </BlockStack>

            <Divider />

            {/* 2. DESCRIPTION OF SERVICE */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                2. Description of Service
              </Text>
              <Text as="p">
                Smart Stock is a Shopify application designed to help merchants optimize inventory, eliminate dead stock, prevent stockouts, and maximize store profits through:
              </Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>Dead Stock Detection &amp; Tied-Up Capital Analysis</List.Item>
                  <List.Item>High Demand &amp; Stockout Alerts</List.Item>
                  <List.Item>Automated Clearance Sales &amp; Progressive Markdowns</List.Item>
                  <List.Item>Smart Badges (Clearance, Low Stock, Pre-Order)</List.Item>
                  <List.Item>Clearance Bundles (BOGO) &amp; Bulk Collection Sales</List.Item>
                  <List.Item>Weekly Inventory Digest Reports</List.Item>
                </List>
              </Box>
              <Text as="p" tone="subdued" variant="bodySm">
                We reserve the right to modify, improve, suspend, or discontinue any feature of the Service at any time.
              </Text>
            </BlockStack>

            <Divider />

            {/* 3. MERCHANT RESPONSIBILITIES */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                3. Merchant Responsibilities
              </Text>
              <Text as="p">As a merchant using Smart Stock, you agree to:</Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>Comply with all applicable laws, regulations, and industry standards.</List.Item>
                  <List.Item>Comply with Shopify's Terms of Service and all applicable Shopify policies.</List.Item>
                  <List.Item>Ensure all products, pricing, discounts, and inventory information configured in the App are accurate and lawful.</List.Item>
                  <List.Item>Not reverse engineer, copy, decompile, modify, or attempt to extract source code from the App.</List.Item>
                  <List.Item>Not use the Service to upload malicious software, interfere with operation, or abuse functionality.</List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 4. SUBSCRIPTION, BILLING & PLANS */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                4. Subscription, Billing &amp; Plans
              </Text>
              <Text as="p">Smart Stock may offer free and paid subscription plans.</Text>
              <Text as="p">By subscribing to a paid plan:</Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>You authorize Shopify to charge applicable fees through Shopify's Billing API.</List.Item>
                  <List.Item>Billing is processed exclusively through Shopify. We do not collect or store your payment card information.</List.Item>
                  <List.Item>Subscription charges are billed through Shopify and refunds are handled according to Shopify billing policies and applicable law.</List.Item>
                  <List.Item>We may modify pricing or features upon reasonable notice.</List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 5. INTELLECTUAL PROPERTY */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                5. Intellectual Property
              </Text>
              <Text as="p">
                Smart Stock, including all software, source code, content, algorithms, designs, and functionality, is owned exclusively by Bitwise Infotech and its licensors. Merchants receive only a limited, non-exclusive, non-transferable, revocable license to use the App during an active subscription.
              </Text>
            </BlockStack>

            <Divider />

            {/* 6. DATA USAGE & PRIVACY */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                6. Data Usage &amp; Privacy
              </Text>
              <Text as="p">
                Your use of the Service is governed by our Privacy Policy. By using the App, you authorize us to access, process, store, and use Shopify store data (including catalog data, inventory levels, order velocity, and analytics) necessary to provide the Service.
              </Text>
            </BlockStack>

            <Divider />

            {/* 7. DATA STORAGE & SECURITY */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                7. Data Storage &amp; Security
              </Text>
              <Text as="p">
                To provide the Service, data may be stored using secure cloud infrastructure providers, including MongoDB. We implement commercially reasonable security measures, but we cannot guarantee absolute protection against all threats. Data is transmitted using encrypted HTTPS connections and access is restricted to authorized personnel.
              </Text>
            </BlockStack>

            <Divider />

            {/* 8. THIRD-PARTY SERVICES */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                8. Third-Party Services
              </Text>
              <Text as="p">
                The Service relies on third-party providers including Shopify, MongoDB, cloud hosting providers, and transactional email providers. We are not responsible for outages or service failures caused by third-party providers beyond our reasonable control.
              </Text>
            </BlockStack>

            <Divider />

            {/* 9. DISCLAIMER OF WARRANTIES */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                9. Disclaimer of Warranties
              </Text>
              <Text as="p">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. We do not guarantee that the Service will be uninterrupted, error-free, or that inventory recovery results will meet specific revenue targets. Maintenance, upgrades, Shopify platform changes, or third-party provider outages may temporarily affect functionality.
              </Text>
            </BlockStack>

            <Divider />

            {/* 10. LIMITATION OF LIABILITY */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                10. Limitation of Liability
              </Text>
              <Text as="p">
                TO THE FULLEST EXTENT PERMITTED BY LAW, BITWISE INFOTECH SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE TOTAL SUBSCRIPTION FEES PAID BY YOU DURING THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
              </Text>
            </BlockStack>

            <Divider />

            {/* 11. TERMINATION */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                11. Termination
              </Text>
              <Text as="p">
                We may suspend or terminate access to the Service immediately if you violate these Terms, if Shopify requires suspension, or if we detect abuse or security risks. You may terminate your use of the Service at any time by uninstalling the App.
              </Text>
            </BlockStack>

            <Divider />

            {/* 12. DATA RETENTION AFTER UNINSTALLATION */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                12. Data Retention After Uninstallation
              </Text>
              <Text as="p">
                Certain data may be retained for up to 45 days after app uninstallation for backup recovery, fraud prevention, dispute resolution, and legal compliance purposes.
              </Text>
            </BlockStack>

            <Divider />

            {/* 13. CHANGES TO TERMS */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                13. Changes to Terms
              </Text>
              <Text as="p">
                We may update these Terms from time to time. Continued use of the Service after changes become effective constitutes acceptance of the revised Terms.
              </Text>
            </BlockStack>

            <Divider />

            {/* 14. GOVERNING LAW */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                14. Governing Law
              </Text>
              <Text as="p">
                These Terms shall be governed by the laws of India and courts located in Gujarat shall have exclusive jurisdiction.
              </Text>
            </BlockStack>

            <Divider />

            {/* 15. CONTACT US */}
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                15. Contact Us
              </Text>
              <Text as="p">
                If you have questions regarding these Terms or the Service, please contact:
              </Text>
              <Box
                padding="300"
                borderWidth="025"
                borderRadius="200"
                borderColor="border"
                background="bg-surface-secondary"
              >
                <BlockStack gap="100">
                  <Text as="p">
                    <strong>App:</strong> Smart Stock
                  </Text>
                  <Text as="p">
                    <strong>Developer:</strong> Bitwise Infotech, Rajkot, Gujarat, India
                  </Text>
                  <Text as="p">
                    <strong>Support Email:</strong>{" "}
                    <a href="mailto:support@bitwiseinfotech.com" style={{ color: "#008060", fontWeight: "600", textDecoration: "none" }}>
                      support@bitwiseinfotech.com
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
