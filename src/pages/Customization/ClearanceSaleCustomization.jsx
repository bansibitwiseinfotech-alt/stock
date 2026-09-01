import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  RangeSlider,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  Text,
  Modal,
  InlineGrid,
  Divider,
} from "@shopify/polaris";
import { useNavigate } from "react-router";
import {
  fetchClearanceSaleConfigApi,
  saveClearanceSaleConfigApi,
  resetClearanceSaleConfigApi,
} from "../../services/appApi";

const DEFAULT_CONFIG = {
  enabled: true,
  badgeTitle: "Clearance Sale",
  supportingText: "Limited time offer",
  limitedTimeText: "Limited time offer",
  discountPercentage: 10,
  showIcon: true,
  showSupportingText: true,
  showSavings: true,
  showPrice: true,
  layout: "horizontal",
  alignment: "left",
  backgroundColor: "#FFF1F2",
  textColor: "#991B1B",
  accentColor: "#DC2626",
  borderColor: "#FECACA",
  borderRadius: 8,
  paddingTop: 14,
  paddingBottom: 14,
  paddingLeft: 16,
  paddingRight: 16,
  fontFamily: "Arial",
  fontSize: "13px",
  fontWeight: "600",
};

export default function ClearanceSaleCustomization({ shopDomain = "", initialConfig = null }) {
  const navigate = useNavigate();

  const [savedConfig, setSavedConfig] = useState(initialConfig || DEFAULT_CONFIG);
  const [formState, setFormState] = useState(initialConfig || DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null);

  useEffect(() => {
    if (!initialConfig && shopDomain) {
      setLoading(true);
      fetchClearanceSaleConfigApi(shopDomain)
        .then((data) => {
          if (data) {
            setSavedConfig(data);
            setFormState(data);
          }
        })
        .catch((err) => {
          console.error("Failed to load clearance sale configuration:", err);
        })
        .finally(() => setLoading(false));
    }
  }, [shopDomain, initialConfig]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formState) !== JSON.stringify(savedConfig);
  }, [formState, savedConfig]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleChange = useCallback((field, value) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setBannerMessage(null);
    try {
      const payload = {
        ...formState,
        limitedTimeText: formState.limitedTimeText ?? formState.supportingText ?? "Limited time offer",
        discountPercentage: Number(formState.discountPercentage ?? 10),
        supportingText: formState.limitedTimeText ?? formState.supportingText ?? "Limited time offer",
      };

      const res = await saveClearanceSaleConfigApi(shopDomain, payload);
      const persisted = res?.data || payload;
      const normalized = {
        ...DEFAULT_CONFIG,
        ...persisted,
        limitedTimeText: persisted.limitedTimeText ?? persisted.supportingText ?? "Limited time offer",
        supportingText: persisted.limitedTimeText ?? persisted.supportingText ?? "Limited time offer",
        discountPercentage: Number(persisted.discountPercentage ?? 10),
      };
      setSavedConfig(normalized);
      setFormState(normalized);
      setBannerMessage({
        tone: "success",
        text: "Clearance Sale configuration saved successfully! Your storefront will reflect these changes.",
      });
    } catch (err) {
      setBannerMessage({
        tone: "critical",
        text: "Failed to save Clearance Sale configuration. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      const res = await resetClearanceSaleConfigApi(shopDomain);
      const resetData = res?.data || DEFAULT_CONFIG;
      setSavedConfig(resetData);
      setFormState(resetData);
      setResetModalOpen(false);
      setBannerMessage({
        tone: "success",
        text: "Clearance Sale configuration reset to default settings.",
      });
    } catch (err) {
      setBannerMessage({
        tone: "critical",
        text: "Failed to reset settings to defaults.",
      });
    } finally {
      setResetting(false);
    }
  };

  const storefrontUrl = shopDomain ? `https://${shopDomain}` : null;

  return (
    <Page
      fullWidth
      title="Clearance Sale"
      subtitle="Customize the appearance and content of your Clearance Sale promotion."
      backAction={{
        content: "Customization",
        onAction: () => {
          if (isDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
              navigate("/app/customization");
            }
          } else {
            navigate("/app/customization");
          }
        },
      }}
      primaryAction={{
        content: "Save changes",
        onAction: handleSave,
        loading: saving,
        disabled: !isDirty || loading,
      }}
      secondaryActions={[
        {
          content: "Reset to defaults",
          onAction: () => setResetModalOpen(true),
          disabled: loading || saving,
        },
      ]}
    >
      <Layout>
        {isDirty && (
          <Layout.Section>
            <Banner tone="warning">
              <p>You have unsaved changes. Click <strong>Save changes</strong> to publish your updates to the storefront.</p>
            </Banner>
          </Layout.Section>
        )}

        {bannerMessage && (
          <Layout.Section>
            <Banner tone={bannerMessage.tone} onDismiss={() => setBannerMessage(null)}>
              <p>{bannerMessage.text}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* LEFT COLUMN: SETTINGS FORM */}
        <Layout.Section>
          <BlockStack gap="400">
            {/* SECTION 1 — CONTENT */}
            <Card title="Content">
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Content & Text</Text>
                <FormLayout>
                  <TextField
                    label="Badge title"
                    value={formState.badgeTitle}
                    onChange={(val) => handleChange("badgeTitle", val)}
                    autoComplete="off"
                    helpText="Default: 'Clearance Sale'"
                  />

                  <TextField
                    label="Supporting text"
                    value={formState.limitedTimeText ?? formState.supportingText ?? "Limited time offer"}
                    onChange={(val) => {
                      handleChange("limitedTimeText", val);
                      handleChange("supportingText", val);
                    }}
                    autoComplete="off"
                    helpText="Default: 'Limited time offer'"
                  />

                  <TextField
                    label="Discount percentage"
                    type="number"
                    value={String(formState.discountPercentage ?? 10)}
                    onChange={(val) => handleChange("discountPercentage", Number(val || 0))}
                    autoComplete="off"
                    min={0}
                    max={100}
                    helpText="Default: 10%"
                  />

                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    <Checkbox
                      label="Show icon"
                      checked={formState.showIcon}
                      onChange={(val) => handleChange("showIcon", val)}
                      helpText="Display tag emoji 🏷️ next to badge title"
                    />

                    <Checkbox
                      label="Show supporting text"
                      checked={formState.showSupportingText}
                      onChange={(val) => handleChange("showSupportingText", val)}
                      helpText="Display supporting text subline"
                    />

                    <Checkbox
                      label="Show price"
                      checked={formState.showPrice}
                      onChange={(val) => handleChange("showPrice", val)}
                      helpText="Display original and clearance sale prices"
                    />

                    <Checkbox
                      label="Show savings"
                      checked={formState.showSavings}
                      onChange={(val) => handleChange("showSavings", val)}
                      helpText="Display total dollar savings amount"
                    />
                  </InlineGrid>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* SECTION 2 — LAYOUT & ALIGNMENT */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Layout & Alignment</Text>
                <FormLayout>
                  <Select
                    label="Layout"
                    options={[
                      { label: "Horizontal (Inline)", value: "horizontal" },
                      { label: "Stacked (Vertical)", value: "stacked" },
                    ]}
                    value={formState.layout}
                    onChange={(val) => handleChange("layout", val)}
                    helpText="Horizontal displays content side-by-side; Stacked displays content in vertical rows."
                  />

                  <Select
                    label="Alignment"
                    options={[
                      { label: "Left Aligned", value: "left" },
                      { label: "Center Aligned", value: "center" },
                      { label: "Right Aligned", value: "right" },
                    ]}
                    value={formState.alignment}
                    onChange={(val) => handleChange("alignment", val)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* SECTION 3 — COLOR SETTINGS */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Colors</Text>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <ColorPickerInput
                    label="Background color"
                    value={formState.backgroundColor}
                    onChange={(val) => handleChange("backgroundColor", val)}
                  />

                  <ColorPickerInput
                    label="Text color"
                    value={formState.textColor}
                    onChange={(val) => handleChange("textColor", val)}
                  />

                  <ColorPickerInput
                    label="Accent color"
                    value={formState.accentColor}
                    onChange={(val) => handleChange("accentColor", val)}
                  />

                  <ColorPickerInput
                    label="Border color"
                    value={formState.borderColor}
                    onChange={(val) => handleChange("borderColor", val)}
                  />
                </InlineGrid>
              </BlockStack>
            </Card>

            {/* SECTION 4 — SPACING & STYLE */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Spacing & Style</Text>
                <FormLayout>
                  <RangeSlider
                    label={`Border radius: ${formState.borderRadius}px`}
                    value={formState.borderRadius}
                    onChange={(val) => handleChange("borderRadius", val)}
                    min={0}
                    max={32}
                    step={1}
                    output
                  />

                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    <RangeSlider
                      label={`Padding top: ${formState.paddingTop}px`}
                      value={formState.paddingTop}
                      onChange={(val) => handleChange("paddingTop", val)}
                      min={0}
                      max={48}
                      step={1}
                      output
                    />

                    <RangeSlider
                      label={`Padding bottom: ${formState.paddingBottom}px`}
                      value={formState.paddingBottom}
                      onChange={(val) => handleChange("paddingBottom", val)}
                      min={0}
                      max={48}
                      step={1}
                      output
                    />

                    <RangeSlider
                      label={`Padding left: ${formState.paddingLeft}px`}
                      value={formState.paddingLeft}
                      onChange={(val) => handleChange("paddingLeft", val)}
                      min={0}
                      max={64}
                      step={1}
                      output
                    />

                    <RangeSlider
                      label={`Padding right: ${formState.paddingRight}px`}
                      value={formState.paddingRight}
                      onChange={(val) => handleChange("paddingRight", val)}
                      min={0}
                      max={64}
                      step={1}
                      output
                    />
                  </InlineGrid>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* SECTION 5 — TYPOGRAPHY */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Typography</Text>
                <FormLayout>
                  <TextField
                    label="Font family"
                    value={formState.fontFamily}
                    onChange={(val) => handleChange("fontFamily", val)}
                    autoComplete="off"
                    helpText="e.g., Arial, Georgia, 'Times New Roman', sans-serif"
                    placeholder="Arial"
                  />

                  <TextField
                    label="Font size"
                    value={formState.fontSize}
                    onChange={(val) => handleChange("fontSize", val)}
                    autoComplete="off"
                    helpText="e.g., 13px, 1.2em"
                    placeholder="13px"
                  />

                  <Select
                    label="Font weight"
                    options={[
                      { label: "300 - Light", value: "300" },
                      { label: "400 - Normal", value: "400" },
                      { label: "500 - Medium", value: "500" },
                      { label: "600 - Semibold", value: "600" },
                      { label: "700 - Bold", value: "700" },
                      { label: "800 - Extra Bold", value: "800" },
                      { label: "900 - Black", value: "900" },
                    ]}
                    value={formState.fontWeight}
                    onChange={(val) => handleChange("fontWeight", val)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* RIGHT COLUMN: LIVE STOREFRONT PREVIEW */}
        <Layout.Section variant="oneThird">
          <div style={{ position: "sticky", top: "20px" }}>
            <BlockStack gap="400">
              {/* STOREFRONT ACCURATE PREVIEW CARD */}
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingSm" as="h3">Storefront Preview</Text>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#0070f3",
                      background: "#e6f0ff",
                      borderRadius: "20px",
                      padding: "2px 10px",
                      letterSpacing: "0.01em",
                    }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0070f3", display: "inline-block", animation: "ssLivePulse 1.5s ease-in-out infinite" }} />
                      Live
                    </span>
                  </InlineStack>

                  <Text variant="bodySm" tone="subdued">
                    Exact 1:1 replica of your storefront badge — updates instantly as you change settings.
                  </Text>

                  <Divider />

                  {/* PRODUCT PAGE CONTEXT WRAPPER */}
                  <div style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}>
                    {/* Fake browser chrome */}
                    <div style={{
                      background: "#ffffff",
                      borderBottom: "1px solid #e5e7eb",
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#f87171" }} />
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#fbbf24" }} />
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#34d399" }} />
                      <div style={{
                        flex: 1,
                        background: "#f3f4f6",
                        borderRadius: "4px",
                        height: "14px",
                        marginLeft: "6px",
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: "6px",
                        fontSize: "8px",
                        color: "#9ca3af",
                        fontFamily: "monospace",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}>
                        {shopDomain ? `https://${shopDomain}/products/...` : "yourstore.myshopify.com/products/..."}
                      </div>
                    </div>

                    {/* Simulated product page content */}
                    <div style={{ padding: "14px" }}>
                      {/* Product title placeholder */}
                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ height: "13px", background: "#e5e7eb", borderRadius: "4px", width: "75%", marginBottom: "5px" }} />
                        <div style={{ height: "9px", background: "#f3f4f6", borderRadius: "4px", width: "45%" }} />
                      </div>

                      {/* Price placeholder */}
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
                        <div style={{ height: "16px", background: "#d1d5db", borderRadius: "4px", width: "55px" }} />
                        <div style={{ height: "11px", background: "#f3f4f6", borderRadius: "4px", width: "38px" }} />
                      </div>

                      {/* ★ THE ACTUAL STOREFRONT BADGE ★
                          Uses same CSS vars + class names as clearance_sale.liquid */}
                      <StorefrontAccurateBadge config={formState} />

                      {/* Add to cart button placeholder */}
                      <div style={{
                        marginTop: "12px",
                        height: "32px",
                        background: "#111827",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <div style={{ height: "9px", background: "#374151", borderRadius: "4px", width: "70px" }} />
                      </div>
                    </div>
                  </div>

                  {/* Pulse animation */}
                  <style>{`
                    @keyframes ssLivePulse {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.35; }
                    }
                  `}</style>
                </BlockStack>
              </Card>

              {/* VIEW ON STOREFRONT CARD */}
              {storefrontUrl && (
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">View on Storefront</Text>
                    <Text variant="bodySm" tone="subdued">
                      Save your changes, then open your store to see the live badge on a real product page.
                    </Text>
                    <InlineStack gap="200" blockAlign="center">
                      <Button
                        url={storefrontUrl}
                        external
                        disabled={isDirty}
                        variant="primary"
                        size="slim"
                      >
                        Open Store
                      </Button>
                      {isDirty && (
                        <Text variant="bodySm" tone="caution" as="span">
                          Save first to update storefront
                        </Text>
                      )}
                    </InlineStack>
                  </BlockStack>
                </Card>
              )}

              {/* SAVED vs DRAFT STATUS */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">Preview Status</Text>
                  <div style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: isDirty ? "#FFF7ED" : "#F0FDF4",
                    border: `1px solid ${isDirty ? "#FED7AA" : "#BBF7D0"}`,
                  }}>
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: isDirty ? "#F97316" : "#22C55E",
                      flexShrink: 0,
                      marginTop: "3px",
                    }} />
                    <Text variant="bodySm" as="span">
                      {isDirty
                        ? "Preview shows unsaved draft changes. Save to publish these styles to your storefront."
                        : "Preview matches your live storefront exactly. Customers see this design right now."}
                    </Text>
                  </div>
                </BlockStack>
              </Card>
            </BlockStack>
          </div>
        </Layout.Section>
      </Layout>

      {/* RESET CONFIRMATION MODAL */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset to defaults?"
        primaryAction={{
          content: "Reset to defaults",
          destructive: true,
          onAction: handleConfirmReset,
          loading: resetting,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setResetModalOpen(false),
            disabled: resetting,
          },
        ]}
      >
        <Modal.Section>
          <Text variant="bodyMd" as="p">
            Are you sure you want to reset all Clearance Sale customization settings to their default values?
          </Text>
          <div style={{ marginTop: "12px" }}>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="subdued" as="p">• Badge title → "Clearance Sale"</Text>
              <Text variant="bodySm" tone="subdued" as="p">• Supporting text → "Limited time offer"</Text>
              <Text variant="bodySm" tone="subdued" as="p">• Colors → Background #FFF1F2, Text #991B1B, Accent #DC2626, Border #FECACA</Text>
              <Text variant="bodySm" tone="subdued" as="p">• Radius & Padding → 8px radius, 14px T/B, 16px L/R</Text>
            </BlockStack>
          </div>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

function ColorPickerInput({ label, value, onChange }) {
  const [hexInput, setHexInput] = useState(value || "#000000");

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexChange = (newVal) => {
    setHexInput(newVal);
    if (/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(newVal.trim())) {
      onChange(newVal.trim());
    }
  };

  return (
    <BlockStack gap="100">
      <Text variant="bodySm" as="label">{label}</Text>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="color"
          value={value && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value) ? value : "#000000"}
          onChange={(e) => {
            setHexInput(e.target.value);
            onChange(e.target.value);
          }}
          style={{
            width: "36px",
            height: "36px",
            padding: 0,
            border: "1px solid #CBD5E1",
            borderRadius: "6px",
            cursor: "pointer",
            backgroundColor: "transparent",
          }}
        />
        <div style={{ flex: 1 }}>
          <TextField
            value={hexInput}
            onChange={handleHexChange}
            autoComplete="off"
            maxLength={7}
          />
        </div>
      </div>
    </BlockStack>
  );
}

/**
 * StorefrontAccurateBadge
 * ========================
 * Renders the clearance sale badge using EXACTLY the same CSS variable names,
 * class structure, and logic as clearance_sale.liquid — this preview is a
 * perfect 1:1 match of what customers see on the storefront.
 *
 * CSS variable names must stay in sync with clearance_sale.liquid renderSale().
 */
function StorefrontAccurateBadge({ config }) {
  const isStacked = config.layout === "stacked";
  const alignment = config.alignment || "left";
  const suppText = config.limitedTimeText || config.supportingText || "Limited time offer";
  const showSupp = Boolean(config.showSupportingText);
  const discountPercent = Number(config.discountPercentage ?? 10);
  const originalPrice = 99;
  const salePrice = Number((originalPrice * (1 - discountPercent / 100)).toFixed(2));
  const savings = Number((originalPrice - salePrice).toFixed(2));

  // CSS variables — matches clearance_sale.liquid renderSale() setProperty calls exactly
  const cssVars = {
    "--smart-stock-clearance-bg": config.backgroundColor || "#FFF1F2",
    "--smart-stock-clearance-text": config.textColor || "#991B1B",
    "--smart-stock-clearance-accent": config.accentColor || "#DC2626",
    "--smart-stock-clearance-border": config.borderColor || "#FECACA",
    "--smart-stock-clearance-radius": `${config.borderRadius ?? 8}px`,
    "--smart-stock-clearance-padding-top": `${config.paddingTop ?? 14}px`,
    "--smart-stock-clearance-padding-bottom": `${config.paddingBottom ?? 14}px`,
    "--smart-stock-clearance-padding-left": `${config.paddingLeft ?? 16}px`,
    "--smart-stock-clearance-padding-right": `${config.paddingRight ?? 16}px`,
    "--smart-stock-clearance-font-family": config.fontFamily || "Arial",
    "--smart-stock-clearance-font-size": config.fontSize || "13px",
    "--smart-stock-clearance-font-weight": config.fontWeight || "600",
    "--smart-stock-clearance-title-size": config.fontSize || "13px",
    "--smart-stock-clearance-title-weight": config.fontWeight || "600",
    "--smart-stock-clearance-discount-size": config.fontSize || "13px",
    "--smart-stock-clearance-discount-weight": config.fontWeight || "600",
    "--smart-stock-clearance-supporting-size": config.fontSize || "13px",
  };

  // Class names — matches clearance_sale.liquid className assignment logic exactly
  const classNames = [
    "ss-clearance-sale",
    `ss-clearance-sale--${isStacked ? "stacked" : "horizontal"}`,
    `ss-clearance-sale--${alignment}`,
  ].join(" ");

  return (
    <>
      {/* Inline styles that mirror the <style> block in clearance_sale.liquid */}
      <style>{`
        .ss-clearance-sale {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          max-width: 100%;
          padding: var(--smart-stock-clearance-padding-top) var(--smart-stock-clearance-padding-right) var(--smart-stock-clearance-padding-bottom) var(--smart-stock-clearance-padding-left);
          overflow-wrap: anywhere;
          color: var(--smart-stock-clearance-text);
          background: var(--smart-stock-clearance-bg);
          border: 1px solid var(--smart-stock-clearance-border);
          border-radius: var(--smart-stock-clearance-radius);
          font-family: var(--smart-stock-clearance-font-family, Arial);
          font-size: var(--smart-stock-clearance-font-size, 13px);
          font-weight: var(--smart-stock-clearance-font-weight, 600);
          transition: all 0.15s ease;
        }
        .ss-clearance-sale--stacked {
          align-items: flex-start;
          flex-direction: column;
          gap: 10px;
        }
        .ss-clearance-sale--center { text-align: center; }
        .ss-clearance-sale--right { text-align: right; }
        .ss-clearance-sale--center .ss-clearance-sale__main,
        .ss-clearance-sale--center .ss-clearance-sale__offer,
        .ss-clearance-sale--right .ss-clearance-sale__main,
        .ss-clearance-sale--right .ss-clearance-sale__offer { justify-content: flex-end; }
        .ss-clearance-sale--center .ss-clearance-sale__offer,
        .ss-clearance-sale--right .ss-clearance-sale__offer { align-items: flex-end; }
        .ss-clearance-sale--stacked.ss-clearance-sale--center,
        .ss-clearance-sale--stacked.ss-clearance-sale--right { align-items: center; }
        .ss-clearance-sale__main,
        .ss-clearance-sale__offer {
          display: flex;
          align-items: center;
          min-width: 0;
        }
        .ss-clearance-sale__main { gap: 9px; }
        .ss-clearance-sale__offer {
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px 14px;
        }
        .ss-clearance-sale--stacked .ss-clearance-sale__main,
        .ss-clearance-sale--stacked .ss-clearance-sale__offer { width: 100%; }
        .ss-clearance-sale--stacked .ss-clearance-sale__offer { justify-content: inherit; }
        .ss-clearance-sale__icon {
          flex: 0 0 auto;
          font-size: calc(var(--smart-stock-clearance-title-size) + 2px);
          line-height: 1;
        }
        .ss-clearance-sale__content,
        .ss-clearance-sale__title,
        .ss-clearance-sale__discount,
        .ss-clearance-sale__supporting,
        .ss-clearance-sale__price,
        .ss-clearance-sale__savings { margin: 0; }
        .ss-clearance-sale__content {
          display: flex;
          flex-direction: column;
          flex: 0 1 auto;
          min-width: 0;
        }
        .ss-clearance-sale__title {
          display: inline-block;
          flex: 0 1 auto;
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
          color: var(--smart-stock-clearance-text);
          font-size: var(--smart-stock-clearance-title-size);
          font-weight: var(--smart-stock-clearance-title-weight);
          line-height: 1.25;
        }
        .ss-clearance-sale__discount {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--smart-stock-clearance-accent);
          font-size: var(--smart-stock-clearance-discount-size);
          font-weight: var(--smart-stock-clearance-discount-weight);
          line-height: 1.25;
        }
        .ss-clearance-sale__supporting {
          color: var(--smart-stock-clearance-text);
          font-size: var(--smart-stock-clearance-supporting-size);
          line-height: 1.4;
          opacity: 0.78;
        }
        .ss-clearance-sale__price,
        .ss-clearance-sale__savings {
          font-size: var(--smart-stock-clearance-supporting-size);
          line-height: 1.4;
        }
        .ss-clearance-sale__price {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .ss-clearance-sale__price s { opacity: 0.65; }
        .ss-clearance-sale__price strong,
        .ss-clearance-sale__savings {
          color: var(--smart-stock-clearance-accent);
          font-weight: 700;
        }
      `}</style>

      <div className={classNames} style={cssVars}>
        {/* LEFT / MAIN section — title + icon */}
        <div className="ss-clearance-sale__main">
          {config.showIcon && (
            <span className="ss-clearance-sale__icon" aria-hidden="true">🏷️</span>
          )}
          <div className="ss-clearance-sale__content">
            <p className="ss-clearance-sale__title">
              {config.badgeTitle || "Clearance Sale"}
            </p>
            {showSupp && isStacked && (
              <p className="ss-clearance-sale__supporting">{suppText}</p>
            )}
          </div>
        </div>

        {/* RIGHT / OFFER section — discount, supporting text, price, savings */}
        <div className="ss-clearance-sale__offer">
          <p className="ss-clearance-sale__discount">
            <span aria-hidden="true">🔥</span>
            <span>{discountPercent}% OFF</span>
          </p>

          {showSupp && !isStacked && (
            <p className="ss-clearance-sale__supporting">{suppText}</p>
          )}

          {config.showPrice && (
            <p className="ss-clearance-sale__price">
              <s>${originalPrice}.00</s>
              <strong>${salePrice.toFixed(2)}</strong>
            </p>
          )}

          {config.showSavings && (
            <p className="ss-clearance-sale__savings">
              Save ${savings.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
