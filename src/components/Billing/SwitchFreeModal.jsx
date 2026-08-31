import React from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Box,
} from "@shopify/polaris";

export default function SwitchFreeModal({
  open,
  onClose,
  onConfirmSwitch,
  loading = false,
  error = null,
}) {
  const freeFeatures = [
    "10 Products Catalog Limit",
    "3 Clearance Sales",
    "Clearance Sale Customization",
  ];

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

          <Banner tone="warning" title="Switching to Free Plan">
            <p>
              Switching to the Free plan will cancel your active paid Shopify
              subscription.
            </p>
          </Banner>

          <Box
            background="bg-surface-secondary"
            padding="400"
            borderRadius="200"
          >
            <BlockStack gap="200">
              <Text variant="headingSm" as="h4" fontWeight="bold">
                WHAT'S INCLUDED IN FREE PLAN:
              </Text>

              <BlockStack gap="150">
                {freeFeatures.map((item, idx) => (
                  <InlineStack key={idx} gap="200" blockAlign="center">
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        backgroundColor: "#e6f4ea",
                        color: "#137333",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: "bold",
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </div>
                    <Text variant="bodySm" as="span">
                      {item}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Box>

          <Text variant="bodySm" tone="subdued" as="p">
            Your store's configuration will be preserved, but advanced features requiring a paid subscription will be locked until you upgrade again.
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
