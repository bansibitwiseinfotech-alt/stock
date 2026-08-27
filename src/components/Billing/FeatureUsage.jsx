import React from "react";
import {
  BlockStack,
  InlineStack,
  Text,
  Badge,
  ProgressBar,
  Box,
  Icon,
} from "@shopify/polaris";
import { CheckIcon, LockIcon } from "@shopify/polaris-icons";

export default function FeatureUsage({
  label,
  used = 0,
  limit = 0,
  remaining = 0,
  unlimited = false,
  locked = false,
  lockedIn = "Basic",
  customizationAllowed = null,
  description = "",
}) {
  const isUnlimited = unlimited || limit === "unlimited" || limit === Infinity;
  const isLocked = locked || (!isUnlimited && Number(limit) === 0);

  // 1. LOCKED FEATURE ROW
  if (isLocked) {
    return (
      <Box
        background="bg-surface-secondary"
        padding="300"
        borderRadius="200"
      >
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Box
              background="bg-surface"
              padding="150"
              borderRadius="150"
            >
              <Icon source={LockIcon} tone="subdued" />
            </Box>
            <BlockStack gap="050">
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {label}
              </Text>
              {description && (
                <Text variant="bodyXs" tone="subdued" as="span">
                  {description}
                </Text>
              )}
            </BlockStack>
          </InlineStack>
          <Badge tone="info">Unlocked in {lockedIn}</Badge>
        </InlineStack>
      </Box>
    );
  }

  // 2. UNLIMITED FEATURE ROW
  if (isUnlimited) {
    return (
      <Box
        background="bg-surface-success"
        padding="300"
        borderRadius="200"
      >
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Box
              background="bg-surface"
              padding="150"
              borderRadius="150"
            >
              <Icon source={CheckIcon} tone="success" />
            </Box>
            <BlockStack gap="050">
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {label}
              </Text>
              <Text variant="bodyXs" tone="subdued" as="span">
                {used > 0 ? `${used} active uses` : "Unlimited usage available"}
              </Text>
            </BlockStack>
          </InlineStack>
          <Badge tone="success">Unlimited</Badge>
        </InlineStack>
      </Box>
    );
  }

  // 3. NUMBERED QUOTA FEATURE ROW
  const safeUsed = Math.max(0, Number(used) || 0);
  const safeLimit = Math.max(1, Number(limit) || 1);
  const percentage = Math.min(100, Math.round((safeUsed / safeLimit) * 100));
  const safeRemaining =
    typeof remaining === "number" ? remaining : Math.max(0, safeLimit - safeUsed);

  let barTone = "primary";
  if (percentage >= 100) {
    barTone = "critical";
  } else if (percentage >= 80) {
    barTone = "caution";
  }

  return (
    <Box
      background="bg-surface"
      padding="300"
      borderRadius="200"
      borderWidth="0165"
      borderColor="border"
    >
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Box
              background="bg-surface-secondary"
              padding="150"
              borderRadius="150"
            >
              <Icon source={CheckIcon} tone="success" />
            </Box>
            <BlockStack gap="050">
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {label}
              </Text>
              {description && (
                <Text variant="bodyXs" tone="subdued" as="span">
                  {description}
                </Text>
              )}
            </BlockStack>
          </InlineStack>

          <InlineStack gap="150" blockAlign="center">
            <Text variant="bodySm" fontWeight="bold" tone={safeRemaining === 0 ? "critical" : "base"} as="span">
              {safeUsed} / {safeLimit} Used
            </Text>
            <Badge tone={safeRemaining === 0 ? "critical" : "success"}>
              {safeRemaining} left
            </Badge>
          </InlineStack>
        </InlineStack>

        <ProgressBar progress={percentage} size="small" tone={barTone} />

        {customizationAllowed !== null && (
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="bodyXs" tone="subdued" as="span">
              {percentage}% Quota Consumed
            </Text>
            <Text variant="bodyXs" tone={customizationAllowed ? "success" : "subdued"} as="span">
              {customizationAllowed ? "✓ Customization Allowed" : "Standard Layout"}
            </Text>
          </InlineStack>
        )}
      </BlockStack>
    </Box>
  );
}
