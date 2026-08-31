import React, { useEffect, useState } from "react";

import {
  Modal,
  ResourceList,
  ResourceItem,
  Text,
  TextField,
  Select,
  Button,
  Spinner,
  Banner,
  BlockStack,
  InlineStack,
  Box,
  Divider,
} from "@shopify/polaris";
import LockedFeatureOverlay from "./LockedFeatureOverlay";
import { fetchSubscription } from "../services/subscriptionApi";

// ─────────────────────────────────────────────────────────────────────────────
// CollectionBulkSaleModal
// ─────────────────────────────────────────────────────────────────────────────

export default function CollectionBulkSaleModal({
  open,
  onClose,
  onSuccess,
  currentPlan = "free",
}) {
  const [collections, setCollections] = useState([]);

  const [loadingCollections, setLoadingCollections] =
    useState(false);

  const [selectedCollection, setSelectedCollection] =
    useState(null);

  const [search, setSearch] = useState("");
const [discount, setDiscount] = useState("20");

const [customDiscount, setCustomDiscount] =
  useState("");

const [duration, setDuration] = useState("14");

  const [startDate, setStartDate] = useState(
    getTodayDate()
  );

  const [launching, setLaunching] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");
  const [effectivePlan, setEffectivePlan] = useState(currentPlan);

  useEffect(() => {
    setEffectivePlan(currentPlan);
  }, [currentPlan]);

  const isLocked = String(effectivePlan || "free").toLowerCase() !== "premium";

  // ───────────────────────────────────────────────────────────────────────────
  // Load collections
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || isLocked) {
      return;
    }

    loadCollections();
  }, [open, isLocked]);

  async function loadCollections() {
    try {
      setLoadingCollections(true);
      setError("");

      const response = await fetch(
        "/app/api/collections"
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to load collections"
        );
      }

      setCollections(data.collections || []);
    } catch (error) {
      console.error(error);

      setError(
        error.message ||
          "Unable to load collections"
      );
    } finally {
      setLoadingCollections(false);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Select collection
  // ───────────────────────────────────────────────────────────────────────────

  function handleCollectionSelect(collection) {
    setSelectedCollection(collection);
    setError("");
    setSuccess("");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Back to collection list
  // ───────────────────────────────────────────────────────────────────────────

  function handleBack() {
    setSelectedCollection(null);
    setError("");
    setSuccess("");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Launch sale
  // ───────────────────────────────────────────────────────────────────────────

  async function handleLaunchSale() {
    if (!selectedCollection) {
      setError("Please select a collection.");
      return;
    }

    const discountValue =
      discount === "custom"
        ? Number(customDiscount)
        : Number(discount);

    const durationValue = Number(duration);
    if (!discountValue || discountValue <= 0 || discountValue >= 100) {
      setError("Discount must be between 1% and 99%.");
      return;
    }

    if (!durationValue || durationValue <= 0) {
      setError("Please select a valid duration.");
      return;
    }

    if (!startDate) {
      setError("Please select a start date.");
      return;
    }

    try {
      setLaunching(true);
      setError("");
      setSuccess("");

      const response = await fetch("/app/api/collection-bulk-sale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collectionId: selectedCollection.id,
          collectionTitle: selectedCollection.title,
          discount: discountValue,
          duration: durationValue,
          startDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to create sale.");
      }

      setSuccess(`Sale created successfully for "${selectedCollection.title}".`);

      if (onSuccess) {
        onSuccess(data);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error) {
      console.error(error);
      setError(error.message || "Unable to create collection sale.");
    } finally {
      setLaunching(false);
    }
  }

  async function handleDeleteSale() {
    if (!selectedCollection) {
      setError("Please select a collection.");
      return;
    }

    try {
      setDeleting(true);
      setError("");
      setSuccess("");

      const response = await fetch("/app/api/collection-bulk-sale", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collectionId: selectedCollection.id,
          collectionTitle: selectedCollection.title,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to delete sale.");
      }

      setSuccess(`Collection sale deleted for "${selectedCollection.title}".`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error) {
      console.error(error);
      setError(error.message || "Unable to delete collection sale.");
    } finally {
      setDeleting(false);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Search collections
  // ───────────────────────────────────────────────────────────────────────────

  const filteredCollections =
    collections.filter((collection) =>
      collection.title
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  if (isLocked) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Collection Bulk Sale"
        large
      >
        <Modal.Section>
          <div style={{ position: "relative", minHeight: "360px" }}>
            <LockedFeatureOverlay requiredPlan="Premium" />
          </div>
        </Modal.Section>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        selectedCollection
          ? "Create Collection Clearance Sale"
          : "Select Collection"
      }
      large
    >
      <Modal.Section>
        {error && (
          <Box paddingBlockEnd="300">
            <Banner tone="critical">
              {error}
            </Banner>
          </Box>
        )}

        {success && (
          <Box paddingBlockEnd="300">
            <Banner tone="success">
              {success}
            </Banner>
          </Box>
        )}

        {!selectedCollection ? (
          <CollectionList
            loading={loadingCollections}
            collections={filteredCollections}
            search={search}
            setSearch={setSearch}
            onSelect={
              handleCollectionSelect
            }
          />
        ) : (
        <SaleForm
  collection={
    selectedCollection
  }

  discount={discount}
  setDiscount={setDiscount}

  customDiscount={customDiscount}
  setCustomDiscount={setCustomDiscount}

  duration={duration}
  setDuration={setDuration}

  startDate={startDate}
  setStartDate={setStartDate}

  launching={launching}

  onBack={handleBack}
  onCancel={onClose}
  onLaunch={handleLaunchSale}
  onDelete={handleDeleteSale}
  deleting={deleting}
/>
        )}
      </Modal.Section>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection List
// ─────────────────────────────────────────────────────────────────────────────

function CollectionList({
  loading,
  collections,
  search,
  setSearch,
  onSelect,
}) {
  return (
    <BlockStack gap="400">
      <TextField
        label="Search Collections"
        placeholder="Search by collection name..."
        value={search}
        onChange={setSearch}
        autoComplete="off"
        clearButton
        onClearButtonClick={() =>
          setSearch("")
        }
      />

      <Divider />

      {loading ? (
        <Box
          padding="800"
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Spinner size="large" />
        </Box>
      ) : collections.length === 0 ? (
        <Box padding="500">
          <Text tone="subdued">
            No collections found.
          </Text>
        </Box>
      ) : (
        <ResourceList
          resourceName={{
            singular: "collection",
            plural: "collections",
          }}
          items={collections}
          renderItem={(collection) => (
            <ResourceItem
              id={collection.id}
              onClick={() =>
                onSelect(collection)
              }
            >
              <InlineStack
                align="space-between"
                blockAlign="center"
              >
                <BlockStack gap="100">
                  <Text
                    variant="bodyMd"
                    fontWeight="semibold"
                  >
                    {collection.title}
                  </Text>

                  <Text
                    variant="bodySm"
                    tone="subdued"
                  >
                    {
                      collection.productsCount
                    }{" "}
                    products
                  </Text>
                </BlockStack>

                <Button
                  onClick={(event) => {
                    event.stopPropagation();

                    onSelect(
                      collection
                    );
                  }}
                >
                  Select
                </Button>
              </InlineStack>
            </ResourceItem>
          )}
        />
      )}
    </BlockStack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sale Form
// ─────────────────────────────────────────────────────────────────────────────
function SaleForm({
  collection,

  discount,
  setDiscount,

  customDiscount,
  setCustomDiscount,

  duration,
  setDuration,

  startDate,
  setStartDate,

  launching,

  onBack,
  onCancel,
  onLaunch,
  onDelete,
  deleting,
}) {
  return (
    <BlockStack gap="500">
      <Banner tone="info">
        The sale will be applied to all
        products in this Shopify collection.
      </Banner>

      <BlockStack gap="200">
        <Text
          variant="headingMd"
          fontWeight="semibold"
        >
          Collection
        </Text>

        <Box
          padding="400"
          background="bg-surface-secondary"
          borderRadius="200"
        >
          <InlineStack
            align="space-between"
            blockAlign="center"
          >
            <BlockStack gap="100">
              <Text
                variant="bodyLg"
                fontWeight="semibold"
              >
                {collection.title}
              </Text>

              <Text tone="subdued">
                {collection.productsCount}{" "}
                products
              </Text>
            </BlockStack>
          </InlineStack>
        </Box>
      </BlockStack>

      <Divider />
<BlockStack gap="400">
  <Text
    variant="headingMd"
    fontWeight="semibold"
  >
    Sale Settings
  </Text>

  {/* Discount */}
  <Select
    label="Discount"
    value={discount}
    onChange={(value) => {
      setDiscount(value);

      if (value !== "custom") {
        setCustomDiscount("");
      }
    }}
    options={[
      {
        label: "10%",
        value: "10",
      },
      {
        label: "15%",
        value: "15",
      },
      {
        label: "20%",
        value: "20",
      },
      {
        label: "25%",
        value: "25",
      },
      {
        label: "30%",
        value: "30",
      },
      {
        label: "Custom",
        value: "custom",
      },
    ]}
  />

  {/* Custom Discount - YAHAN ADD KARNA HAI */}
  {discount === "custom" && (
    <TextField
      label="Custom discount"
      type="number"
      value={customDiscount}
      onChange={setCustomDiscount}
      suffix="%"
      min={1}
      max={99}
      autoComplete="off"
      helpText="Enter a discount between 1% and 99%."
    />
  )}

  {/* Duration */}
  <Select
    label="Duration"
    value={duration}
    onChange={setDuration}
    options={[
      {
        label: "7 days",
        value: "7",
      },
      {
        label: "14 days",
        value: "14",
      },
      {
        label: "21 days",
        value: "21",
      },
      {
        label: "30 days",
        value: "30",
      },
    ]}
  />

  {/* Start Date */}
  <TextField
    label="Start date"
    type="date"
    min={getTodayDate()}
    value={startDate}
    onChange={setStartDate}
    autoComplete="off"
  />
</BlockStack>
      <Divider />

      <InlineStack
        align="space-between"
        blockAlign="center"
      >
        <Button
          onClick={onBack}
          disabled={launching}
        >
          Back
        </Button>

        <InlineStack gap="300">
          <Button
            tone="critical"
            onClick={onDelete}
            disabled={launching || deleting}
            loading={deleting}
          >
            Delete Sale
          </Button>

          <Button
            onClick={onCancel}
            disabled={launching || deleting}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            loading={launching}
            disabled={deleting}
            onClick={onLaunch}
          >
            Launch Sale
          </Button>
        </InlineStack>
      </InlineStack>
    </BlockStack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getTodayDate() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}