import React, { useState, useEffect } from "react";
import {
  Modal,
  FormLayout,
  TextField,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Box,
  Banner,
} from "@shopify/polaris";
import {
  fetchPreOrderConfigApi,
  savePreOrderConfigApi,
  resetPreOrderConfigApi,
} from "../services/appApi";

const DEFAULT_PRE_ORDER_SETTINGS = {
  enabled: true,
  buttonText: "PRE-ORDER NOW",
  badgeText: "🛒 PRE-ORDER",
  launchLabel: "NEW LAUNCH",
  cardBackgroundColor: "#FFFFFF",
  borderColor: "#E2E8F0",
  textColor: "#111827",
  accentColor: "#4F46E5",
  badgeBackgroundColor: "#0F172A",
  badgeTextColor: "#FFFFFF",
  borderRadius: 12,
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

export default function PreOrderCustomizeModal({
  open,
  onClose,
  shop = "",
  onSaved = () => {},
}) {
  const [settings, setSettings] = useState(DEFAULT_PRE_ORDER_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (open && shop) {
      setLoading(true);
      fetchPreOrderConfigApi(shop)
        .then((data) => {
          if (data) {
            setSettings({
              ...DEFAULT_PRE_ORDER_SETTINGS,
              ...data,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load pre-order settings:", err);
        })
        .finally(() => setLoading(false));
    }
  }, [open, shop]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await savePreOrderConfigApi(shop, settings);
      setToastMessage({ tone: "success", text: "Pre-Order styling customization saved!" });
      onSaved(res.data || settings);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setToastMessage({
        tone: "critical",
        text: err.message || "Failed to save pre-order settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await resetPreOrderConfigApi(shop);
      setSettings(DEFAULT_PRE_ORDER_SETTINGS);
      setToastMessage({
        tone: "success",
        text: "Reset to default settings!",
      });
      onSaved(DEFAULT_PRE_ORDER_SETTINGS);
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      title="Customize Pre-Order Storefront Component & Styling"
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

          {/* LIVE STOREFRONT PREVIEW */}
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
                  Simulating active launch product
                </Text>
              </InlineStack>

              <div
                style={{
                  backgroundColor: settings.cardBackgroundColor || "#FFFFFF",
                  border: `1.5px solid ${settings.borderColor || "#E2E8F0"}`,
                  borderRadius: `${settings.borderRadius ?? 12}px`,
                  padding: "16px 20px",
                  color: settings.textColor || "#111827",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: "700",
                      color: settings.textColor || "#111827",
                    }}
                  >
                    🚀 New Product Launch
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span
                      style={{
                        backgroundColor: settings.badgeBackgroundColor || "#0F172A",
                        color: settings.badgeTextColor || "#FFFFFF",
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        textTransform: "uppercase",
                      }}
                    >
                      {settings.badgeText || "🛒 PRE-ORDER"}
                    </span>
                    <span
                      style={{
                        backgroundColor: "#EEF2FF",
                        color: settings.accentColor || "#4F46E5",
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        textTransform: "uppercase",
                      }}
                    >
                      {settings.launchLabel || "NEW LAUNCH"}
                    </span>
                  </div>
                </div>

                {/* Schedule Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#F8FAFC",
                      border: `1px solid ${settings.borderColor || "#E2E8F0"}`,
                      borderRadius: "6px",
                      padding: "8px 10px",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#64748B", fontSize: "11px", display: "block" }}>
                      📅 Launch Date
                    </span>
                    <strong style={{ color: settings.textColor || "#111827" }}>
                      30 Aug 2026
                    </strong>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#F8FAFC",
                      border: `1px solid ${settings.borderColor || "#E2E8F0"}`,
                      borderRadius: "6px",
                      padding: "8px 10px",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#64748B", fontSize: "11px", display: "block" }}>
                      📦 Shipping Starts
                    </span>
                    <strong style={{ color: settings.textColor || "#111827" }}>
                      05 Sep 2026
                    </strong>
                  </div>
                </div>

                {/* Message Box */}
                <div
                  style={{
                    borderLeft: `3px solid ${settings.accentColor || "#4F46E5"}`,
                    backgroundColor: "#F8FAFC",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: settings.textColor || "#334155",
                    marginBottom: "12px",
                  }}
                >
                  ✨ Official release date confirmed. Reserve your unit today!
                </div>

                {/* Payment Breakdown Box */}
                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: `1px solid ${settings.borderColor || "#E2E8F0"}`,
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#475569",
                        letterSpacing: "0.5px",
                      }}
                    >
                      PRE-ORDER PAYMENT
                    </span>
                    <span
                      style={{
                        backgroundColor: settings.accentColor || "#4F46E5",
                        color: "#FFFFFF",
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      50% DEPOSIT
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ color: "#64748B" }}>Total Price:</span>
                    <span style={{ fontWeight: "600" }}>$10,000.00</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ color: settings.accentColor || "#4F46E5", fontWeight: "600" }}>
                      Pay Now (Deposit):
                    </span>
                    <span
                      style={{
                        fontWeight: "700",
                        color: settings.accentColor || "#4F46E5",
                      }}
                    >
                      $5,000.00
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#64748B",
                    }}
                  >
                    <span>Remaining Balance:</span>
                    <span>$5,000.00 (Due before dispatch)</span>
                  </div>
                </div>

                {/* Pre-Order Action Button */}
                <button
                  type="button"
                  style={{
                    width: "100%",
                    backgroundColor: settings.accentColor || "#4F46E5",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    fontSize: "14px",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <span>🛒</span>
                  <span>{settings.buttonText || "PRE-ORDER NOW"}</span>
                </button>
              </div>
            </BlockStack>
          </Box>

          <Divider />

          {/* FORM CONTROLS: LABELS & TEXTS */}
          <FormLayout>
            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Button Text"
                  value={settings.buttonText}
                  onChange={(val) => setSettings({ ...settings, buttonText: val })}
                  autoComplete="off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <TextField
                  label="Badge Text"
                  value={settings.badgeText}
                  onChange={(val) => setSettings({ ...settings, badgeText: val })}
                  autoComplete="off"
                />
              </div>
              <div style={{ flex: 1 }}>
                <TextField
                  label="Launch Tag / Label"
                  value={settings.launchLabel}
                  onChange={(val) => setSettings({ ...settings, launchLabel: val })}
                  autoComplete="off"
                />
              </div>
            </InlineStack>

            <Divider />

            {/* CARD COLORS & STYLING */}
            <Text variant="headingSm" as="h3">
              Card Colors & Styling
            </Text>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Card Background Color"
                  value={settings.cardBackgroundColor}
                  onChange={(val) =>
                    setSettings({ ...settings, cardBackgroundColor: val })
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Card Border Color"
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
                  label="Text & Title Color"
                  value={settings.textColor}
                  onChange={(val) =>
                    setSettings({ ...settings, textColor: val })
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Button / Accent Color"
                  value={settings.accentColor}
                  onChange={(val) =>
                    setSettings({ ...settings, accentColor: val })
                  }
                />
              </div>
            </InlineStack>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Badge Background Color"
                  value={settings.badgeBackgroundColor}
                  onChange={(val) =>
                    setSettings({ ...settings, badgeBackgroundColor: val })
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Badge Text Color"
                  value={settings.badgeTextColor}
                  onChange={(val) =>
                    setSettings({ ...settings, badgeTextColor: val })
                  }
                />
              </div>
            </InlineStack>

            <TextField
              label="Card Border Radius (px)"
              type="number"
              value={String(settings.borderRadius ?? 12)}
              onChange={(val) =>
                setSettings({
                  ...settings,
                  borderRadius: Math.max(0, Math.min(50, Number(val) || 0)),
                })
              }
              autoComplete="off"
            />
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
