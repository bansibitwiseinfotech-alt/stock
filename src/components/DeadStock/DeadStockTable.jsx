import React from "react";
import {
  IndexTable,
  Thumbnail,
  InlineStack,
  BlockStack,
  Text,
  Button,
  Card,
  Box,
} from "@shopify/polaris";
import { useNavigate } from "react-router";

export default function DeadStockTable({
  products = [],
  selectedProducts = [],
  onSelectProduct,
  onSelectAll,
}) {
  const navigate = useNavigate();

  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const handleTakeAction = (variantId, actionQuery = "") => {
    navigate(`/app/dead-stock/${encodeURIComponent(variantId)}${actionQuery ? `?action=${actionQuery}` : ""}`);
  };

  // Helper to check if item is selected
  const isItemSelected = (item) => {
    const resolvedId = item.shopifyVariantId || item.variantId || item.id || "";
    return selectedProducts.some((sel) => sel.id === resolvedId || sel.variantId === resolvedId);
  };

  const allSelected =
    products.length > 0 && products.every((item) => isItemSelected(item));
  const someSelected =
    products.some((item) => isItemSelected(item)) && !allSelected;

  const rowMarkup = products.map((item, index) => {
    const formattedCash = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(item.cashTiedUp || 0);

    const resolvedId = item.shopifyVariantId || item.variantId || item.id || "";
    const selected = isItemSelected(item);

    const rowKey = resolvedId
      ? `${resolvedId}_${item.locationId || "default"}`
      : `row_${index}`;

    const daysText =
      item.daysUnsold != null && item.daysUnsold !== ""
        ? `${item.daysUnsold} days`
        : "N/A";

    return (
      <IndexTable.Row
        id={rowKey}
        key={rowKey}
        selected={selected}
        position={index}
      >
        <IndexTable.Cell>
          <div style={{ maxWidth: "340px", padding: "6px 0" }}>
            <InlineStack gap="300" blockAlign="center" wrap={false}>
              <div style={{ flexShrink: 0 }}>
                <Thumbnail
                  source={item.image || ""}
                  alt={item.title}
                  size="small"
                />
              </div>

              <div style={{ minWidth: 0, overflow: "hidden" }}>
                <Text variant="bodyMd" fontWeight="bold" as="p" truncate>
                  {item.title}
                </Text>

                <Text variant="bodySm" tone="subdued" as="p" truncate>
                  SKU: {item.sku && item.sku.trim() ? item.sku : "N/A"}
                </Text>
              </div>
            </InlineStack>
          </div>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {item.stock ?? item.inventoryQuantity ?? 0} units
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {daysText}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {item.salesVelocity ? `${item.salesVelocity}/day` : "0/day"}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {formattedCash}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Button size="slim" onClick={() => handleTakeAction(resolvedId)}>
            Take Action
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card padding="0">
      <Box width="100%">
        <IndexTable
          resourceName={resourceName}
          itemCount={products.length}
          selectedItemsCount={
            allSelected ? "All" : someSelected ? selectedProducts.length : 0
          }
          onSelectionChange={(_selectionType, isSelecting, selectionId) => {
            if (_selectionType === "all") {
              onSelectAll(isSelecting);
            } else {
              const product = products.find((item, idx) => {
                const resId = item.shopifyVariantId || item.variantId || item.id || "";
                const k = resId ? `${resId}_${item.locationId || "default"}` : `row_${idx}`;
                return k === selectionId;
              });
              if (product) {
                onSelectProduct(product);
              }
            }
          }}
          headings={[
            { title: "Product / SKU" },
            { title: "Stock Units" },
            { title: "Days Unsold" },
            { title: "Sales Velocity" },
            { title: "Cash Tied Up" },
            { title: "Action" },
          ]}
          selectable
        >
          {rowMarkup}
        </IndexTable>
      </Box>
    </Card>
  );
}