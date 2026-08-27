import React, { useEffect, useState } from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import { BILLING_PLANS, getPlanPrice } from "../../config/billingPlans";

export default function ChangePlanModal({
  open,
  onClose,
  initialPlan = "pro",
  billingCycle = "monthly",
  currentPlanId = "free",
  onConfirmUpgrade,
  loading = false,
  error = null,
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(
    initialPlan && initialPlan !== "free" ? initialPlan : "pro"
  );

  // Sync selected plan whenever modal opens with initialPlan
  useEffect(() => {
    if (open && initialPlan && initialPlan !== "free") {
      setSelectedPlanId(initialPlan);
    }
  }, [open, initialPlan]);

  const paidPlans = BILLING_PLANS.filter((p) => p.id !== "free");
  const selectedPlan =
    paidPlans.find((p) => p.id === selectedPlanId) || paidPlans[0];
  const priceInfo = getPlanPrice(selectedPlan, billingCycle);

  const handleSubscribe = () => {
    if (onConfirmUpgrade && !loading) {
      onConfirmUpgrade({
        plan: selectedPlan.id,
        billingCycle,
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title="Change Your Plan"
      primaryAction={{
        content: loading
          ? "Creating secure Shopify checkout..."
          : `Subscribe to ${selectedPlan.name} — ${priceInfo.formattedPrice}${priceInfo.periodLabel}`,
        onAction: handleSubscribe,
        loading: loading,
        disabled: loading,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
          disabled: loading,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Text variant="bodyMd" tone="subdued" as="p">
            Review your selected plan and confirm subscription.
          </Text>

          {error && (
            <Banner tone="critical" title="Upgrade Error">
              <p>{error}</p>
            </Banner>
          )}

          {/* ONLY DISPLAY THE SELECTED PLAN DETAILS */}
          <div
            style={{
              border: "2px solid #008060",
              backgroundColor: "#f6fdfa",
              borderRadius: "8px",
              padding: "16px",
              transition: "all 0.15s ease-in-out",
            }}
          >
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Text variant="headingMd" as="h4" fontWeight="bold">
                    {selectedPlan.name} Plan
                  </Text>
                  {selectedPlan.highlight && (
                    <Badge tone="attention">Popular</Badge>
                  )}
                  <Badge tone="success">✓ Selected</Badge>
                </InlineStack>

                <Text variant="bodySm" tone="subdued" as="p">
                  📦 {selectedPlan.products} • {selectedPlan.description}
                </Text>
              </BlockStack>

              <BlockStack gap="050" align="end">
                <InlineStack align="end" blockAlign="baseline" gap="050">
                  <Text variant="headingLg" as="span" fontWeight="bold">
                    {priceInfo.formattedPrice}
                  </Text>
                  <Text variant="bodyXs" tone="subdued" as="span">
                    {priceInfo.periodLabel}
                  </Text>
                </InlineStack>
                {priceInfo.discountNotice && (
                  <Text variant="bodyXs" tone="success" as="span">
                    {priceInfo.discountNotice}
                  </Text>
                )}
              </BlockStack>
            </InlineStack>
          </div>

          <Divider />

          {/* BILLING SUMMARY */}
          <Box
            background="bg-surface-secondary"
            padding="400"
            borderRadius="200"
          >
            <BlockStack gap="200">
              <Text variant="headingSm" as="h4" fontWeight="bold">
                Billing Summary
              </Text>

              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued" as="span">
                  Plan
                </Text>
                <Text variant="bodySm" fontWeight="semibold" as="span">
                  Smart Stock {selectedPlan.name}
                </Text>
              </InlineStack>

              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued" as="span">
                  Billing Cycle
                </Text>
                <Text variant="bodySm" fontWeight="semibold" as="span">
                  {billingCycle === "yearly" ? "Yearly (Annual)" : "Monthly"}
                </Text>
              </InlineStack>

              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued" as="span">
                  Amount
                </Text>
                <Text
                  variant="bodySm"
                  fontWeight="bold"
                  tone="success"
                  as="span"
                >
                  {priceInfo.formattedPrice} {priceInfo.periodLabel}
                </Text>
              </InlineStack>

              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued" as="span">
                  Trial Period
                </Text>
                <Text variant="bodySm" tone="subdued" as="span">
                  None
                </Text>
              </InlineStack>
            </BlockStack>
          </Box>

          <Text variant="bodyXs" tone="subdued" as="p">
            Clicking Subscribe will redirect you to Shopify's secure approval
            page to confirm your recurring subscription.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
