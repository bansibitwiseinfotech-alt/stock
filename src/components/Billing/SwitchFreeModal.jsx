import React from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Box,
  Icon,
} from "@shopify/polaris";
import { AlertCircleIcon } from "@shopify/polaris-icons";

export default function SwitchFreeModal({
  open,
  onClose,
  currentPlanId = "basic",
  onConfirmSwitch,
  loading = false,
  error = null,
}) {
  const getLostFeatures = () => {
    switch (currentPlanId) {
      case "premium":
        return [
          "Unlimited Products Catalog (downgrades to 10 products)",
          "Unlimited Clearance Sales (downgrades to 3 lifetime uses)",
          "Dead Stock Bundles (BOGO)",
          "Low Stock Urgency Badges",
          "Progressive Markdown automation rules",
          "Launch Pre-Order campaigns",
          "Collection Bulk Sales",
          "Weekly Merchant Email Digest schedules",
          "Smart Badges automated assignments",
          "Custom widget styling & layout controls",
        ];
      case "pro":
        return [
          "50 Products Catalog Capacity (downgrades to 10 products)",
          "15 Clearance Sales (downgrades to 3 lifetime uses)",
          "15 Dead Stock Bundles (BOGO)",
          "15 Low Stock Urgency Badges",
          "Bundle and badge customization styling",
        ];
      case "basic":
      default:
        return [
          "25 Products Catalog Capacity (downgrades to 10 products)",
          "10 Clearance Sales (downgrades to 3 lifetime uses)",
          "10 Dead Stock Bundles (BOGO)",
          "Bundle customization styling",
        ];
    }
  };

  const lostFeatures = getLostFeatures();

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title="Switch to Free Plan?"
      primaryAction={{
        content: loading ? "Switching to Free..." : "Confirm Switch",
        onAction: onConfirmSwitch,
        destructive: true,
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
          {error && (
            <Banner tone="critical" title="Cancellation Error">
              <p>{error}</p>
            </Banner>
          )}

          <Banner tone="warning" title="You will lose access to premium features">
            <p>
              Switching to the Free plan will cancel your active Shopify
              subscription and immediately lock advanced inventory features.
            </p>
          </Banner>

          <Box
            background="bg-surface-secondary"
            padding="400"
            borderRadius="200"
          >
            <BlockStack gap="200">
              <Text variant="headingSm" as="h4" fontWeight="bold">
                Features that will be deactivated:
              </Text>

              <BlockStack gap="150">
                {lostFeatures.map((item, idx) => (
                  <InlineStack key={idx} gap="150" blockAlign="start">
                    <Text variant="bodySm" tone="critical" as="span">
                      ✕
                    </Text>
                    <Text variant="bodySm" as="span">
                      {item}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Box>

          <Text variant="bodySm" tone="subdued" as="p">
            Your store's current configuration will be preserved, but automated
            gated executions will stop until you upgrade again.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
