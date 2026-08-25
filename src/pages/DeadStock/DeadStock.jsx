import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Page,
  Layout,
  Banner,
  BlockStack,
  InlineStack,
  Spinner,
  Card,
  Text,
  Button,
  Modal,
  FormLayout,
  Select,
  TextField,
  Badge,
  Thumbnail,
} from "@shopify/polaris";
import { useNavigate } from "react-router";
import {
  fetchDeadStockSummary,
  fetchDeadStockProducts,
  fetchStoreProducts,
  syncDeadStockData,
  executeBulkSale,
} from "../../services/deadStockApi";
import DeadStockSummary from "../../components/DeadStock/DeadStockSummary";
import DeadStockFilters from "../../components/DeadStock/DeadStockFilters";
import DeadStockTable from "../../components/DeadStock/DeadStockTable";
import DeadStockPagination from "../../components/DeadStock/DeadStockPagination";
import CollectionBulkSaleModal from "../../components/CollectionBulkSaleModal";
import {
  filterAndSortVisibleActions,
  ACTION_LABELS,
} from "../../utils/deadStockActions";

// Page size — default 50, respects Shopify max of 250
const DEFAULT_LIMIT = 50;

export default function DeadStock({
  shopDomain = "",
  shopToken = "",
  initialSummary,
  initialProducts,
  initialPagination,
}) {
  const navigate = useNavigate();
  const activeShop =
    shopDomain ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";
  const activeToken =
    shopToken ||
    (typeof window !== "undefined"
      ? window.sessionStorage.getItem("activeShopifyToken")
      : "") ||
    "";

  // ── Summary (global dead-stock aggregate from MongoDB) ─────────────────────
  const [summary, setSummary] = useState(
    initialSummary || { totalCashTiedUp: 0, deadStockSkuCount: 0 }
  );

  // ── Product list state ─────────────────────────────────────────────────────
  const [products, setProducts] = useState(initialProducts || []);

  // ── Selection state for Bulk Actions ──────────────────────────────────────
  const [selectedProducts, setSelectedProducts] = useState([]);

  // ── Bulk Sale Modal state ──────────────────────────────────────────────────
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkDiscount, setBulkDiscount] = useState("20");
  const [bulkDuration, setBulkDuration] = useState("14");
  const [bulkStartDate, setBulkStartDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [bulkErrors, setBulkErrors] = useState({});
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [bulkModalError, setBulkModalError] = useState("");
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState("");

  // ── Collection Bulk Sale modal state ─────────────────────────────────────
  const [collectionBulkSaleOpen, setCollectionBulkSaleOpen] = useState(false);

  // ── Shopify cursor-based pagination state ──────────────────────────────────
  const [cursorMap, setCursorMap] = useState({ 1: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(
    initialPagination?.hasNextPage ?? false
  );
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  // ── MongoDB (dead-stock mode) pagination state ─────────────────────────────
  const [mongoPage, setMongoPage] = useState(1);
  const [mongoPagination, setMongoPagination] = useState(
    initialPagination || { page: 1, limit: 10, totalPages: 1, totalItems: 0 }
  );

  // ── Filters ────────────────────────────────────────────────────────────────
  const [location, setLocation] = useState("all");
  const [collection, setCollection] = useState("all");
  const [days, setDays] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // MODE: true = Show all Shopify products (cursor pagination)
  //       false = Show only Dead Stock products (MongoDB)
  const [showStoreProducts, setShowStoreProducts] = useState(true);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  // Skip first client-side fetch — SSR loader already provided initialProducts
  const isFirstRender = useRef(true);

  // ─────────────────────────────────────────────────────────────────────────
  // loadShopifyPage — fetch one page from Shopify using cursor pagination
  // ─────────────────────────────────────────────────────────────────────────
  const loadShopifyPage = useCallback(
    async (targetPage, search) => {
      if (!activeShop || !activeToken) {
        setError("Shop domain or access token is missing.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const cursor = cursorMap[targetPage] ?? null;

        const result = await fetchStoreProducts({
          shop: activeShop,
          token: activeToken,
          limit: DEFAULT_LIMIT,
          cursor,
          search: search ?? searchTerm,
        });

        if (!result.success)
          throw new Error(result.message || "Failed to load products.");

        setProducts(result.data || []);
        setCurrentPage(targetPage);
        setHasNextPage(result.pagination?.hasNextPage ?? false);
        setHasPreviousPage(targetPage > 1);

        if (result.pagination?.nextCursor && result.pagination.hasNextPage) {
          setCursorMap((prev) => ({
            ...prev,
            [targetPage + 1]: result.pagination.nextCursor,
          }));
        }
      } catch (err) {
        console.error("[DeadStock] loadShopifyPage error:", err);
        setError(err.message || "Unable to load products.");
      } finally {
        setLoading(false);
      }
    },
    [activeShop, activeToken, cursorMap, searchTerm]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // loadMongoPage — fetch dead-stock products from MongoDB
  // ─────────────────────────────────────────────────────────────────────────
  const loadMongoPage = useCallback(
    async (targetPage, search) => {
      setLoading(true);
      setError("");

      try {
        const result = await fetchDeadStockProducts({
          shop: activeShop,
          days,
          locationId: location,
          collectionId: collection,
          search: search ?? searchTerm,
          page: targetPage,
          limit: 10,
        });

        if (!result.success)
          throw new Error(result.message || "Failed to load dead stock.");

        setProducts(result.data || []);
        setMongoPage(targetPage);
        setMongoPagination(result.pagination || mongoPagination);
      } catch (err) {
        console.error("[DeadStock] loadMongoPage error:", err);
        setError(err.message || "Unable to load dead stock.");
      } finally {
        setLoading(false);
      }
    },
    [activeShop, days, location, collection, searchTerm]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // resetAndLoad — reset pagination and load page 1
  // ─────────────────────────────────────────────────────────────────────────
  const resetAndLoad = useCallback(
    (newSearch, newShowStore) => {
      setCursorMap({ 1: null });
      setCurrentPage(1);
      setMongoPage(1);

      if (newShowStore) {
        loadShopifyPage(1, newSearch);
      } else {
        loadMongoPage(1, newSearch);
      }
    },
    [loadShopifyPage, loadMongoPage]
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!initialProducts || initialProducts.length === 0) {
        resetAndLoad(searchTerm, showStoreProducts);
      }
      return;
    }
    resetAndLoad(searchTerm, showStoreProducts);
  }, [days, location, collection, showStoreProducts, activeShop]);

  useEffect(() => {
    if (!activeShop) return;
    fetchDeadStockSummary(activeShop)
      .then((data) => {
        if (data) setSummary(data);
      })
      .catch((err) => console.warn("[Summary]", err.message));
  }, [activeShop]);

  const handleApplyFilters = () => {
    resetAndLoad(searchTerm, showStoreProducts);
  };

  const handleNextPage = () => {
    if (!hasNextPage) return;
    loadShopifyPage(currentPage + 1, searchTerm);
  };

  const handlePreviousPage = () => {
    if (currentPage <= 1) return;
    loadShopifyPage(currentPage - 1, searchTerm);
  };

  const handleMongoPageChange = (newPage) => {
    loadMongoPage(newPage, searchTerm);
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError("");
      await syncDeadStockData(activeShop);
      const data = await fetchDeadStockSummary(activeShop);
      if (data) setSummary(data);
      resetAndLoad(searchTerm, showStoreProducts);
    } catch (err) {
      setError(err.message || "Failed to sync data.");
    } finally {
      setSyncing(false);
    }
  };

  const handleModeChange = (newShowStore) => {
    setShowStoreProducts(newShowStore);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Product Selection Handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleSelectProduct = (item, isSelecting) => {
    const resolvedId =
      item.shopifyVariantId || item.variantId || item.id || "";

    if (!resolvedId) return;

    if (isSelecting) {
      setSelectedProducts((prev) => {
        if (prev.some((p) => p.id === resolvedId)) return prev;
        return [
          ...prev,
          {
            id: resolvedId,
            productId: item.shopifyProductId || item.productId || item.id,
            variantId: resolvedId,
            title: item.title,
            sku: item.sku,
          },
        ];
      });
    } else {
      setSelectedProducts((prev) =>
        prev.filter((p) => p.id !== resolvedId && p.variantId !== resolvedId)
      );
    }
  };

  const handleSelectAll = (isSelecting) => {
    if (isSelecting) {
      const pageItems = products.map((item) => {
        const resolvedId =
          item.shopifyVariantId || item.variantId || item.id || "";
        return {
          id: resolvedId,
          productId: item.shopifyProductId || item.productId || item.id,
          variantId: resolvedId,
          title: item.title,
          sku: item.sku,
        };
      });

      setSelectedProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newAdditions = pageItems.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newAdditions];
      });
    } else {
      const pageIds = new Set(
        products.map(
          (item) => item.shopifyVariantId || item.variantId || item.id || ""
        )
      );
      setSelectedProducts((prev) => prev.filter((p) => !pageIds.has(p.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedProducts([]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Bulk Sale Validation & Submission
  // ─────────────────────────────────────────────────────────────────────────
  const todayDateValue = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  };

  const validateBulkField = (field, value) => {
    let msg = "";
    if (field === "discount") {
      const d = Number(value);
      if (!Number.isFinite(d) || d <= 0 || d > 100) {
        msg = "Discount must be between 1% and 100%.";
      }
    }
    if (field === "duration") {
      const dur = Number(value);
      if (!Number.isFinite(dur) || dur <= 0) {
        msg = "Duration must be greater than 0 days.";
      }
    }
    if (field === "startDate") {
      if (!value) {
        msg = "Start date is required.";
      } else if (value < todayDateValue()) {
        msg = "Start date cannot be in the past.";
      }
    }
    setBulkErrors((prev) => ({ ...prev, [field]: msg }));
    return msg;
  };

  const handleBulkSaleSubmit = async () => {
    if (isSubmittingBulk) return;

    const errDisc = validateBulkField("discount", bulkDiscount);
    const errDur = validateBulkField("duration", bulkDuration);
    const errDate = validateBulkField("startDate", bulkStartDate);

    if (errDisc || errDur || errDate) return;

    if (selectedProducts.length === 0) {
      setBulkModalError("Please select at least one product.");
      return;
    }

    try {
      setIsSubmittingBulk(true);
      setBulkModalError("");

      const variantIds = selectedProducts
        .map((p) => p.variantId || p.id)
        .filter(Boolean);
      const productIds = selectedProducts
        .map((p) => p.productId)
        .filter(Boolean);

      const res = await executeBulkSale(activeShop, {
        shop: activeShop,
        variantIds,
        productIds,
        discountPercent: Number(bulkDiscount),
        durationDays: Number(bulkDuration),
        startDate: bulkStartDate,
      });

      if (!res.success) {
        throw new Error(res.message || "Failed to create bulk clearance sale.");
      }

      setIsBulkModalOpen(false);
      setBulkSuccessMessage(
        `✓ Bulk Sale Created Successfully! ${selectedProducts.length} products are now included in the ${bulkDiscount}% clearance sale.`
      );
      setSelectedProducts([]);
      // Refresh current page
      resetAndLoad(searchTerm, showStoreProducts);
    } catch (err) {
      setBulkModalError(err.message || "Failed to create bulk sale.");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  return (
    <Page
      fullWidth
      title="Dead Stock"
      subtitle="SKUs that haven't sold in 60+ days and are tying up your cash."
  
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError("")}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {bulkSuccessMessage && (
          <Layout.Section>
            <Banner
              tone="success"
              onDismiss={() => setBulkSuccessMessage("")}
            >
              <p>{bulkSuccessMessage}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Dead-stock summary */}
        <Layout.Section>
          <DeadStockSummary summary={summary} products={products} />
        </Layout.Section>

        {/* Bulk Action Bar when items are selected */}
        {selectedProducts.length > 0 && (
          <Layout.Section>
            <Banner tone="info">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingSm" as="p">
                  {selectedProducts.length}{" "}
                  {selectedProducts.length === 1 ? "product" : "products"}{" "}
                  selected
                </Text>
                <InlineStack gap="200">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setBulkModalError("");
                      setIsBulkModalOpen(true);
                    }}
                  >
                    Bulk Sale
                  </Button>
                  <Button onClick={handleClearSelection}>                      
                    Clear Selection
                  </Button>
                </InlineStack>
              </InlineStack>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <DeadStockFilters
                location={location}
                setLocation={setLocation}
                collection={collection}
                setCollection={setCollection}
                days={days}
                setDays={setDays}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showStoreProducts={showStoreProducts}
                setShowStoreProducts={handleModeChange}
                onApply={handleApplyFilters}
                onCollectionBulkSale={() => setCollectionBulkSaleOpen(true)}
              />

              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <Spinner accessibilityLabel="Loading products" size="large" />
                </div>
              ) : products.length > 0 ? (
                <>
                  {/* Mode label */}
                  <Text variant="bodySm" tone="subdued">
                    {showStoreProducts
                      ? `Showing ${products.length} products from Shopify — Page ${currentPage}`
                      : `Showing ${products.length} dead stock items — Page ${mongoPage}`}
                  </Text>

                  <DeadStockTable
                    products={products}
                    selectedProducts={selectedProducts}
                    onSelectProduct={handleSelectProduct}
                    onSelectAll={handleSelectAll}
                  />

                  {/* Cursor-based pagination for Shopify mode */}
                  {showStoreProducts && (
                    <DeadStockPagination
                      mode="cursor"
                      currentPage={currentPage}
                      hasNextPage={hasNextPage}
                      hasPreviousPage={hasPreviousPage}
                      onNext={handleNextPage}
                      onPrevious={handlePreviousPage}
                      pageSize={DEFAULT_LIMIT}
                      resultCount={products.length}
                    />
                  )}

                  {/* Offset-based pagination for MongoDB dead-stock mode */}
                  {!showStoreProducts && (
                    <DeadStockPagination
                      mode="offset"
                      pagination={mongoPagination}
                      onPageChange={handleMongoPageChange}
                    />
                  )}
                </>
              ) : (
                <Banner tone="success" title="No Dead Stock 🎉">
                  <p>
                    Great news — none of your products have been unsold for
                    60+ days.
                  </p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Bulk Clearance Sale Modal */}
      {isBulkModalOpen && (
        <Modal
          open
          onClose={() => setIsBulkModalOpen(false)}
          title="Bulk Clearance Sale"
          primaryAction={{
            content: "Create Sale",
            onAction: handleBulkSaleSubmit,
            loading: isSubmittingBulk,
            disabled:
              isSubmittingBulk ||
              Boolean(bulkErrors.discount) ||
              Boolean(bulkErrors.duration) ||
              Boolean(bulkErrors.startDate),
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsBulkModalOpen(false),
              disabled: isSubmittingBulk,
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              {bulkModalError && (
                <Banner tone="critical">
                  <p>{bulkModalError}</p>
                </Banner>
              )}

              <TextField
                label="Selected Products"
                value={`${selectedProducts.length} ${selectedProducts.length === 1 ? "product" : "products"} selected`}
                disabled
                autoComplete="off"
              />

              <Select
                label="Discount"
                options={[
                  { label: "10%", value: "10" },
                  { label: "15%", value: "15" },
                  { label: "20%", value: "20" },
                  { label: "25%", value: "25" },
                  { label: "30%", value: "30" },
                  { label: "Custom", value: "custom" },
                ]}
                value={
                  ["10", "15", "20", "25", "30"].includes(bulkDiscount)
                    ? bulkDiscount
                    : "custom"
                }
                onChange={(val) => {
                  const nextVal = val === "custom" ? "" : val;
                  setBulkDiscount(nextVal);
                  validateBulkField("discount", nextVal);
                }}
                error={bulkErrors.discount}
              />

              {!["10", "15", "20", "25", "30"].includes(bulkDiscount) && (
                <TextField
                  label="Custom discount (%)"
                  type="number"
                  value={bulkDiscount}
                  onChange={(val) => {
                    setBulkDiscount(val);
                    validateBulkField("discount", val);
                  }}
                  onBlur={() => validateBulkField("discount", bulkDiscount)}
                  error={bulkErrors.discount}
                  autoComplete="off"
                />
              )}

              <Select
                label="Duration"
                options={[
                  { label: "7 days", value: "7" },
                  { label: "14 days", value: "14" },
                  { label: "30 days", value: "30" },
                  { label: "Custom", value: "custom" },
                ]}
                value={
                  ["7", "14", "30"].includes(bulkDuration)
                    ? bulkDuration
                    : "custom"
                }
                onChange={(val) => {
                  const nextVal = val === "custom" ? "" : val;
                  setBulkDuration(nextVal);
                  validateBulkField("duration", nextVal);
                }}
                error={bulkErrors.duration}
              />

              {!["7", "14", "30"].includes(bulkDuration) && (
                <TextField
                  label="Custom duration (days)"
                  type="number"
                  value={bulkDuration}
                  onChange={(val) => {
                    setBulkDuration(val);
                    validateBulkField("duration", val);
                  }}
                  onBlur={() => validateBulkField("duration", bulkDuration)}
                  error={bulkErrors.duration}
                  autoComplete="off"
                />
              )}

              <TextField
                label="Start date"
                type="date"
                min={todayDateValue()}
                value={bulkStartDate}
                onChange={(val) => {
                  setBulkStartDate(val);
                  validateBulkField("startDate", val);
                }}
                onBlur={() => validateBulkField("startDate", bulkStartDate)}
                error={bulkErrors.startDate}
                autoComplete="off"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}

      {/* Collection Bulk Sale Modal */}
      <CollectionBulkSaleModal
        open={collectionBulkSaleOpen}
        onClose={() => setCollectionBulkSaleOpen(false)}
        onSuccess={(data) => {
          // show success banner and refresh data
          setBulkSuccessMessage(
            `✓ Collection Sale Created: ${data?.collectionTitle || ''} — ${data?.discount || ''}%`
          );
          // refresh current page
          resetAndLoad(searchTerm, showStoreProducts);
          setCollectionBulkSaleOpen(false);
        }}
      />
    </Page>
  );
}
