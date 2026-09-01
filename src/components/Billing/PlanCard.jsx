import React from "react";
import {
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Divider,
  Box,
} from "@shopify/polaris";
import { getPlanPrice } from "../../config/billingPlans";

export default function PlanCard({
  plan,
  currentPlanId = "free",
  currentBillingCycle = "monthly",
  billingCycle = "monthly",
  onSelectUpgrade,
  onSelectSwitchFree,
}) {
  const isFreePlan = plan.id === "free";
  const isCurrentPlan =
    String(currentPlanId || "free").toLowerCase() ===
      String(plan.id || plan.key || "").toLowerCase() &&
    (isFreePlan ||
      String(currentBillingCycle || "monthly").toLowerCase() ===
        String(billingCycle || "monthly").toLowerCase());

  const priceInfo = getPlanPrice(plan, billingCycle);

  return (
    <div
      style={{
        border: isCurrentPlan
          ? "2px solid #008060"
          : "1px solid #e1e3e5",
        backgroundColor: isCurrentPlan ? "#f6fdfa" : "#ffffff",
        borderRadius: "12px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: isCurrentPlan
          ? "0 4px 14px rgba(0, 128, 96, 0.12)"
          : "0 1px 3px rgba(0, 0, 0, 0.05)",
        transition: "all 0.2s ease-in-out",
        overflow: "hidden",
      }}
    >
      <Box padding="500">
        <BlockStack gap="400">
          {/* 1. HEADER & BADGES */}
          <BlockStack gap="150">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingLg" as="h3" fontWeight="bold">
                {plan.name}
              </Text>
              {isCurrentPlan && (
                <Badge tone="success">✓ Current Plan</Badge>
              )}
            </InlineStack>

            <Box minHeight="42px">
              <Text variant="bodySm" tone="subdued" as="p">
                {plan.description}
              </Text>
            </Box>
          </BlockStack>

          {/* 2. PRICING & CATALOG LIMIT */}
          <div
            style={{
              padding: "16px",
              backgroundColor: isCurrentPlan ? "#eaf9f4" : "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <BlockStack gap="100">
              <InlineStack align="start" blockAlign="baseline" gap="100">
                <Text variant="heading2xl" as="span" fontWeight="bold">
                  {priceInfo.formattedPrice}
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  {priceInfo.periodLabel}
                </Text>
              </InlineStack>

              <Box paddingBlockStart="050">
                <span style={{ color: "#202223", fontSize: "13px", fontWeight: "600" }}>
                  📦 {plan.products}
                </span>
              </Box>
            </BlockStack>
          </div>

          {/* 3. UNIFORM ACTION BUTTON */}
          {isCurrentPlan ? (
            <Button fullWidth disabled>
              Current Plan
            </Button>
          ) : (
            <Button
              fullWidth
              onClick={() => {
                if (plan.id === "free") {
                  onSelectSwitchFree && onSelectSwitchFree();
                } else {
                  onSelectUpgrade && onSelectUpgrade(plan.id);
                }
              }}
            >
              Upgrade to {plan.name}
            </Button>
          )}

          <Divider />

          {/* 4. INCLUDED & LOCKED FEATURES LIST */}
          <BlockStack gap="150">
            <Text variant="headingXs" as="h4" tone="subdued" fontWeight="bold">
              WHAT'S INCLUDED
            </Text>

            <BlockStack gap="150">
              {plan.features.map((feature, idx) => (
                <InlineStack
                  key={idx}
                  gap="150"
                  blockAlign="center"
                  align="start"
                  wrap={false}
                >
                  <Text
                    variant="bodySm"
                    tone={feature.included ? "base" : "subdued"}
                    as="span"
                  >
                    {!feature.included && (
                      <span style={{ marginRight: "6px" }}>🔒</span>
                    )}
                    {feature.name}
                    {!feature.included && feature.lockedIn && (
                      <span style={{ color: "#94a3b8", fontSize: "11px", marginLeft: "4px" }}>
                        (Upgrade to {feature.lockedIn})
                      </span>
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
