import React from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Divider,
  Box,
  Icon,
} from "@shopify/polaris";
import { CheckIcon, LockIcon } from "@shopify/polaris-icons";
import {
  getPlanTierIndex,
  getPlanPrice,
} from "../../config/billingPlans";

export default function PlanCard({
  plan,
  currentPlanId = "free",
  billingCycle = "monthly",
  onSelectUpgrade,
  onSelectSwitchFree,
}) {
  const currentTier = getPlanTierIndex(currentPlanId);
  const thisTier = getPlanTierIndex(plan.id);

  const isCurrentPlan = currentPlanId === plan.id;
  const isUpgrade = thisTier > currentTier;
  const isDowngrade = thisTier < currentTier;
  const isFreePlan = plan.id === "free";

  const priceInfo = getPlanPrice(plan, billingCycle);

  return (
    <div
      style={{
        border: isCurrentPlan
          ? "2px solid #008060"
          : plan.highlight
          ? "1.5px solid #babfc3"
          : "1px solid #e1e3e5",
        backgroundColor: isCurrentPlan ? "#f6fdfa" : "#ffffff",
        borderRadius: "12px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: isCurrentPlan
          ? "0 0 0 1px #008060, 0 4px 12px rgba(0, 128, 96, 0.08)"
          : plan.highlight
          ? "0 4px 16px rgba(0,0,0,0.06)"
          : "none",
        transition: "all 0.2s ease-in-out",
        overflow: "hidden",
      }}
    >
      <Box padding="400">
        <BlockStack gap="400">
          {/* 1. HEADER & BADGES */}
          <BlockStack gap="100">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingLg" as="h3" fontWeight="bold">
                {plan.name}
              </Text>
              {isCurrentPlan ? (
                <Badge tone="success">✓ Current Plan</Badge>
              ) : plan.highlight ? (
                <Badge tone="attention">⭐ Most Popular</Badge>
              ) : plan.tag ? (
                <Badge tone="info">{plan.tag}</Badge>
              ) : null}
            </InlineStack>

            <Box minHeight="36px">
              <Text variant="bodyXs" tone="subdued" as="p">
                {plan.description}
              </Text>
            </Box>
          </BlockStack>

          {/* 2. PRICING & PRODUCT CAPACITY */}
          <Box
            padding="300"
            background={isCurrentPlan ? "bg-surface" : "bg-surface-secondary"}
            borderRadius="200"
            borderWidth="0165"
            borderColor="border"
          >
            <BlockStack gap="050">
              <InlineStack align="start" blockAlign="baseline" gap="100">
                <Text variant="heading2xl" as="span" fontWeight="bold">
                  {priceInfo.formattedPrice}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {priceInfo.periodLabel}
                </Text>
              </InlineStack>

              {priceInfo.discountNotice && (
                <Text variant="bodyXs" tone="success" fontWeight="medium" as="p">
                  {priceInfo.discountNotice}
                </Text>
              )}

              <Box paddingTop="100">
                <Text variant="bodySm" fontWeight="bold" tone="magic" as="span">
                  📦 {plan.products}
                </Text>
              </Box>
            </BlockStack>
          </Box>

          {/* 3. DYNAMIC ACTION BUTTON */}
          {isCurrentPlan ? (
            <Button fullWidth disabled>
              Current Plan
            </Button>
          ) : isFreePlan && currentPlanId !== "free" ? (
            <Button
              fullWidth
              variant="secondary"
              tone="critical"
              onClick={() => onSelectSwitchFree && onSelectSwitchFree()}
            >
              Switch to Free Plan
            </Button>
          ) : isUpgrade ? (
            <Button
              fullWidth
              variant={plan.highlight ? "primary" : "secondary"}
              tone={plan.highlight ? undefined : "success"}
              onClick={() => onSelectUpgrade && onSelectUpgrade(plan.id)}
            >
              Upgrade to {plan.name}
            </Button>
          ) : (
            <Button fullWidth disabled variant="secondary">
              Included in Current Plan
            </Button>
          )}

          <Divider />

          {/* 4. FEATURES CHECKLIST */}
          <BlockStack gap="150">
            <Text variant="headingXs" as="h4" tone="subdued">
              WHAT'S INCLUDED
            </Text>

            <BlockStack gap="150">
              {plan.features.map((feature, idx) => (
                <InlineStack
                  key={idx}
                  gap="150"
                  blockAlign="start"
                  align="start"
                  wrap={false}
                >
                  <Box minWidth="18px" paddingTop="050">
                    <Icon
                      source={feature.included ? CheckIcon : LockIcon}
                      tone={feature.included ? "success" : "subdued"}
                    />
                  </Box>
                  <Text
                    variant="bodyXs"
                    tone={feature.included ? "base" : "subdued"}
                    as="span"
                  >
                    {feature.name}
                    {!feature.included && feature.lockedIn && (
                      <Text variant="bodyXs" tone="subdued" as="span">
                        {" "}(in {feature.lockedIn})
                      </Text>
                    )}
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        </BlockStack>
      </Box>
    </div>
  );
}
