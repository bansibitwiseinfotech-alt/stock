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
  fetchBundleConfigApi,
  saveBundleConfigApi,
  resetBundleConfigApi,
} from "../services/appApi";

const DEFAULT_BUNDLE_SETTINGS = {
  enabled: true,
  headerTitle: "Frequently Bought Together",
  buttonText: "Add Both to Cart",
  showDiscountBadge: true,
  badgeColor: "#DCFCE7",
  badgeTextColor: "#15803D",
  buttonColor: "#111827",
  buttonTextColor: "#FFFFFF",
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

export default function BundleCustomizeModal({
  open,
  onClose,
  shop = "",
  onSaved = () => {},
}) {
  const [settings, setSettings] = useState(DEFAULT_BUNDLE_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (open && shop) {
      setLoading(true);
      fetchBundleConfigApi(shop)
        .then((data) => {
          if (data) {
            setSettings({
              ...DEFAULT_BUNDLE_SETTINGS,
              ...data,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load bundle settings:", err);
        })
        .finally(() => setLoading(false));
    }
  }, [open, shop]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveBundleConfigApi(shop, settings);
      setToastMessage({ tone: "success", text: "Bundle customization saved!" });
      onSaved(res.data || settings);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setToastMessage({
        tone: "critical",
        text: err.message || "Failed to save bundle settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await resetBundleConfigApi(shop);
      setSettings(DEFAULT_BUNDLE_SETTINGS);
      setToastMessage({
        tone: "success",
        text: "Reset to default settings!",
      });
      onSaved(DEFAULT_BUNDLE_SETTINGS);
    } catch (err) {
      setToastMessage({
        tone: "critical",
        text: err.message || "Failed to reset settings.",
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customize Frequently Bought Together Bundle"
      primaryAction={{
        content: "Save Changes",
        onAction: handleSave,
        loading: saving,
      }}
      secondaryActions={[
        {
          content: "Reset Default",
          onAction: handleReset,
          loading: resetting,
        },
        {
          content: "Cancel",
          onAction: onClose,
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

          {/* LIVE PREVIEW */}
          <BlockStack gap="200">
            <Text variant="headingSm" as="h4">
              Live Preview (Storefront Appearance)
            </Text>

            <Box
              padding="400"
              background="bg-surface-secondary"
              borderRadius="300"
              borderWidth="025"
              borderColor="border"
            >
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "14px",
                  padding: "16px",
                  maxWidth: "420px",
                  margin: "0 auto",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  fontFamily: "sans-serif",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #F3F4F6",
                    paddingBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>📦</span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {settings.headerTitle || "Frequently Bought Together"}
                    </span>
                  </div>
                  {settings.showDiscountBadge && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        background: settings.badgeColor || "#DCFCE7",
                        color: settings.badgeTextColor || "#15803D",
                        padding: "3px 8px",
                        borderRadius: "999px",
                        border: "1px solid #BBF7D0",
                        transition: "all 0.15s ease",
                      }}
                    >
                      SAVE 15% OFF
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    margin: "8px 0",
                  }}
                >
                  Gionee Max 32GB + Companion Bundle
                </div>

                <div
                  style={{
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#111827",
                        color: "#FFF",
                        fontSize: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✓
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#1F2937",
                      }}
                    >
                      Gionee Max 32GB (This item)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#111827",
                        color: "#FFF",
                        fontSize: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✓
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#1F2937",
                      }}
                    >
                      Nothing Phone Lite (Companion)
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    marginTop: "12px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#6B7280",
                        textTransform: "uppercase",
                      }}
                    >
                      Bundle Price
                    </div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: 800,
                        color: "#111827",
                      }}
                    >
                      $33,998.30{" "}
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#9CA3AF",
                          textDecoration: "line-through",
                        }}
                      >
                        $39,998.00
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#059669",
                      background: "#ECFDF5",
                      padding: "4px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Save $5,999.70
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    width: "100%",
                    marginTop: "12px",
                    padding: "10px",
                    background: settings.buttonColor || "#111827",
                    color: settings.buttonTextColor || "#FFFFFF",
                    border: "none",
                    borderRadius: `${settings.borderRadius || 8}px`,
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>⚡</span>
                  <span>
                    {settings.buttonText || "Add Both to Cart"} · $33,998.30
                  </span>
                </button>
              </div>
            </Box>
          </BlockStack>

          <Divider />

          <FormLayout>
            <Checkbox
              label="Enable Bundle Offer on storefront"
              helpText="When enabled, active bundles will appear on their respective product pages."
              checked={settings.enabled}
              onChange={(newVal) =>
                setSettings((prev) => ({ ...prev, enabled: newVal }))
              }
            />

            <TextField
              label="Widget Heading"
              value={settings.headerTitle}
              onChange={(val) =>
                setSettings((prev) => ({ ...prev, headerTitle: val }))
              }
              helpText="The main title displayed at the top of the bundle card."
              autoComplete="off"
            />

            <TextField
              label="Button Text"
              value={settings.buttonText}
              onChange={(val) =>
                setSettings((prev) => ({ ...prev, buttonText: val }))
              }
              helpText="The call-to-action on the 1-click buy button."
              autoComplete="off"
            />

            <Checkbox
              label="Show 'Save % OFF' discount badge"
              checked={settings.showDiscountBadge}
              onChange={(newVal) =>
                setSettings((prev) => ({
                  ...prev,
                  showDiscountBadge: newVal,
                }))
              }
            />

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Badge Background Color"
                  value={settings.badgeColor}
                  onChange={(val) => setSettings({ ...settings, badgeColor: val })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Badge Text Color"
                  value={settings.badgeTextColor}
                  onChange={(val) => setSettings({ ...settings, badgeTextColor: val })}
                />
              </div>
            </InlineStack>

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Button Background Color"
                  value={settings.buttonColor}
                  onChange={(val) => setSettings({ ...settings, buttonColor: val })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Button Text Color"
                  value={settings.buttonTextColor}
                  onChange={(val) => setSettings({ ...settings, buttonTextColor: val })}
                />
              </div>
            </InlineStack>
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
