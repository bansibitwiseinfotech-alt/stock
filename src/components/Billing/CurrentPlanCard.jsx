import React from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Divider,
  Box,
  Banner,
  Button,
  Grid,
  Icon,
} from "@shopify/polaris";
import {
  CheckIcon,
  LockIcon,
  MagicIcon,
  ProductIcon,
  AlertDiamondIcon,
} from "@shopify/polaris-icons";
import FeatureUsage from "./FeatureUsage";

export default function CurrentPlanCard({ subscription, onUpgradeClick }) {
  if (!subscription) return null;

  const {
    plan = "free",
    planName = "Free",
    status = "active",
    productLimit = 10,
    usage = {},
    features = {},
    customization = {},
    billingCycle = "monthly",
  } = subscription;

  const isFree = plan === "free";
  const isBasic = plan === "basic";
  const isPro = plan === "pro";
  const isPremium = plan === "premium";

  const formattedProductLimit =
    productLimit === Infinity || productLimit === "unlimited"
      ? "Unlimited Products"
      : `${productLimit} Products`;

  const clearanceUsage = usage.clearanceSale || { used: 0, limit: 3, remaining: 3 };
  const bundleUsage = usage.deadStockBundle || { used: 0, limit: 0, remaining: 0 };
  const badgeUsage = usage.lowStockBadge || { used: 0, limit: 0, remaining: 0 };

  return (
    <BlockStack gap="400">
      {/* ──────────────────────────────────────────────────────────
          1. TOP 3-CARD STATS OVERVIEW
      ────────────────────────────────────────────────────────── */}
      <Grid columns={{ xs: 1, sm: 3, md: 3, lg: 3, xl: 3 }}>
        {/* CARD 1: ACTIVE PLAN */}
        <Grid.Cell>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodySm" tone="subdued" fontWeight="medium" as="span">
                  ACTIVE TIER
                </Text>
                <InlineStack gap="100" blockAlign="center">
                  {!isFree && (
                    <Badge tone="info">
                      {billingCycle === "yearly" ? "Yearly" : "Monthly"}
                    </Badge>
                  )}
                  <Badge tone={status === "active" ? "success" : "critical"}>
                    {status.toUpperCase()}
                  </Badge>
                </InlineStack>
              </InlineStack>

              <BlockStack gap="050">
                <Text variant="headingXl" as="h3" fontWeight="bold">
                  {planName.toUpperCase()}
                </Text>
                <Text variant="bodyXs" tone="subdued" as="p">
                  {isFree
                    ? "Essential dead-stock discovery"
                    : isBasic
                    ? `Growth bundle & clearance (${billingCycle === "yearly" ? "$99/yr" : "$19/mo"})`
                    : isPro
                    ? `High-demand urgency plan (${billingCycle === "yearly" ? "$249/yr" : "$49/mo"})`
                    : `Unlimited automation suite (${billingCycle === "yearly" ? "$499/yr" : "$99/mo"})`}
                </Text>
              </BlockStack>

              {!isPremium && onUpgradeClick && (
                <Box paddingBlockStart="100">
                  <Button
                    size="slim"
                    variant="primary"
                    onClick={() => onUpgradeClick()}
                  >
                    Upgrade Plan
                  </Button>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Grid.Cell>

        {/* CARD 2: PRODUCT CAPACITY */}
        <Grid.Cell>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodySm" tone="subdued" fontWeight="medium" as="span">
                  CATALOG CAPACITY
                </Text>
                <Badge tone={isPremium ? "success" : "info"}>
                  {isPremium ? "Unrestricted" : "Gated"}
                </Badge>
              </InlineStack>

              <BlockStack gap="050">
                <Text variant="headingXl" as="h3" fontWeight="bold">
                  {formattedProductLimit}
                </Text>
                <Text variant="bodyXs" tone="subdued" as="p">
                  Maximum products analyzed simultaneously
                </Text>
              </BlockStack>

              <Text variant="bodyXs" tone="subdued" as="span">
                GraphQL query limit synced with your plan
              </Text>
            </BlockStack>
          </Card>
        </Grid.Cell>

        {/* CARD 3: PRIMARY USAGE COUNTER */}
        <Grid.Cell>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodySm" tone="subdued" fontWeight="medium" as="span">
                  CLEARANCE SALES QUOTA
                </Text>
                <Badge tone={clearanceUsage.remaining === 0 ? "critical" : "success"}>
                  {clearanceUsage.limit === "unlimited"
                    ? "Unlimited"
                    : `${clearanceUsage.remaining} Left`}
                </Badge>
              </InlineStack>

              <BlockStack gap="050">
                <Text variant="headingXl" as="h3" fontWeight="bold">
                  {clearanceUsage.used} / {clearanceUsage.limit === "unlimited" ? "∞" : clearanceUsage.limit}
                </Text>
                <Text variant="bodyXs" tone="subdued" as="p">
                  Clearance sales campaigns created
                </Text>
              </BlockStack>

              <Text variant="bodyXs" tone={customization.clearanceSale ? "success" : "subdued"} as="span">
                {customization.clearanceSale ? "✓ Customization Unlocked" : "Standard Styling"}
              </Text>
            </BlockStack>
          </Card>
        </Grid.Cell>
      </Grid>

      {/* ──────────────────────────────────────────────────────────
          2. TWO-COLUMN BREAKDOWN: ACTIVE VS LOCKED AUTOMATIONS
      ────────────────────────────────────────────────────────── */}
      <Grid columns={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}>
        {/* COLUMN A: ACTIVE FEATURE QUOTAS */}
        <Grid.Cell>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3" fontWeight="bold">
                  Active Automations & Quotas
                </Text>
                <Badge tone="success">
                  {isPremium ? "5 Active" : isPro ? "3 Active" : isBasic ? "2 Active" : "1 Active"}
                </Badge>
              </InlineStack>
              <Divider />

              <BlockStack gap="250">
                {/* Clearance Sale (Active on all) */}
                <FeatureUsage
                  label="Clearance Sale"
                  description="Automated discount & scheduled countdown sales"
                  used={clearanceUsage.used}
                  limit={clearanceUsage.limit}
                  remaining={clearanceUsage.remaining}
                  customizationAllowed={customization.clearanceSale}
                />

                {/* Dead Stock Bundle (Active on Basic, Pro, Premium) */}
                {!isFree && (
                  <FeatureUsage
                    label="Dead Stock Bundle (BOGO)"
                    description="Automatic Buy X Get Y cross-merchandising"
                    used={bundleUsage.used}
                    limit={bundleUsage.limit}
                    remaining={bundleUsage.remaining}
                    customizationAllowed={customization.deadStockBundle}
                  />
                )}

                {/* Low Stock Badge (Active on Pro, Premium) */}
                {(isPro || isPremium) && (
                  <FeatureUsage
                    label="Low Stock Urgency Badge"
                    description="Real-time storefront urgency badges & thresholds"
                    used={badgeUsage.used}
                    limit={badgeUsage.limit}
                    remaining={badgeUsage.remaining}
                    customizationAllowed={customization.lowStockBadge}
                  />
                )}

                {/* Premium Automations (Active on Premium) */}
                {isPremium && (
                  <>
                    <FeatureUsage
                      label="Progressive Markdown Rules"
                      description="Step-down multi-stage automated price decreases"
                      used={0}
                      limit="unlimited"
                      customizationAllowed={customization.progressiveMarkdown}
                    />
                    <FeatureUsage
                      label="Launch Pre-Order Campaigns"
                      description="Pre-launch orders & upfront deposit collection"
                      used={0}
                      limit="unlimited"
                      customizationAllowed={customization.launchPreOrder}
                    />
                  </>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Grid.Cell>

        {/* COLUMN B: LOCKED AUTOMATIONS & UPGRADE PREVIEW */}
        <Grid.Cell>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3" fontWeight="bold">
                  {isPremium ? "Unlocked Features" : "Available in Higher Plans"}
                </Text>
                <Badge tone={isPremium ? "success" : "attention"}>
                  {isPremium ? "All Unlocked" : "Locked"}
                </Badge>
              </InlineStack>
              <Divider />

              {isPremium ? (
                <Box
                  background="bg-surface-success"
                  padding="400"
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <InlineStack gap="150" blockAlign="center">
                      <Icon source={MagicIcon} tone="success" />
                      <Text variant="bodyMd" fontWeight="bold" as="span">
                        Full Inventory Automation Suite Active
                      </Text>
                    </InlineStack>
                    <Text variant="bodySm" as="p">
                      Your store has unrestricted access to Dead Stock Bundles, Low Stock Urgency Badges, Progressive Markdowns, Launch Pre-Orders, Collection Bulk Sales, Automated Smart Badges, and Weekly Email Digest Schedules.
                    </Text>
                  </BlockStack>
                </Box>
              ) : (
                <BlockStack gap="200">
                  {/* Show only features that are currently locked for this tier */}
                  {isFree && (
                    <FeatureUsage
                      label="Dead Stock Bundle (BOGO)"
                      description="Bundle unsold items with popular companion products"
                      locked={true}
                      lockedIn="Basic"
                    />
                  )}

                  {(isFree || isBasic) && (
                    <FeatureUsage
                      label="Low Stock Urgency Badge"
                      description="Show high-demand scarcity badges on product pages"
                      locked={true}
                      lockedIn="Pro"
                    />
                  )}

                  {!isPremium && (
                    <>
                      <FeatureUsage
                        label="Progressive Markdown"
                        description="Auto-decrease prices gradually until stock clears"
                        locked={true}
                        lockedIn="Premium"
                      />
                      <FeatureUsage
                        label="Launch Pre-Orders & Smart Badges"
                        description="Pre-orders, collection bulk sales & automated weekly digest"
                        locked={true}
                        lockedIn="Premium"
                      />
                    </>
                  )}

                  <Box paddingBlockStart="100">
                    <Banner tone="info">
                      <Text variant="bodySm" as="p">
                        Upgrading increases your <strong>product catalog limit</strong> and unlocks full design customization for all storefront widgets.
                      </Text>
                    </Banner>
                  </Box>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Grid.Cell>
      </Grid>
    </BlockStack>
  );
}
