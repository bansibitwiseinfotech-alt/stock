import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Select,
  TextField,
  Divider,
  Banner,
  Thumbnail,
  Spinner,
  IndexTable,
  Modal,
  Box,
} from "@shopify/polaris";
import {
  createDeadStockBundle,
  fetchDeadStockBundles,
  deleteDeadStockBundle,
} from "../../services/deadStockBundleApi";
import { fetchStoreProducts } from "../../services/deadStockApi";

/**
 * Normalizes ID strings to avoid GID vs numeric comparison issues.
 */
function normalizeId(id) {
  if (!id) return ""; 
  const str = String(id).trim();
  const numeric = str.replace(/\D/g, "");
  return numeric || str;
}

export default function BogoBundleSection({ shopDomain = "" }) {
  const activeShop =
    shopDomain ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop")
      : "") ||
    "";

  // Form states
  const [buyProduct, setBuyProduct] = useState(null);
  const [getProduct, setGetProduct] = useState(null);
  const [offerType] = useState("BOGO");
  const [bundleName, setBundleName] = useState("");
  const [isNameEdited, setIsNameEdited] = useState(false);

  // Status & error states
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Product Picker state
  const [activePickerTarget, setActivePickerTarget] = useState(null); // 'BUY' | 'GET' | null
  const [searchTerm, setSearchTerm] = useState("");
  const [storeProducts, setStoreProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pickerError, setPickerError] = useState("");

  // BOGO Bundles list state
  const [bogoBundles, setBogoBundles] = useState([]);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-generate bundle name
  useEffect(() => {
    if (!isNameEdited) {
      if (buyProduct && getProduct) {
        setBundleName(`${buyProduct.title} + ${getProduct.title} BOGO`);
      } else if (buyProduct) {
        setBundleName(`${buyProduct.title} BOGO`);
      } else {
        setBundleName("");
      }
    }
  }, [buyProduct, getProduct, isNameEdited]);

  // Load store products for picker
  const loadProducts = useCallback(
    async (query = "") => {
      try {
        setLoadingProducts(true);
        setPickerError("");
        const res = await fetchStoreProducts({
          shop: activeShop,
          search: query,
          limit: 50,
        });
        if (res && Array.isArray(res.data)) {
          setStoreProducts(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
        setPickerError("Unable to load products. Please try again.");
      } finally {
        setLoadingProducts(false);
      }
    },
    [activeShop]
  );

  // Load existing BOGO bundles
  const loadBogoBundles = useCallback(async () => {
    if (!activeShop) return;
    try {
      setLoadingBundles(true);
      const data = await fetchDeadStockBundles(activeShop);
      setBogoBundles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load BOGO bundles:", err);
    } finally {
      setLoadingBundles(false);
    }
  }, [activeShop]);

  useEffect(() => {
    loadBogoBundles();
  }, [loadBogoBundles]);

  // Handle open picker
  const handleOpenPicker = (target) => {
    setError("");
    setPickerError("");
    setActivePickerTarget(target);
    if (storeProducts.length === 0) {
      loadProducts("");
    }
  };

  // Handle product selection in picker
  const handleSelectProduct = (product) => {
    const candidateId = normalizeId(product.id || product.productId);

    if (activePickerTarget === "BUY") {
      if (getProduct && normalizeId(getProduct.id || getProduct.productId) === candidateId) {
        setPickerError("Buy Product and Get Product must be different.");
        return;
      }
      setBuyProduct(product);
    } else if (activePickerTarget === "GET") {
      if (buyProduct && normalizeId(buyProduct.id || buyProduct.productId) === candidateId) {
        setPickerError("Buy Product and Get Product must be different.");
        return;
      }
      setGetProduct(product);
    }

    setActivePickerTarget(null);
    setSearchTerm("");
    setPickerError("");
    setError("");
  };

  // Validate form
  const validateForm = () => {
    if (!buyProduct) {
      setError("Please select a Buy Product.");
      return false;
    }
    if (!getProduct) {
      setError("Please select a Get Product.");
      return false;
    }
    if (
      normalizeId(buyProduct.id || buyProduct.productId) ===
      normalizeId(getProduct.id || getProduct.productId)
    ) {
      setError("Buy Product and Get Product must be different.");
      return false;
    }
    if (!bundleName || !bundleName.trim()) {
      setError("Bundle name is required.");
      return false;
    }
    return true;
  };

  // Create BOGO Bundle
  const handleCreateBogo = async () => {
    if (!validateForm()) return;

    try {
      setCreating(true);
      setError("");
      setSuccessMessage("");

      const formatItem = (item, role) => {
        const rawId = item.id || item.productId || "";
        const rawVarId = item.variantId || item.shopifyVariantId || null;
        return {
          productId: String(rawId).startsWith("gid://shopify/Product/")
            ? String(rawId)
            : `gid://shopify/Product/${normalizeId(rawId) || rawId}`,
          variantId: rawVarId
            ? String(rawVarId).startsWith("gid://shopify/ProductVariant/")
              ? String(rawVarId)
              : `gid://shopify/ProductVariant/${normalizeId(rawVarId) || rawVarId}`
            : null,
          title: item.title,
          handle: item.handle || "",
          image: item.image || null,
          role,
        };
      };

      const payload = {
        shop: activeShop,
        bundleName: bundleName.trim(),
        offerType: "BOGO",
        products: [
          formatItem(buyProduct, "BUY"),
          formatItem(getProduct, "GET_FREE"),
        ],
      };

      await createDeadStockBundle(payload, activeShop);

      setSuccessMessage("BOGO bundle created successfully.");
      setBuyProduct(null);
      setGetProduct(null);
      setBundleName("");
      setIsNameEdited(false);

      // Refresh list
      await loadBogoBundles();

      try {
        if (typeof window !== "undefined" && window.shopify?.toast?.show) {
          window.shopify.toast.show("BOGO bundle created successfully.");
        }
      } catch {}
    } catch (err) {
      console.error("Create BOGO error:", err);
      setError(err.message || "Unable to create BOGO bundle.");
    } finally {
      setCreating(false);
    }
  };

  // Delete BOGO Bundle
  const handleDeleteBogo = async () => {
    if (!bundleToDelete) return;
    try {
      setDeleting(true);
      await deleteDeadStockBundle(bundleToDelete.id || bundleToDelete._id, activeShop);
      setBundleToDelete(null);
      await loadBogoBundles();
      try {
        if (typeof window !== "undefined" && window.shopify?.toast?.show) {
          window.shopify.toast.show("BOGO bundle deleted successfully.");
        }
      } catch {}
    } catch (err) {
      alert(err.message || "Failed to delete BOGO bundle.");
    } finally {
      setDeleting(false);
    }
  };

  // Filter products in picker
  const filteredProducts = useMemo(() => {
    const excludedId =
      activePickerTarget === "BUY"
        ? normalizeId(getProduct?.id || getProduct?.productId)
        : normalizeId(buyProduct?.id || buyProduct?.productId);

    return storeProducts.filter((p) => {
      const pId = normalizeId(p.id || p.productId);
      if (excludedId && pId === excludedId) return false;
      if (!searchTerm) return true;
      return (p.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [storeProducts, activePickerTarget, buyProduct, getProduct, searchTerm]);

  const resourceName = { singular: "BOGO bundle", plural: "BOGO bundles" };

  return (
    <BlockStack gap="500">
      {/* ── BOGO Bundle Creation Card ────────────────────────────────────── */}
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text variant="headingMd" as="h2">
              BOGO Bundle
            </Text>
            <Text tone="subdued" as="p">
              Create a Buy One Get One offer using products from your store.
            </Text>
          </BlockStack>

          {/* Feedback alerts */}
          {error && (
            <Banner tone="critical" onDismiss={() => setError("")}>
              <p>{error}</p>
            </Banner>
          )}

          {successMessage && (
            <Banner tone="success" onDismiss={() => setSuccessMessage("")}>
              <p>{successMessage}</p>
            </Banner>
          )}

          {/* Configuration Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Buy Product */}
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#F8FAFC",
              }}
            >
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">
                    Buy Product
                  </Text>
                  <Badge tone="info">BUY</Badge>
                </InlineStack>

                {buyProduct ? (
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Thumbnail
                        source={buyProduct.image || ""}
                        alt={buyProduct.title}
                        size="medium"
                      />
                      <div>
                        <Text variant="bodyMd" fontWeight="bold" as="div">
                          {buyProduct.title}
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="span">
                          Stock: {buyProduct.stock ?? buyProduct.currentStock ?? 0}
                        </Text>
                      </div>
                    </InlineStack>
                    <Button
                      size="slim"
                      onClick={() => handleOpenPicker("BUY")}
                    >
                      Change
                    </Button>
                  </InlineStack>
                ) : (
                  <Button
                    onClick={() => handleOpenPicker("BUY")}
                    fullWidth
                  >
                    Select Buy Product
                  </Button>
                )}
              </BlockStack>
            </div>

            {/* Get Product */}
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#F8FAFC",
              }}
            >
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">
                    Get Product
                  </Text>
                  <Badge tone="success">GET FREE</Badge>
                </InlineStack>

                {getProduct ? (
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Thumbnail
                        source={getProduct.image || ""}
                        alt={getProduct.title}
                        size="medium"
                      />
                      <div>
                        <Text variant="bodyMd" fontWeight="bold" as="div">
                          {getProduct.title}
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="span">
                          Stock: {getProduct.stock ?? getProduct.currentStock ?? 0}
                        </Text>
                      </div>
                    </InlineStack>
                    <Button
                      size="slim"
                      onClick={() => handleOpenPicker("GET")}
                    >
                      Change
                    </Button>
                  </InlineStack>
                ) : (
                  <Button
                    onClick={() => handleOpenPicker("GET")}
                    fullWidth
                  >
                    Select Get Product
                  </Button>
                )}
              </BlockStack>
            </div>
          </div>

          {/* Offer Type & Bundle Name */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            <Select
              label="Offer Type"
              options={[{ label: "Buy 1 Get 1 (BOGO)", value: "BOGO" }]}
              value={offerType}
              disabled
              helpText="Customer buys 1 product and gets the second product free."
            />

            <TextField
              label="Bundle Name"
              placeholder="e.g. Product A + Product B BOGO"
              value={bundleName}
              onChange={(val) => {
                setBundleName(val);
                setIsNameEdited(true);
              }}
              autoComplete="off"
              helpText="Display name for this BOGO offer."
            />
          </div>

          <Divider />

          <InlineStack align="end">
            <Button
              variant="primary"
              loading={creating}
              disabled={creating || !buyProduct || !getProduct}
              onClick={handleCreateBogo}
            >
              Create BOGO Bundle
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* ── Existing BOGO Bundles Table ─────────────────────────────────── */}
      <Card padding="0">
        <Box padding="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="050">
              <Text variant="headingMd" as="h3">
                BOGO Bundles
              </Text>
              <Text tone="subdued" variant="bodySm" as="p">
                Active Buy One Get One offers on your store.
              </Text>
            </BlockStack>
            <Button size="slim" onClick={loadBogoBundles} loading={loadingBundles}>
              Refresh
            </Button>
          </InlineStack>
        </Box>

        {loadingBundles && bogoBundles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Spinner size="large" />
          </div>
        ) : bogoBundles.length === 0 ? (
          <Box padding="600">
            <Text tone="subdued" alignment="center" as="p">
              No BOGO bundles created yet. Use the form above to create your first offer.
            </Text>
          </Box>
        ) : (
          <IndexTable
            resourceName={resourceName}
            itemCount={bogoBundles.length}
            headings={[
              { title: "BUY PRODUCT" },
              { title: "GET PRODUCT" },
              { title: "STATUS" },
              { title: "ACTIONS" },
            ]}
            selectable={false}
          >
            {bogoBundles.map((bundle, index) => {
              const buyItem = bundle.products?.find((p) => p.role === "BUY");
              const freeItems =
                bundle.products?.filter((p) => p.role === "GET_FREE") || [];

              return (
                <IndexTable.Row
                  id={bundle.id || bundle._id}
                  key={bundle.id || bundle._id}
                  position={index}
                >
                  <IndexTable.Cell>
                    <InlineStack gap="300" blockAlign="center">
                      <Thumbnail
                        source={buyItem?.image || ""}
                        alt={buyItem?.title || "Buy Product"}
                        size="small"
                      />
                      <div>
                        <Text variant="bodyMd" fontWeight="bold" as="div">
                          {buyItem?.title || bundle.bundleName || "Buy Product"}
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="span">
                          Role: BUY
                        </Text>
                      </div>
                    </InlineStack>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <BlockStack gap="100">
                      {freeItems.map((freeItem, fIdx) => (
                        <InlineStack
                          key={fIdx}
                          gap="200"
                          blockAlign="center"
                        >
                          <Thumbnail
                            source={freeItem.image || ""}
                            alt={freeItem.title || "Free Product"}
                            size="extraSmall"
                          />
                          <Text variant="bodySm" as="span">
                            {freeItem.title}
                          </Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <Badge
                      tone={
                        bundle.status === "ACTIVE"
                          ? "success"
                          : bundle.status === "DRAFT"
                          ? "info"
                          : "subdued"
                      }
                    >
                      {bundle.status === "ACTIVE"
                        ? "Active"
                        : bundle.status === "DRAFT"
                        ? "Draft"
                        : bundle.status}
                    </Badge>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <Button
                      size="slim"
                      tone="critical"
                      variant="plain"
                      onClick={() => setBundleToDelete(bundle)}
                    >
                      Delete
                    </Button>
                  </IndexTable.Cell>
                </IndexTable.Row>
              );
            })}
          </IndexTable>
        )}
      </Card>

      {/* ── Product Picker Modal ────────────────────────────────────────── */}
      {activePickerTarget && (
        <Modal
          open={Boolean(activePickerTarget)}
          onClose={() => {
            setActivePickerTarget(null);
            setSearchTerm("");
            setPickerError("");
          }}
          title={
            activePickerTarget === "BUY"
              ? "Select Buy Product"
              : "Select Get Product (Free)"
          }
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => {
                setActivePickerTarget(null);
                setSearchTerm("");
                setPickerError("");
              },
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {pickerError && (
                <Banner tone="critical" onDismiss={() => setPickerError("")}>
                  <p>{pickerError}</p>
                </Banner>
              )}

              <TextField
                placeholder="Search products by title..."
                value={searchTerm}
                onChange={(val) => {
                  setSearchTerm(val);
                  loadProducts(val);
                }}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => {
                  setSearchTerm("");
                  loadProducts("");
                }}
              />

              {loadingProducts ? (
                <div style={{ textAlign: "center", padding: "40px" }}>
                  <Spinner size="large" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <Text tone="subdued" alignment="center" as="p">
                  No available products found.
                </Text>
              ) : (
                <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                  <BlockStack gap="200">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id || p.productId}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: "1px solid #E2E8F0",
                          backgroundColor: "#FFFFFF",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <InlineStack gap="300" blockAlign="center">
                          <Thumbnail
                            source={p.image || ""}
                            alt={p.title}
                            size="small"
                          />
                          <div>
                            <Text variant="bodyMd" fontWeight="semibold" as="div">
                              {p.title}
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="span">
                              Stock: {p.stock ?? p.currentStock ?? 0}
                            </Text>
                          </div>
                        </InlineStack>
                        <Button
                          size="slim"
                          variant="primary"
                          onClick={() => handleSelectProduct(p)}
                        >
                          Select
                        </Button>
                      </div>
                    ))}
                  </BlockStack>
                </div>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────────────── */}
      {bundleToDelete && (
        <Modal
          open={Boolean(bundleToDelete)}
          onClose={() => !deleting && setBundleToDelete(null)}
          title="Delete BOGO Bundle"
          primaryAction={{
            content: deleting ? "Deleting..." : "Delete Bundle",
            destructive: true,
            onAction: handleDeleteBogo,
            loading: deleting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setBundleToDelete(null),
              disabled: deleting,
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete the bundle "
              {bundleToDelete.bundleName || "BOGO Bundle"}"? This action cannot be undone.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </BlockStack>
  );
}
