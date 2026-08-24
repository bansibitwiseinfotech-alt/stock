import React, { useState, useEffect } from "react";
import {
  Modal,
  FormLayout,
  TextField,
  Select,
  Banner,
} from "@shopify/polaris";
import {
  fetchCompanionProducts,
  executeCreateBundle,
  executeDeleteBundle,
} from "../../services/deadStockApi";

export default function CreateDeadStockBundleModal({
  open = false,
  onClose,
  shop = "",
  deadStockProduct = null,
  initialBundle = null,
  onSuccess,
  onDeleted,
}) {
  const activeShop =
    shop ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";

  const effectiveBundle = initialBundle || deadStockProduct?.activeBundle || null;

  const [companionList, setCompanionList] = useState([]);
  const [selectedCompanionId, setSelectedCompanionId] = useState("");
  const [offer, setOffer] = useState("");
  const [selectedFreeProductId, setSelectedFreeProductId] = useState("");
  const [bundleName, setBundleName] = useState("");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  const [isLoadingCompanions, setIsLoadingCompanions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const productId =
    deadStockProduct?.variantId ||
    deadStockProduct?.shopifyVariantId ||
    deadStockProduct?.productId ||
    deadStockProduct?.id ||
    "";

  // Load companion products when modal opens
  useEffect(() => {
    if (!open || !productId) return;

    setError("");
    setIsLoadingCompanions(true);

    fetchCompanionProducts(activeShop, productId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCompanionList(list);

        // Pre-select companion if editing or default to first
        if (effectiveBundle && (effectiveBundle.companionProductId || effectiveBundle.companionVariantId)) {
          const matched = list.find(
            (p) =>
              String(p.productId || p.id).includes(String(effectiveBundle.companionProductId).replace(/\D/g, "")) ||
              String(p.variantId).includes(String(effectiveBundle.companionVariantId).replace(/\D/g, ""))
          );
          if (matched) {
            setSelectedCompanionId(matched.productId || matched.id);
          } else if (list.length > 0) {
            setSelectedCompanionId(list[0].productId || list[0].id);
          }
        } else if (list.length > 0) {
          setSelectedCompanionId(list[0].productId || list[0].id);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch companion products:", err);
      })
      .finally(() => {
        setIsLoadingCompanions(false);
      });
  }, [open, productId, activeShop, effectiveBundle]);

  // Initialize bundle fields
  useEffect(() => {
    if (!open) return;

    if (effectiveBundle) {
      setBundleName(effectiveBundle.bundleName || effectiveBundle.name || "");
      setDiscountPercent(
        String(
          effectiveBundle.discountPercent != null
            ? effectiveBundle.discountPercent
            : effectiveBundle.discountPercentage != null
            ? effectiveBundle.discountPercentage
            : "10"
        )
      );

      const isEffectiveBogo =
        String(effectiveBundle.offerType || "").trim().toUpperCase() === "BOGO" ||
        String(effectiveBundle.metadata?.offerType || "").trim().toUpperCase() === "BOGO";
      setOffer(isEffectiveBogo ? "BOGO" : "");

      const rawFreeId = isEffectiveBogo
        ? (effectiveBundle.freeProductId || effectiveBundle.metadata?.freeProductId || "")
        : "";
      setSelectedFreeProductId(rawFreeId ? String(rawFreeId) : "");

      setIsNameManuallyEdited(true);
    } else {
      const prodTitle = deadStockProduct?.title || "Product";
      setBundleName(`${prodTitle} + Companion Bundle`);
      setDiscountPercent("10");
      setOffer("");
      setSelectedFreeProductId("");
      setIsNameManuallyEdited(false);
    }
  }, [open, deadStockProduct, effectiveBundle]);

  // Update bundle name if companion changes and user hasn't typed custom name
  const handleCompanionChange = (value) => {
    setSelectedCompanionId(value);
    if (!isNameManuallyEdited) {
      const selected = companionList.find((p) => (p.productId || p.id) === value);
      const deadTitle = deadStockProduct?.title || "Product";
      const compTitle = selected?.title ? selected.title : "Companion";
      setBundleName(`${deadTitle} + ${compTitle} Bundle`);
    }
  };

  const handleCreateOrUpdate = async () => {
    setError("");

    if (!selectedCompanionId) {
      setError("Please select a recommended product for the bundle.");
      return;
    }

    if (offer === "BOGO" && !selectedFreeProductId) {
      setError("Please select a free product for the Buy One Get One Free offer.");
      return;
    }

    if (!bundleName.trim()) {
      setError("Bundle name is required.");
      return;
    }

    const discountVal = Number(discountPercent);
    if (isNaN(discountVal) || discountVal < 0 || discountVal > 100) {
      setError("Bundle discount must be a valid percentage between 0 and 100.");
      return;
    }

    const selectedCompanion = companionList.find(
      (p) => (p.productId || p.id) === selectedCompanionId
    );

    const selectedFreeProduct = companionList.find(
      (p) => String(p.productId || p.id) === String(selectedFreeProductId)
    );

    try {
      setIsSubmitting(true);
      const payload = {
        deadStockProductId: deadStockProduct?.shopifyProductId || deadStockProduct?.productId || deadStockProduct?.id,
        deadStockVariantId: deadStockProduct?.shopifyVariantId || deadStockProduct?.variantId || deadStockProduct?.id,
        companionProductId: selectedCompanion?.productId || selectedCompanion?.id || selectedCompanionId,
        companionVariantId: selectedCompanion?.variantId || null,
        deadStockTitle: deadStockProduct?.title || deadStockProduct?.productTitle || "",
        companionTitle: selectedCompanion?.title || "",
        deadStockImage: deadStockProduct?.image || "",
        companionImage: selectedCompanion?.image || "",
        deadStockPrice: deadStockProduct?.currentPrice || deadStockProduct?.costPrice || 0,
        companionPrice: selectedCompanion?.price || 0,
        bundleName: bundleName.trim(),
        discountPercent: discountVal,
        offerType: offer || "NO_OFFER",
        freeProductId: offer === "BOGO" ? (selectedFreeProduct?.productId || selectedFreeProduct?.id || selectedFreeProductId || null) : null,
        freeProductVariantId: offer === "BOGO" ? (selectedFreeProduct?.variantId || null) : null,
        freeProductTitle: offer === "BOGO" ? (selectedFreeProduct?.title || "") : "",
        freeProductImage: offer === "BOGO" ? (selectedFreeProduct?.image || "") : "",
      };

      const result = await executeCreateBundle(activeShop, productId, payload);
      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save bundle configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this bundle? This action cannot be undone.")) return;

    setError("");
    try {
      setIsDeleting(true);
      const targetDeleteId = effectiveBundle?._id || productId;
      await executeDeleteBundle(activeShop, targetDeleteId);
      if (onDeleted) {
        onDeleted();
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to delete bundle.");
    } finally {
      setIsDeleting(false);
    }
  };

  const companionOptions = companionList.map((p) => ({
    label: `${p.title} (${p.stock ?? p.currentStock ?? 0} in stock)`,
    value: p.productId || p.id,
  }));

  const offerOptions = [
    { label: "Select Offer", value: "" },
    { label: "No Offer", value: "NO_OFFER" },
    { label: "Buy One Get One Free", value: "BOGO" },
  ];

  const freeProductOptions = companionList.map((p) => ({
    label: `${p.title} (${p.stock ?? p.currentStock ?? 0} in stock)`,
    value: String(p.productId || p.id),
  }));

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={() => !isSubmitting && !isDeleting && onClose()}
      title={effectiveBundle ? "Edit Dead Stock Bundle" : "Create Dead Stock Bundle"}
      primaryAction={{
        content: isSubmitting
          ? "Saving..."
          : effectiveBundle
          ? "Update Bundle"
          : "Create Bundle",
        onAction: handleCreateOrUpdate,
        loading: isSubmitting,
        disabled: isSubmitting || isDeleting || isLoadingCompanions,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
          disabled: isSubmitting || isDeleting,
        },
        ...(effectiveBundle
          ? [
              {
                content: "Delete Bundle",
                destructive: true,
                onAction: handleDelete,
                loading: isDeleting,
                disabled: isSubmitting || isDeleting,
              },
            ]
          : []),
      ]}
    >
      <Modal.Section>
        <FormLayout>
          {error && (
            <Banner tone="critical" onDismiss={() => setError("")}>
              <p>{error}</p>
            </Banner>
          )}

          <TextField
            label="Dead Stock Product"
            value={deadStockProduct?.title || ""}
            disabled
            autoComplete="off"
          />

          <Select
            label="Recommended Product"
            options={
              companionOptions.length > 0
                ? companionOptions
                : [{ label: "Loading products...", value: "" }]
            }
            value={selectedCompanionId}
            onChange={handleCompanionChange}
            disabled={isLoadingCompanions || companionOptions.length === 0}
          />

          <Select
            label="Offer"
            options={offerOptions}
            value={offer}
            onChange={(val) => {
              setOffer(val);
              if (val !== "BOGO") {
                setSelectedFreeProductId("");
              }
            }}
          />

          {offer === "BOGO" && (
            <Select
              label="Free Product"
              options={[
                { label: "Select Product", value: "" },
                ...freeProductOptions,
              ]}
              value={selectedFreeProductId}
              onChange={(val) => setSelectedFreeProductId(val)}
              disabled={isLoadingCompanions || freeProductOptions.length === 0}
            />
          )}

          <TextField
            label="Bundle Name"
            value={bundleName}
            onChange={(val) => {
              setBundleName(val);
              setIsNameManuallyEdited(true);
            }}
            autoComplete="off"
          />

          <TextField
            label="Bundle Discount (%)"
            type="number"
            value={discountPercent}
            onChange={setDiscountPercent}
            autoComplete="off"
            min={0}
            max={100}
          />
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}

