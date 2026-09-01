import React from "react";
import {
  InlineStack,
  Select,
  TextField,
  Box,
  Button,
  Icon,
} from "@shopify/polaris";
import { SearchIcon, DiscountIcon } from "@shopify/polaris-icons";

// ─────────────────────────────────────────────────────────────────────────────
// DeadStockFilters
// ─────────────────────────────────────────────────────────────────────────────

export default function DeadStockFilters({
  location,
  setLocation,
  collection,
  setCollection,
  days,
  setDays,
  searchTerm,
  setSearchTerm,
  showStoreProducts,
  setShowStoreProducts,
  onApply,

  // Collection Bulk Sale
  onCollectionBulkSale,
  currentPlan = "free",
}) {
  const isLocked = String(currentPlan || "free").toLowerCase() !== "premium";

  const handleLocationChange = (val) => {
    setLocation(val);
  };

  const handleCollectionChange = (val) => {
    setCollection(val);
  };

  const handleDaysChange = (val) => {
    setDays(val);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
  };

  const handleSearchClear = () => {
    setSearchTerm("");
    if (onApply) {
      setTimeout(() => onApply(), 0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onApply();
    }
  };

  return (
    <Box paddingBlockEnd="200">
      <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
        <div style={{ flex: 1, minWidth: "min(100%, 260px)" }}>
          <InlineStack gap="300" blockAlign="center" wrap>
            <div style={{ flex: 1, minWidth: "min(100%, 200px)" }}>
              <TextField
                label="Search products"
                labelHidden
                placeholder="Search by title or SKU..."
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown} 
                autoComplete="off"
                clearButton
                onClearButtonClick={handleSearchClear}
                prefix={<Icon source={SearchIcon} tone="subdued" />}
                connectedRight={
                  <Button onClick={onApply} variant="primary">
                    Search
                  </Button>
                }
              />
            </div>

            {!showStoreProducts && (
              <div style={{ minWidth: "min(100%, 140px)" }}>
                <Select
                  label="Unsold Days"
                  labelHidden
                  options={[
                    {
                      label: "All Unsold Days",
                      value: "all",
                    },
                    {
                      label: "30+ Days",
                      value: "30",
                    },
                    {
                      label: "60+ Days",
                      value: "60",
                    },
                    {
                      label: "90+ Days",
                      value: "90",
                    },
                  ]}
                  value={days}
                  onChange={handleDaysChange}
                />
              </div>
            )}
          </InlineStack>
        </div>

        {/* Collection Bulk Sale */}
        <InlineStack gap="200" blockAlign="center">
          <Button
            variant="primary"
            icon={DiscountIcon}
            onClick={onCollectionBulkSale}
          >
            {isLocked ? "Collection Bulk Sale 🔒" : "Collection Bulk Sale"}
          </Button>
        </InlineStack>
      </InlineStack>
    </Box>
  );
}