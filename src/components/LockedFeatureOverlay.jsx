import React from "react";
import { BlockStack, Text, Box } from "@shopify/polaris";

export default function LockedFeatureOverlay({
  requiredPlan = "Pro",
  onUpgradeClick,
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 50,
        textAlign: "center",
        pointerEvents: "auto",
      }}
    >
      <BlockStack gap="200" align="center">
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "#fef3c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            fontSize: "24px",
            boxShadow: "0 2px 8px rgba(245, 158, 11, 0.2)",
          }}
        >
          🔒
        </div>

        <Text variant="headingMd" as="h3" fontWeight="bold">
          {requiredPlan} Feature
        </Text>

        <Text variant="bodySm" tone="subdued" as="p">
          Upgrade to {requiredPlan} to unlock this feature.
        </Text>

        <Box paddingTop="150">
          <button
            type="button"
            onClick={() => {
              if (onUpgradeClick) {
                onUpgradeClick();
              } else if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search);
                const shop = params.get("shop") || "";
                const url = shop
                  ? `/app/billing?shop=${encodeURIComponent(shop)}`
                  : "/app/billing";
                window.location.href = url;
              }
            }}
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              fontWeight: "600",
              fontSize: "13px",
              padding: "8px 22px",
              border: "none",
              borderRadius: "20px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
              transition: "all 0.2s ease-in-out",
            }}
          >
            Upgrade Plan
          </button>
        </Box>
      </BlockStack>
    </div>
  );
}
