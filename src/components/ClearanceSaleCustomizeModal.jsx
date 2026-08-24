import { useEffect, useState } from "react";

import {
  Modal,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  BlockStack,
  Text,
  Divider,
  Box,
  ColorPicker,
  Popover,
  InlineStack,
} from "@shopify/polaris";

import {
  fetchClearanceSaleConfigApi,
  saveClearanceSaleConfigApi,
} from "../services/appApi";

/*
|--------------------------------------------------------------------------
| Storefront / Preview Defaults
|--------------------------------------------------------------------------
*/

const DEFAULT_SETTINGS = {
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

/*
|--------------------------------------------------------------------------
| Preview Product Data
|--------------------------------------------------------------------------
*/

const PREVIEW_ORIGINAL_PRICE = 16499;

const DEFAULT_PREVIEW_DISCOUNT_PERCENT = 10;

/*
|--------------------------------------------------------------------------
| Storefront Colors
|--------------------------------------------------------------------------
*/

const STOREFRONT_COLORS = {
  text: "#dc2626",

  background: "#fff5f5",

  border: "#fecaca",

  oldPrice: "#999999",
};

/*
|--------------------------------------------------------------------------
| Normalize saved settings
|--------------------------------------------------------------------------
*/

function normalizeSettings(data = {}) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...data,
  };

  merged.badgeTitle = data.badgeTitle ?? data.title ?? merged.badgeTitle ?? "Clearance Sale";
  merged.supportingText = data.supportingText ?? data.limitedTimeText ?? merged.supportingText ?? "Limited time offer";
  merged.limitedTimeText = data.limitedTimeText ?? data.supportingText ?? merged.limitedTimeText ?? merged.supportingText ?? "Limited time offer";
  merged.discountPercentage = Number(data.discountPercentage ?? merged.discountPercentage ?? 10);
  merged.borderRadius = Number(data.borderRadius ?? merged.borderRadius ?? 8);
  merged.paddingTop = Number(data.paddingTop ?? merged.paddingTop ?? 14);
  merged.paddingBottom = Number(data.paddingBottom ?? merged.paddingBottom ?? 14);
  merged.paddingLeft = Number(data.paddingLeft ?? merged.paddingLeft ?? 16);
  merged.paddingRight = Number(data.paddingRight ?? merged.paddingRight ?? 16);

  if (!merged.textColor) merged.textColor = DEFAULT_SETTINGS.textColor;
  if (!merged.backgroundColor) merged.backgroundColor = DEFAULT_SETTINGS.backgroundColor;
  if (!merged.borderColor) merged.borderColor = DEFAULT_SETTINGS.borderColor;
  if (!merged.accentColor) merged.accentColor = DEFAULT_SETTINGS.accentColor;

  return merged;
}

/*
|--------------------------------------------------------------------------
| HEX -> HSB
|--------------------------------------------------------------------------
|
| Shopify Polaris ColorPicker uses HSB values.
|
*/

function hexToHsb(hex) {
  let value = String(hex || "#000000")
    .replace("#", "")
    .trim();

  /*
  |--------------------------------------------------------------------------
  | Convert 3 digit HEX to 6 digit HEX
  |--------------------------------------------------------------------------
  */

  if (value.length === 3) {
    value = value
      .split("")
      .map((character) => {
        return character + character;
      })
      .join("");
  }

  /*
  |--------------------------------------------------------------------------
  | Invalid HEX fallback
  |--------------------------------------------------------------------------
  */

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    value = "000000";
  }

  /*
  |--------------------------------------------------------------------------
  | RGB
  |--------------------------------------------------------------------------
  */

  const red =
    parseInt(
      value.substring(0, 2),
      16
    ) / 255;

  const green =
    parseInt(
      value.substring(2, 4),
      16
    ) / 255;

  const blue =
    parseInt(
      value.substring(4, 6),
      16
    ) / 255;

  /*
  |--------------------------------------------------------------------------
  | HSB calculation
  |--------------------------------------------------------------------------
  */

  const max = Math.max(
    red,
    green,
    blue
  );

  const min = Math.min(
    red,
    green,
    blue
  );

  const delta = max - min;

  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue =
        60 *
        (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue =
        60 *
        ((blue - red) / delta + 2);
    } else {
      hue =
        60 *
        ((red - green) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  const saturation =
    max === 0
      ? 0
      : delta / max;

  const brightness = max;

  return {
    hue,
    saturation,
    brightness,
  };
}

/*
|--------------------------------------------------------------------------
| HSB -> HEX
|--------------------------------------------------------------------------
*/

function hsbToHex({
  hue,
  saturation,
  brightness,
}) {
  const chroma =
    brightness * saturation;

  const x =
    chroma *
    (1 -
      Math.abs(
        ((hue / 60) % 2) - 1
      ));

  const match =
    brightness - chroma;

  let red = 0;

  let green = 0;

  let blue = 0;

  /*
  |--------------------------------------------------------------------------
  | HSB sector
  |--------------------------------------------------------------------------
  */

  if (hue < 60) {
    red = chroma;
    green = x;
    blue = 0;
  } else if (hue < 120) {
    red = x;
    green = chroma;
    blue = 0;
  } else if (hue < 180) {
    red = 0;
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    red = 0;
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    green = 0;
    blue = chroma;
  } else {
    red = chroma;
    green = 0;
    blue = x;
  }

  /*
  |--------------------------------------------------------------------------
  | Convert to HEX
  |--------------------------------------------------------------------------
  */

  function toHex(value) {
    return Math.round(
      (value + match) * 255
    )
      .toString(16)
      .padStart(2, "0");
  }

  return (
    "#" +
    toHex(red) +
    toHex(green) +
    toHex(blue)
  );
}

/*
|--------------------------------------------------------------------------
| Color Picker Field
|--------------------------------------------------------------------------
|
| Usage:
|
| <ColorPickerField
|   label="Text Color"
|   value={settings.textColor}
|   onChange={(value) =>
|     updateField("textColor", value)
|   }
| />
|
*/

function ColorPickerField({
  label,
  value,
  onChange,
}) {
  const [active, setActive] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Make sure the picker always receives a valid HEX color
  |--------------------------------------------------------------------------
  */

  const validColor =
    /^#[0-9a-fA-F]{6}$/.test(
      value || ""
    )
      ? value
      : "#000000";

  /*
  |--------------------------------------------------------------------------
  | Convert HEX to HSB
  |--------------------------------------------------------------------------
  */

  const colorValue =
    hexToHsb(validColor);

  /*
  |--------------------------------------------------------------------------
  | Handle color selection
  |--------------------------------------------------------------------------
  */

  function handleColorChange(color) {
    const hex =
      hsbToHex(color);

    onChange(hex);
  }

  /*
  |--------------------------------------------------------------------------
  | Color preview square
  |--------------------------------------------------------------------------
  */

  const colorSwatch = (
    <span
      style={{
        display: "inline-block",

        width: "22px",

        height: "22px",

        minWidth: "22px",

        borderRadius: "4px",

        backgroundColor:
          validColor,

        border:
          "1px solid #c9cccf",

        boxSizing: "border-box",
      }}
    />
  );

  /*
  |--------------------------------------------------------------------------
  | Activator
  |--------------------------------------------------------------------------
  */

  const activator = (
    <div
      style={{
        width: "100%",

        cursor: "pointer",

        position: "relative",
      }}
      onClick={() =>
        setActive(true)
      }
    >
      <div
        style={{
          display: "flex",

          flexDirection: "column",

          gap: "6px",
        }}
      >
        {/* Label */}

        <div
          style={{
            fontSize: "13px",

            fontWeight: 450,

            color: "#202223",

            lineHeight: "20px",
          }}
        >
          {label}
        </div>

        {/* Color input */}

        <div
          style={{
            minHeight: "36px",

            width: "100%",

            display: "flex",

            alignItems: "center",

            gap: "10px",

            padding:
              "7px 12px",

            boxSizing:
              "border-box",

            border:
              "1px solid #8c9196",

            borderRadius: "6px",

            backgroundColor:
              "#ffffff",

            boxShadow:
              "0 1px 0 rgba(0,0,0,0.05)",

            transition:
              "border-color 0.15s ease",
          }}
        >
          {colorSwatch}

          <span
            style={{
              fontSize: "14px",

              color: "#202223",

              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",

              textTransform:
                "uppercase",
            }}
          >
            {validColor}
          </span>
        </div>
      </div>
    </div>
  );

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <Popover
      active={active}
      onClose={() =>
        setActive(false)
      }
      activator={activator}
      autofocusTarget="first-node"
    >
      <div
        style={{
          padding: "16px",

          width: "250px",

          boxSizing:
            "border-box",
        }}
      >
        <BlockStack gap="300">

          {/* =====================================================
              COLOR PICKER
          ===================================================== */}

          <ColorPicker
            color={colorValue}
            onChange={
              handleColorChange
            }
            allowAlpha={false}
          />

          {/* =====================================================
              SELECTED COLOR
          ===================================================== */}

          <div
            style={{
              borderTop:
                "1px solid #e1e3e5",

              paddingTop: "12px",
            }}
          >
            <InlineStack
              gap="300"
              blockAlign="center"
            >
              <span
                style={{
                  width: "30px",

                  height: "30px",

                  minWidth: "30px",

                  borderRadius: "5px",

                  backgroundColor:
                    validColor,

                  border:
                    "1px solid #c9cccf",
                }}
              />

              <BlockStack gap="050">
                <Text
                  variant="bodySm"
                  tone="subdued"
                >
                  Selected color
                </Text>

                <Text
                  variant="bodyMd"
                  fontWeight="semibold"
                >
                  {validColor.toUpperCase()}
                </Text>
              </BlockStack>
            </InlineStack>
          </div>

        </BlockStack>
      </div>
    </Popover>
  );
}

/*
|--------------------------------------------------------------------------
| Main Component
|--------------------------------------------------------------------------
*/

export default function ClearanceSaleCustomizeModal({
  open,

  onClose,

  shop,

  onSaved,
}) {
  /*
  |--------------------------------------------------------------------------
  | Settings
  |--------------------------------------------------------------------------
  */

  const [settings, setSettings] =
    useState(
      DEFAULT_SETTINGS
    );

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  const [loading, setLoading] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Saving
  |--------------------------------------------------------------------------
  */

  const [saving, setSaving] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Error
  |--------------------------------------------------------------------------
  */

  const [error, setError] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | Load settings when modal opens
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!open || !shop) {
      return;
    }

    loadSettings();
  }, [open, shop]);

  /*
  |--------------------------------------------------------------------------
  | Load Settings
  |--------------------------------------------------------------------------
  */

  async function loadSettings() {
    try {
      setLoading(true);

      setError("");

      const result = await fetchClearanceSaleConfigApi(shop);

      if (result) {
        const normalized = normalizeSettings(result);
        setSettings(normalized);
      } else {
        setSettings({ ...DEFAULT_SETTINGS });
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Failed to load settings"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Update Field
  |--------------------------------------------------------------------------
  */

  function updateField(
    field,
    value
  ) {
    setSettings(
      (previous) => ({
        ...previous,

        [field]: value,
      })
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Save Settings
  |--------------------------------------------------------------------------
  */

  async function handleSave() {
    try {
      setSaving(true);

      setError("");

      const payload = {
        ...DEFAULT_SETTINGS,
        ...settings,
        shop,
        badgeTitle: settings.badgeTitle ?? settings.title ?? "Clearance Sale",
        title: settings.badgeTitle ?? settings.title ?? "Clearance Sale",
        supportingText: settings.supportingText ?? settings.limitedTimeText ?? "Limited time offer",
        limitedTimeText: settings.limitedTimeText ?? settings.supportingText ?? "Limited time offer",
        discountPercentage: Number(settings.discountPercentage ?? DEFAULT_SETTINGS.discountPercentage),
        borderRadius: Number(settings.borderRadius ?? DEFAULT_SETTINGS.borderRadius),
        paddingTop: Number(settings.paddingTop ?? DEFAULT_SETTINGS.paddingTop),
        paddingBottom: Number(settings.paddingBottom ?? DEFAULT_SETTINGS.paddingBottom),
        paddingLeft: Number(settings.paddingLeft ?? DEFAULT_SETTINGS.paddingLeft),
        paddingRight: Number(settings.paddingRight ?? DEFAULT_SETTINGS.paddingRight),
      };

      const result = await saveClearanceSaleConfigApi(shop, payload);

      if (result?.success) {
        onSaved?.(result.data);
        onClose();
      } else {
        throw new Error(result?.message || "Failed to save settings");
      }
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Preview Calculations
  |--------------------------------------------------------------------------
  */

  const previewDiscountPercent = Number(
    settings?.discountPercentage ?? DEFAULT_PREVIEW_DISCOUNT_PERCENT
  );

  const discountAmount =
    PREVIEW_ORIGINAL_PRICE *
    (previewDiscountPercent / 100);

  const previewSalePrice =
    PREVIEW_ORIGINAL_PRICE -
    discountAmount;

  const previewSavings =
    discountAmount;

  /*
  |--------------------------------------------------------------------------
  | Format Price
  |--------------------------------------------------------------------------
  */

  function formatPrice(value) {
    return `$${value.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,

        maximumFractionDigits: 2,
      }
    )}`;
  }

  /*
  |--------------------------------------------------------------------------
  | Sale Preview
  |--------------------------------------------------------------------------
  */

  function SalePreview() {
    const fontFamily =
      settings.fontFamily ||
      DEFAULT_SETTINGS.fontFamily;

    const fontSize =
      settings.fontSize ||
      DEFAULT_SETTINGS.fontSize;

    const fontWeight =
      settings.fontWeight ||
      DEFAULT_SETTINGS.fontWeight;

    const textColor =
      settings.textColor ||
      STOREFRONT_COLORS.text;

    const backgroundColor =
      settings.backgroundColor ||
      STOREFRONT_COLORS.background;

    const borderColor =
      settings.borderColor ||
      STOREFRONT_COLORS.border;

    const borderRadius =
      settings.borderRadius ||
      DEFAULT_SETTINGS.borderRadius;

    return (
      <div
        style={{
          position: "relative",

          zIndex: 100,

          flexShrink: 0,

          width: "100%",

          boxSizing:
            "border-box",

          backgroundColor:
            "#ffffff",

          paddingTop: "4px",

          paddingBottom:
            "16px",

          borderBottom:
            "1px solid #e1e3e5",

          boxShadow:
            "0 2px 4px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* =====================================================
            PREVIEW TITLE
        ===================================================== */}

        <div
          style={{
            paddingBottom:
              "10px",
          }}
        >
          <Text
            variant="headingMd"
            as="h3"
          >
            Preview
          </Text>
        </div>

        {/* =====================================================
            SALE BANNER
        ===================================================== */}

        <div
          style={{
            width: "100%",

            minWidth: 0,

            boxSizing:
              "border-box",

            display: "flex",

            alignItems: "center",

            gap: "10px",

            padding:
              "11px 12px",

            backgroundColor,

            border:
              `1px solid ${borderColor}`,

            borderRadius,

            fontFamily,

            color: textColor,

            overflow: "hidden",

            lineHeight: "1.2",
          }}
        >
          {/* ===================================================
              SALE TITLE
          =================================================== */}

          <div
            style={{
              display: "flex",

              alignItems: "center",

              gap: "6px",

              flexShrink: 1,

              minWidth: 0,

              width: "105px",

              color: textColor,

              fontSize,

              fontWeight,

              lineHeight: "1.15",

              overflow: "hidden",
            }}
          >
            {/* TAG ICON */}

            <span
              style={{
                flexShrink: 0,

                fontSize: "13px",

                lineHeight: 1,
              }}
            >
              🏷️
            </span>

            {/* TITLE */}

            <span
              style={{
                minWidth: 0,

                overflow: "hidden",

                textOverflow:
                  "ellipsis",

                display:
                  "-webkit-box",

                WebkitLineClamp: 2,

                WebkitBoxOrient:
                  "vertical",

                whiteSpace: "normal",
              }}
            >
              {settings.badgeTitle || settings.title || "Clearance Sale"}
            </span>
          </div>

          {/* ===================================================
              DISCOUNT
          =================================================== */}

          <div
            style={{
              display: "flex",

              alignItems: "center",

              gap: "4px",

              flexShrink: 0,

              color: textColor,

              fontSize: "11px",

              fontWeight: 700,

              whiteSpace:
                "nowrap",
            }}
          >
            <span
              style={{
                fontSize: "13px",

                lineHeight: 1,
              }}
            >
              🔥
            </span>

            <span>
              {previewDiscountPercent}
              % OFF
            </span>
          </div>

          {/* ===================================================
              LIMITED TIME OFFER
          =================================================== */}

          <div
            style={{
              flex: 1,

              minWidth: 0,

              color: textColor,

              fontSize: "11px",

              fontWeight: 400,

              whiteSpace:
                "nowrap",

              overflow: "hidden",

              textOverflow:
                "ellipsis",
            }}
          >
            {settings.limitedTimeText || settings.supportingText || "Limited time offer"}
          </div>

          {/* ===================================================
              OLD PRICE
          =================================================== */}

          <span
            style={{
              flexShrink: 0,

              color:
                STOREFRONT_COLORS.oldPrice,

              fontSize: "10px",

              fontWeight: 400,

              textDecoration:
                "line-through",

              whiteSpace:
                "nowrap",
            }}
          >
            {formatPrice(
              PREVIEW_ORIGINAL_PRICE
            )}
          </span>

          {/* ===================================================
              SALE PRICE
          =================================================== */}

          <strong
            style={{
              flexShrink: 0,

              color: textColor,

              fontSize: "11px",

              fontWeight: 700,

              whiteSpace:
                "nowrap",
            }}
          >
            {formatPrice(
              previewSalePrice
            )}
          </strong>

          {/* ===================================================
              SAVINGS
          =================================================== */}

          <strong
            style={{
              flexShrink: 0,

              color: textColor,

              fontSize: "11px",

              fontWeight: 700,

              whiteSpace:
                "nowrap",
            }}
          >
            Save{" "}
            {formatPrice(
              previewSavings
            )}
          </strong>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Modal
  |--------------------------------------------------------------------------
  */

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customize Clearance Sale"
      primaryAction={{
        content: "Save",

        onAction:
          handleSave,

        loading: saving,

        disabled: loading,
      }}
      secondaryActions={[
        {
          content: "Cancel",

          onAction: onClose,

          disabled: saving,
        },
      ]}
    >
      <Modal.Section
        style={{
          padding: 0,
        }}
      >
        {/* =========================================================
            MAIN MODAL LAYOUT
        ========================================================= */}

        <div
          style={{
            display: "flex",

            flexDirection:
              "column",

            width: "100%",

            maxHeight:
              "calc(80vh - 20px)",

            overflow: "hidden",

            boxSizing:
              "border-box",

            backgroundColor:
              "#ffffff",
          }}
        >
          {/* =======================================================
              ERROR
          ======================================================= */}

          {error && (
            <div
              style={{
                flexShrink: 0,

                padding:
                  "12px 16px",

                backgroundColor:
                  "#ffffff",

                position:
                  "relative",

                zIndex: 110,
              }}
            >
              <Box
                padding="300"
                background="bg-surface-critical"
                borderRadius="200"
              >
                <Text tone="critical">
                  {error}
                </Text>
              </Box>
            </div>
          )}

          {/* =======================================================
              FIXED PREVIEW
          ======================================================= */}

          <div
            style={{
              flexShrink: 0,

              position:
                "relative",

              zIndex: 100,

              backgroundColor:
                "#ffffff",

              padding:
                "8px 16px 0 16px",

              boxSizing:
                "border-box",
            }}
          >
            <SalePreview />
          </div>

          {/* =======================================================
              SCROLLABLE SETTINGS
          ======================================================= */}

          <div
            style={{
              flex:
                "1 1 auto",

              minHeight: 0,

              overflowY: "auto",

              overflowX: "hidden",

              padding: "16px",

              boxSizing:
                "border-box",

              position:
                "relative",

              zIndex: 1,

              backgroundColor:
                "#ffffff",

              WebkitOverflowScrolling:
                "touch",
            }}
          >
            {/* ===================================================
                SETTINGS CONTENT
            ==================================================== */}

            <BlockStack gap="400">

              {/* =================================================
                  BASIC SETTINGS
              ================================================== 

              <Text
                variant="headingMd"
                as="h3"
              >
                Basic Settings
              </Text>

              <Checkbox
                label="Enable Clearance Sale"
                checked={
                  settings.enabled
                }
                onChange={(value) =>
                  updateField(
                    "enabled",
                    value
                  )
                }
              />

              <TextField
                label="Sale Title"
                value={
                  settings.badgeTitle ||
                  settings.title ||
                  ""
                }
                onChange={(value) =>
                  updateField(
                    "badgeTitle",
                    value
                  )
                }
                autoComplete="off"
              />

              <Divider />

              {/* =================================================
                  TYPOGRAPHY
              ================================================== */}

              <Text
                variant="headingMd"
                as="h3"
              >
                Typography
              </Text>

              <FormLayout>

                {/* FONT FAMILY */}

                <Select
                  label="Font Family"
                  value={
                    settings.fontFamily
                  }
                  options={[
                    {
                      label: "Arial",
                      value: "Arial",
                    },

                    {
                      label:
                        "Helvetica",
                      value:
                        "Helvetica",
                    },

                    {
                      label:
                        "Georgia",
                      value:
                        "Georgia",
                    },

                    {
                      label:
                        "Times New Roman",
                      value:
                        "Times New Roman",
                    },

                    {
                      label:
                        "Verdana",
                      value:
                        "Verdana",
                    },

                    {
                      label:
                        "Trebuchet MS",
                      value:
                        "Trebuchet MS",
                    },
                  ]}
                  onChange={(value) =>
                    updateField(
                      "fontFamily",
                      value
                    )
                  }
                />

                {/* FONT SIZE */}

                <Select
                  label="Font Size"
                  value={
                    settings.fontSize
                  }
                  options={[
                    {
                      label: "10px",
                      value: "10px",
                    },

                    {
                      label: "11px",
                      value: "11px",
                    },

                    {
                      label: "12px",
                      value: "12px",
                    },

                    {
                      label: "13px",
                      value: "13px",
                    },

                    {
                      label: "14px",
                      value: "14px",
                    },

                    {
                      label: "16px",
                      value: "16px",
                    },

                    {
                      label: "18px",
                      value: "18px",
                    },

                    {
                      label: "20px",
                      value: "20px",
                    },

                    {
                      label: "22px",
                      value: "22px",
                    },

                    {
                      label: "24px",
                      value: "24px",
                    },
                  ]}
                  onChange={(value) =>
                    updateField(
                      "fontSize",
                      value
                    )
                  }
                />

                {/* FONT WEIGHT */}

                <Select
                  label="Font Weight"
                  value={
                    settings.fontWeight
                  }
                  options={[
                    {
                      label: "Normal",
                      value: "400",
                    },

                    {
                      label: "Medium",
                      value: "500",
                    },

                    {
                      label:
                        "Semi Bold",
                      value: "600",
                    },

                    {
                      label: "Bold",
                      value: "700",
                    },

                    {
                      label:
                        "Extra Bold",
                      value: "800",
                    },
                  ]}
                  onChange={(value) =>
                    updateField(
                      "fontWeight",
                      value
                    )
                  }
                />

              </FormLayout>

              <Divider />

              {/* =================================================
                  COLORS
              ================================================== */}

              <Text
                variant="headingMd"
                as="h3"
              >
                Colors
              </Text>

              <FormLayout>

                {/* =================================================
                    TEXT COLOR
                ================================================== */}

                <ColorPickerField
                  label="Text Color"
                  value={
                    settings.textColor
                  }
                  onChange={(value) =>
                    updateField(
                      "textColor",
                      value
                    )
                  }
                />

                {/* =================================================
                    BACKGROUND COLOR
                ================================================== */}

                <ColorPickerField
                  label="Background Color"
                  value={
                    settings.backgroundColor
                  }
                  onChange={(value) =>
                    updateField(
                      "backgroundColor",
                      value
                    )
                  }
                />

                <ColorPickerField
                  label="Accent Color"
                  value={
                    settings.accentColor
                  }
                  onChange={(value) =>
                    updateField(
                      "accentColor",
                      value
                    )
                  }
                />

                {/* =================================================
                    BORDER COLOR
                ================================================== */}

                <ColorPickerField
                  label="Border Color"
                  value={
                    settings.borderColor
                  }
                  onChange={(value) =>
                    updateField(
                      "borderColor",
                      value
                    )
                  }
                />

                {/* =================================================
                    BORDER RADIUS
                ================================================== */}

                <TextField
                  label="Border Radius"
                  value={
                    settings.borderRadius
                  }
                  onChange={(value) =>
                    updateField(
                      "borderRadius",
                      value
                    )
                  }
                  placeholder="8px"
                  autoComplete="off"
                />

              </FormLayout>

              <Divider />

            
               
              {/* =================================================
                  FOOTER MESSAGE
              ================================================== */}

             

            </BlockStack>
          </div>
        </div>
      </Modal.Section>
    </Modal>
  );
}
