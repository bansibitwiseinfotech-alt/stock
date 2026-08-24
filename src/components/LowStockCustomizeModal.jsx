import React, { useState, useEffect } from "react";
import {
  Modal,
  FormLayout,
  TextField,
  Checkbox,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Box,
  Banner,
} from "@shopify/polaris";
import {
  fetchLowStockConfigApi,
  saveLowStockConfigApi,
  resetLowStockConfigApi,
} from "../services/appApi";

const DEFAULT_LOW_STOCK_SETTINGS = {
  enabled: true,
  badgeText: "🔥 Only {stock} left in stock!",
  subtext: "Selling fast – high demand detected.",
  threshold: 5,
  showDaysRemaining: true,
  backgroundColor: "#FFF1F2",
  borderColor: "#FECDD3",
  textColor: "#991B1B",
  subtextColor: "#B91C1C",
  borderRadius: 8,
  pulseAnimation: true,
};

function ColorPickerField({ label, value, onChange }) {
  const safeHex = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value || "") ? value : "#000000";

  return (
    <BlockStack gap="100">
      <Text variant="bodySm" as="label" fontWeight="medium">
        {label}
      </Text>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #C9CCCF",
          borderRadius: "8px",
          padding: "4px 8px",
          height: "36px",
        }}
      >
        <label
          style={{
            position: "relative",
            width: "24px",
            height: "24px",
            borderRadius: "4px",
            backgroundColor: safeHex,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: "pointer",
            display: "inline-block",
            flexShrink: 0,
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
          title="Click to open color picker"
        >
          <input
            type="color"
            value={safeHex}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              top: "-10px",
              left: "-10px",
              width: "48px",
              height: "48px",
              opacity: 0,
              cursor: "pointer",
              border: "none",
            }}
          />
        </label>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          style={{
            border: "none",
            outline: "none",
            width: "100%",
            fontSize: "13px",
            fontFamily: "monospace",
            color: "#202223",
            background: "transparent",
          }}
        />
      </div>
    </BlockStack>
  );
}

export default function LowStockCustomizeModal({
  open,
  onClose,
  shop = "",
  onSaved = () => {},
}) {
  const [settings, setSettings] = useState(DEFAULT_LOW_STOCK_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (open && shop) {
      setLoading(true);
      fetchLowStockConfigApi(shop)
        .then((data) => {
          if (data) {
            setSettings({
              ...DEFAULT_LOW_STOCK_SETTINGS,
              ...data,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load low stock settings:", err);
        })
        .finally(() => setLoading(false));
    }
  }, [open, shop]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveLowStockConfigApi(shop, settings);
      setToastMessage({ tone: "success", text: "Low Stock Badge customization saved!" });
      onSaved(res.data || settings);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setToastMessage({
        tone: "critical",
        text: err.message || "Failed to save low stock settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await resetLowStockConfigApi(shop);
      setSettings(DEFAULT_LOW_STOCK_SETTINGS);
      setToastMessage({
        tone: "success",
        text: "Reset to default settings!",
      });
      onSaved(DEFAULT_LOW_STOCK_SETTINGS);
    } catch (err) {
      setToastMessage({
        tone: "critical",
        text: err.message || "Failed to reset settings.",
      });
    } finally {
      setResetting(false);
    }
  };

  if (!open) return null;

  const previewMainText = (settings.badgeText || "🔥 Only {stock} left in stock!").replace(
    /\{stock\}/gi,
    "4"
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customize Low Stock Badge Storefront Component"
      primaryAction={{
        content: "Save changes",
        onAction: handleSave,
        loading: saving,
        disabled: loading || resetting,
      }}
      secondaryActions={[
        {
          content: "Reset Defaults",
          onAction: handleReset,
          loading: resetting,
          disabled: loading || saving,
        },
        {
          content: "Cancel",
          onAction: onClose,
          disabled: saving || resetting,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {toastMessage && (
            <Banner
              tone={toastMessage.tone}
              onDismiss={() => setToastMessage(null)}
            >
              <p>{toastMessage.text}</p>
            </Banner>
          )}

          {/* LIVE PREVIEW BOX */}
          <Box
            padding="400"
            borderWidth="025"
            borderColor="border"
            borderRadius="300"
            background="bg-surface-secondary"
          >
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingSm" as="h4">
                  Storefront Live Preview
                </Text>
                <Text variant="bodyXs" tone="subdued">
                  Simulating 4 units in stock
                </Text>
              </InlineStack>

              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    padding: "12px 16px",
                    borderRadius: `${settings.borderRadius ?? 8}px`,
                    backgroundColor: settings.backgroundColor || "#FFF1F2",
                    border: `1px solid ${settings.borderColor || "#FECDD3"}`,
                    color: settings.textColor || "#991B1B",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "15px",
                      fontWeight: "700",
                      lineHeight: "1.3",
                      color: settings.textColor || "#991B1B",
                    }}
                  >
                    <span>{previewMainText}</span>
                  </div>
                  {settings.subtext ? (
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: settings.subtextColor || "#B91C1C",
                        marginLeft: "24px",
                        marginTop: "2px",
                      }}
                    >
                      {settings.subtext}
                    </div>
                  ) : null}
                </div>
              </div>
            </BlockStack>
          </Box>

          <Divider />

          {/* FORM CONTROLS */}
          <FormLayout>
            <TextField
              label="Badge Main Message"
              value={settings.badgeText}
              onChange={(val) => setSettings({ ...settings, badgeText: val })}
              helpText="Use {stock} placeholder for actual remaining inventory count (e.g. 🔥 Only {stock} left in stock!)"
              autoComplete="off"
            />

            <TextField
              label="Supporting Urgency Subtext"
              value={settings.subtext}
              onChange={(val) => setSettings({ ...settings, subtext: val })}
              helpText="Additional demand notice displayed below the main heading"
              autoComplete="off"
            />

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Low Stock Threshold (Units)"
                  type="number"
                  value={String(settings.threshold ?? 5)}
                  onChange={(val) =>
                    setSettings({
                      ...settings,
                      threshold: Math.max(1, Math.min(100, Number(val) || 1)),
                    })
                  }
                  helpText="Badge appears when inventory is at or below this number"
                  autoComplete="off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <TextField
                  label="Badge Corner Radius (px)"
                  type="number"
                  value={String(settings.borderRadius ?? 8)}
                  onChange={(val) =>
                    setSettings({
                      ...settings,
                      borderRadius: Math.max(0, Math.min(50, Number(val) || 0)),
                    })
                  }
                  autoComplete="off"
                />
              </div>
            </InlineStack>

            <Checkbox
              label="Show estimated days remaining when sales velocity is active"
              checked={Boolean(settings.showDaysRemaining)}
              onChange={(checked) =>
                setSettings({ ...settings, showDaysRemaining: checked })
              }
            />

            <Checkbox
              label="Enable pulse animation effect on storefront"
              checked={Boolean(settings.pulseAnimation)}
              onChange={(checked) =>
                setSettings({ ...settings, pulseAnimation: checked })
              }
            />

            <Divider />

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Background Color"
                  value={settings.backgroundColor}
                  onChange={(val) =>
                    setSettings({ ...settings, backgroundColor: val })
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Border Color"
                  value={settings.borderColor}
                  onChange={(val) =>
                    setSettings({ ...settings, borderColor: val })
                  }
                />
              </div>
            </InlineStack>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Main Text Color"
                  value={settings.textColor}
                  onChange={(val) =>
                    setSettings({ ...settings, textColor: val })
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Subtext Color"
                  value={settings.subtextColor}
                  onChange={(val) =>
                    setSettings({ ...settings, subtextColor: val })
                  }
                />
              </div>
            </InlineStack>
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
