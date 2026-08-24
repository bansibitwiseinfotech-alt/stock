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
  fetchMarkdownConfigApi,
  saveMarkdownConfigApi,
  resetMarkdownConfigApi,
} from "../services/appApi";

const DEFAULT_MARKDOWN_SETTINGS = {
  enabled: true,
  badgeText: "{discount}% OFF",
  showStrikethroughPrice: true,
  badgeBackgroundColor: "#E53935",
  badgeTextColor: "#FFFFFF",
  priceColor: "#111111",
  strikethroughColor: "#757575",
  borderRadius: 4,
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

export default function MarkdownCustomizeModal({
  open,
  onClose,
  shop = "",
  onSaved = () => {},
}) {
  const [settings, setSettings] = useState(DEFAULT_MARKDOWN_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (open && shop) {
      setLoading(true);
      fetchMarkdownConfigApi(shop)
        .then((data) => {
          if (data) {
            setSettings({
              ...DEFAULT_MARKDOWN_SETTINGS,
              ...data,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load markdown settings:", err);
        })
        .finally(() => setLoading(false));
    }
  }, [open, shop]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveMarkdownConfigApi(shop, settings);
      setToastMessage({ tone: "success", text: "Progressive Markdown customization saved!" });
      onSaved(res.data || settings);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      setToastMessage({
        tone: "critical",
        text: err.message || "Failed to save markdown settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await resetMarkdownConfigApi(shop);
      setSettings(DEFAULT_MARKDOWN_SETTINGS);
      setToastMessage({
        tone: "success",
        text: "Reset to default settings!",
      });
      onSaved(DEFAULT_MARKDOWN_SETTINGS);
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
      title="Customize Progressive Markdown Storefront Component"
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
              <Text variant="headingSm" as="h4">
                Storefront Live Preview
              </Text>
              <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: settings.badgeBackgroundColor || "#E53935",
                      color: settings.badgeTextColor || "#FFFFFF",
                      padding: "4px 10px",
                      borderRadius: `${settings.borderRadius || 4}px`,
                      fontSize: "13px",
                      fontWeight: "700",
                      width: "fit-content",
                      textTransform: "uppercase",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {(settings.badgeText || "{discount}% OFF").replace("{discount}", "20")}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                    {settings.showStrikethroughPrice && (
                      <span
                        style={{
                          color: settings.strikethroughColor || "#757575",
                          fontSize: "16px",
                          textDecoration: "line-through",
                          transition: "all 0.15s ease",
                        }}
                      >
                        $10,000.00
                      </span>
                    )}
                    <span
                      style={{
                        color: settings.priceColor || "#111111",
                        fontSize: "24px",
                        fontWeight: "700",
                        transition: "all 0.15s ease",
                      }}
                    >
                      $8,000.00
                    </span>
                  </div>
                </div>
              </div>
            </BlockStack>
          </Box>

          <Divider />

          {/* FORM CONTROLS */}
          <FormLayout>
            <TextField
              label="Badge Text Format"
              value={settings.badgeText}
              onChange={(val) => setSettings({ ...settings, badgeText: val })}
              helpText="Use {discount} as a placeholder for the actual discount percentage (e.g. {discount}% OFF)"
              autoComplete="off"
            />

            <Checkbox
              label="Show strikethrough original price"
              checked={settings.showStrikethroughPrice}
              onChange={(checked) => setSettings({ ...settings, showStrikethroughPrice: checked })}
            />

            <InlineStack gap="400">
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Badge Background Color"
                  value={settings.badgeBackgroundColor}
                  onChange={(val) => setSettings({ ...settings, badgeBackgroundColor: val })}
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
                  label="Current Price Color"
                  value={settings.priceColor}
                  onChange={(val) => setSettings({ ...settings, priceColor: val })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <ColorPickerField
                  label="Original Price Color"
                  value={settings.strikethroughColor}
                  onChange={(val) => setSettings({ ...settings, strikethroughColor: val })}
                />
              </div>
            </InlineStack>

            <TextField
              label="Badge Border Radius (px)"
              type="number"
              value={String(settings.borderRadius ?? 4)}
              onChange={(val) => setSettings({ ...settings, borderRadius: Number(val) || 0 })}
              autoComplete="off"
            />
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
