import React from "react";
import {
  InlineStack,
  Select,
  TextField,
  Box,
  Button,
} from "@shopify/polaris";

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
}) {
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
    onApply();
  };

  return (
    <Box paddingBlockEnd="400">
      <InlineStack
        gap="300"
        blockAlign="end"
        wrap
      >
        {!showStoreProducts && (
          <Select
            label="Unsold Days"
            options={[
              {
                label: "All Days",
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
        )}

        {/* Search */}
        <div
          style={{
            flex: 1,
            minWidth: "300px",
          }}
        >
          <TextField
            label="Search"
            placeholder="Search by title or SKU..."
            value={searchTerm}
            onChange={handleSearchChange}
            autoComplete="off"
            clearButton
            onClearButtonClick={handleSearchClear}
            connectedRight={
              <Button
                onClick={onApply}
                variant="primary"
              >
                Search
              </Button>
            }
          />
        </div>

        {/* Collection Bulk Sale */}
        <Button
          variant="primary"
          onClick={onCollectionBulkSale}
        >
          Collection Bulk Sale
        </Button>
      </InlineStack>
    </Box>
  );
}