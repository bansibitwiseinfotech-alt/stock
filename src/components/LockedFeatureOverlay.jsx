import React from "react";
import { BlockStack, Text, Box } from "@shopify/polaris";
import { useNavigate } from "react-router";

export default function LockedFeatureOverlay({
  requiredPlan = "Pro",
  onUpgradeClick,
}) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const shop = params.get("shop") || "";
      const targetUrl = shop
        ? `/app/billing?shop=${encodeURIComponent(shop)}`
        : "/app/billing";

      navigate(targetUrl);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 50,
        textAlign: "center",
        pointerEvents: "auto",
        overflow: "hidden",
      }}
    >
      <BlockStack gap="150" align="center">
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            backgroundColor: "#fef3c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            fontSize: "20px",
            boxShadow: "0 2px 6px rgba(245, 158, 11, 0.2)",
          }}
        >
          🔒
        </div>

        <Text variant="headingSm" as="h3" fontWeight="bold">
          {requiredPlan} Feature
        </Text>

        <Text variant="bodySm" tone="subdued" as="p">
          Upgrade to {requiredPlan} to unlock this feature.
        </Text>

        <Box paddingBlockStart="100">
          <button
            type="button"
            onClick={handleUpgrade}
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#ffffff",
              fontWeight: "600",
              fontSize: "12px",
              padding: "6px 18px",
              border: "none",
              borderRadius: "16px",                   
              cursor: "pointer",
              boxShadow: "0 3px 10px rgba(79, 70, 229, 0.3)",
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
