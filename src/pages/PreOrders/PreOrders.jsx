import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Page,
  Card,
  Tabs,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Badge,
  TextField,
  Button,
  Banner,
  Spinner,
  Pagination,
  IndexTable,
  Divider,
  Thumbnail,
  Modal,
  Select,
  Checkbox,
  EmptyState,
} from "@shopify/polaris";
import { useSearchParams } from "react-router";
import {
  fetchPreOrdersApi,
  syncPreOrdersApi,
  updatePreOrderStatusApi,
  deletePreOrderApi,
  fetchLaunchPreOrdersApi,
  saveLaunchPreOrderApi,
  toggleLaunchPreOrderApi,
  deleteLaunchPreOrderApi,
  fetchLaunchStoreProductsApi,
} from "../../services/appApi";

function ColorPickerField({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>{label}</label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 8px",
          border: "1px solid #CBD5E1",
          borderRadius: "8px",
          background: "#FFFFFF",
        }}
      >
        <input
          type="color"
          value={value || "#FFFFFF"}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "30px",
            height: "30px",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            cursor: "pointer",
            padding: 0,
            background: "none",
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#FFFFFF"
          style={{
            border: "none",
            outline: "none",
            fontSize: "12px",
            fontFamily: "monospace",
            color: "#0F172A",
            width: "100%",
            textTransform: "uppercase",
          }}
        />
      </div>
    </div>
  );
}

const DEFAULT_CONFIG_FORM = {
  productId: "",
  productTitle: "",
  productHandle: "",
  productImage: "",
  preOrderEnabled: true,
  launchDate: "",
  preOrderOpensAt: "",
  shippingDate: "",
  badgeText: "🛒 PRE-ORDER",
  launchLabel: "NEW LAUNCH",
  launchTitle: "New Product Launch",
  customerMessage: "Be the first to get the new product.",
  launchDetails: "",
  buttonText: "PRE-ORDER NOW",
  depositPercentage: 50,
  depositAmount: 0,
  depositEnabled: true,
  cardBackgroundColor: "#FFFFFF",
  textColor: "#111827",
  accentColor: "#4F46E5",
  borderColor: "#E2E8F0",
  badgeBackgroundColor: "#0F172A",
  badgeTextColor: "#FFFFFF",
};

export default function PreOrders({ shopDomain } = {}) {
  const [searchParams] = useSearchParams();
  const shop = shopDomain || searchParams.get("shop") || "";

  // Main Page Section: 0 = Product Launches, 1 = Customer Orders
  const [mainView, setMainView] = useState(0);

  // ----------------------------------------------------
  // LAUNCH PRE-ORDERS STATE
  // ----------------------------------------------------
  const [launchConfigs, setLaunchConfigs] = useState([]);
  const [launchMetrics, setLaunchMetrics] = useState({ total: 0, active: 0, scheduled: 0 });
  const [launchLoading, setLaunchLoading] = useState(true);
  const [launchSearch, setLaunchSearch] = useState("");
  const [launchStatusFilter, setLaunchStatusFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("CREATE"); // CREATE or EDIT
  const [configForm, setConfigForm] = useState(DEFAULT_CONFIG_FORM);
  const [savingLaunch, setSavingLaunch] = useState(false);

  // Store Products Picker inside modal
  const [storeProducts, setStoreProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);

  // ----------------------------------------------------
  // CUSTOMER PRE-ORDERS STATE
  // ----------------------------------------------------
  const [selectedOrderTab, setSelectedOrderTab] = useState(0);
  const [preOrders, setPreOrders] = useState([]);
  const [metrics, setMetrics] = useState({
    totalPreOrders: 0,
    pendingPreOrders: 0,
    fulfilledPreOrders: 0,
    totalUnits: 0,
    totalRevenue: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [notice, setNotice] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    confirmAction: null,
    confirmTone: "primary",
    confirmLabel: "Confirm",
  });

  // ====================================================
  // LOAD LAUNCH CONFIGURATIONS
  // ====================================================
  const loadLaunchConfigs = useCallback(async () => {
    try {
      setLaunchLoading(true);
      const res = await fetchLaunchPreOrdersApi(shop);
      if (res?.success) {
        setLaunchConfigs(res.data || []);
        if (res.metrics) setLaunchMetrics(res.metrics);
      }
    } catch (err) {
      console.error("Failed to load launch configs:", err);
      setNotice({
        tone: "critical",
        message: "Unable to load launch pre-order configurations.",
      });
    } finally {
      setLaunchLoading(false);
    }
  }, [shop]);

  // ====================================================
  // LOAD STORE PRODUCTS FOR PICKER
  // ====================================================
  const loadStoreProducts = useCallback(async (query = "") => {
    try {
      setProductsLoading(true);
      const res = await fetchLaunchStoreProductsApi(shop, query);
      if (res?.success) {
        setStoreProducts(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load store products:", err);
    } finally {
      setProductsLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    if (shop) {
      loadLaunchConfigs();
    }
  }, [shop, loadLaunchConfigs]);

  // ====================================================
  // LOAD CUSTOMER PRE-ORDERS
  // ====================================================
  const orderTabs = [
    { id: "ALL", content: `All (${metrics.totalPreOrders || 0})` },
    { id: "PENDING", content: `Pending (${metrics.pendingPreOrders || 0})` },
    { id: "PROCESSING", content: "Processing" },
    {
      id: "FULFILLED",
      content: `Fulfilled (${metrics.fulfilledPreOrders || 0})`,
    },
    { id: "CANCELLED", content: "Cancelled" },
  ];

  const currentOrderStatus = orderTabs[selectedOrderTab]?.id || "ALL";

  const loadPreOrders = useCallback(
    async (page = 1) => {
      try {
        setOrdersLoading(true);
        const res = await fetchPreOrdersApi({
          shop,
          status: currentOrderStatus,
          search: orderSearchQuery,
          page,
          limit: 20,
        });

        if (res?.success) {
          setPreOrders(res.data || []);
          if (res.metrics) setMetrics(res.metrics);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (err) {
        console.error("Failed to load pre-orders:", err);
      } finally {
        setOrdersLoading(false);
      }
    },
    [shop, currentOrderStatus, orderSearchQuery]
  );

  useEffect(() => {
    if (shop && mainView === 1) {
      loadPreOrders(1);
    }
  }, [shop, mainView, loadPreOrders]);

  // ====================================================
  // LAUNCH HANDLERS
  // ====================================================
  const handleOpenCreateModal = () => {
    setModalMode("CREATE");
    setConfigForm({
      ...DEFAULT_CONFIG_FORM,
      launchDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });
    setProductSearch("");
    setProductDropdownOpen(false);
    loadStoreProducts("");
    setModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setModalMode("EDIT");
    setConfigForm({
      productId: item.productId,
      productTitle: item.productTitle || "",
      productHandle: item.productHandle || "",
      productImage: item.productImage || "",
      preOrderEnabled: Boolean(item.preOrderEnabled),
      launchDate: item.launchDate ? new Date(item.launchDate).toISOString().split("T")[0] : "",
      preOrderOpensAt: item.preOrderOpensAt ? new Date(item.preOrderOpensAt).toISOString().split("T")[0] : "",
      shippingDate: item.shippingDate ? new Date(item.shippingDate).toISOString().split("T")[0] : "",
      badgeText: item.badgeText || "🛒 PRE-ORDER",
      launchLabel: item.launchLabel || "NEW LAUNCH",
      launchTitle: item.launchTitle || "New Product Launch",
      customerMessage: item.customerMessage || "",
      launchDetails: item.launchDetails || "",
      buttonText: item.buttonText || "PRE-ORDER NOW",
      depositPercentage: typeof item.depositPercentage === "number" ? item.depositPercentage : 50,
      depositAmount: typeof item.depositAmount === "number" ? item.depositAmount : 0,
      depositEnabled: item.depositEnabled !== false,
      cardBackgroundColor: item.cardBackgroundColor || "#FFFFFF",
      textColor: item.textColor || "#111827",
      accentColor: item.accentColor || "#4F46E5",
      borderColor: item.borderColor || "#E2E8F0",
      badgeBackgroundColor: item.badgeBackgroundColor || "#0F172A",
      badgeTextColor: item.badgeTextColor || "#FFFFFF",
    });
    setProductSearch("");
    setProductDropdownOpen(false);
    setModalOpen(true);
  };

  const handleSelectProduct = (product) => {
    setConfigForm((prev) => ({
      ...prev,
      productId: product.id,
      productTitle: product.title,
      productHandle: product.handle,
      productImage: product.image || "",
    }));
    setProductDropdownOpen(false);
  };

  const handleSaveLaunchConfig = async () => {
    if (!configForm.productId) {
      setNotice({ tone: "critical", message: "Please select a product to launch." });
      return;
    }
    if (!configForm.launchDate) {
      setNotice({ tone: "critical", message: "Please specify a valid Launch Date." });
      return;
    }

    try {
      setSavingLaunch(true);
      const res = await saveLaunchPreOrderApi(shop, configForm);
      if (res?.success) {
        setNotice({
          tone: "success",
          message: `✓ Launch pre-order for "${configForm.productTitle || "Product"}" saved successfully!`,
        });
        setModalOpen(false);
        loadLaunchConfigs();
      }
    } catch (err) {
      setNotice({ tone: "critical", message: err.message || "Failed to save launch pre-order." });
    } finally {
      setSavingLaunch(false);
    }
  };

  const handleToggleLaunch = async (productId, currentVal) => {
    try {
      setActionLoadingId(productId);
      await toggleLaunchPreOrderApi(shop, productId, !currentVal);
      setNotice({
        tone: "success",
        message: `✓ Launch pre-order ${!currentVal ? "enabled" : "disabled"}.`,
      });
      loadLaunchConfigs();
    } catch (err) {
      setNotice({ tone: "critical", message: err.message || "Failed to toggle launch pre-order." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteLaunch = async (productId) => {
    try {
      setActionLoadingId(productId);
      await deleteLaunchPreOrderApi(shop, productId);
      setNotice({ tone: "success", message: "✓ Launch pre-order configuration deleted." });
      loadLaunchConfigs();
    } catch (err) {
      setNotice({ tone: "critical", message: err.message || "Failed to delete launch pre-order." });
    } finally {
      setActionLoadingId(null);
      setConfirmModal({ open: false });
    }
  };

  // Filtered launch items
  const filteredLaunchConfigs = useMemo(() => {
    return launchConfigs.filter((item) => {
      if (launchStatusFilter !== "ALL" && item.status !== launchStatusFilter) {
        return false;
      }
      if (launchSearch.trim()) {
        const q = launchSearch.toLowerCase();
        const titleMatch = (item.productTitle || "").toLowerCase().includes(q);
        const handleMatch = (item.productHandle || "").toLowerCase().includes(q);
        return titleMatch || handleMatch;
      }
      return true;
    });
  }, [launchConfigs, launchStatusFilter, launchSearch]);

  // ====================================================
  // CUSTOMER ORDER HANDLERS
  // ====================================================
  const handleSyncShopify = async () => {
    try {
      setSyncing(true);
      await syncPreOrdersApi(shop);
      setNotice({
        tone: "success",
        message: `✓ Real Shopify pre-orders synced successfully!`,
      });
      loadPreOrders(pagination.page);
    } catch (err) {
      setNotice({
        tone: "critical",
        message: err.message || "Failed to sync orders from Shopify.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      setActionLoadingId(id);
      await updatePreOrderStatusApi(id, { status });
      setNotice({
        tone: "success",
        message: `✓ Pre-order status updated to ${status}.`,
      });
      loadPreOrders(pagination.page);
    } catch (err) {
      setNotice({
        tone: "critical",
        message: err.message || "Failed to update status.",
      });
    } finally {
      setActionLoadingId(null);
      setConfirmModal({ open: false });
    }
  };

  const handleDeletePreOrder = async (id) => {
    try {
      setActionLoadingId(id);
      await deletePreOrderApi(id);
      setNotice({
        tone: "success",
        message: "✓ Pre-order record removed.",
      });
      loadPreOrders(pagination.page);
    } catch (err) {
      setNotice({
        tone: "critical",
        message: err.message || "Failed to delete pre-order.",
      });
    } finally {
      setActionLoadingId(null);
      setConfirmModal({ open: false });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount, currency = "USD") => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "USD",
      }).format(amount);
    } catch {
      return `$${Number(amount || 0).toFixed(2)}`;
    }
  };

  const getLaunchStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return <Badge tone="success">Active (Pre-Order Live)</Badge>;
      case "SCHEDULED":
        return <Badge tone="info">Scheduled (Opens Soon)</Badge>;
      case "LAUNCHED":
        return <Badge tone="subdued">Launched (Expired)</Badge>;
      case "DISABLED":
        return <Badge tone="attention">Disabled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Top Nav Tabs
  const topTabs = [
    { id: "LAUNCH", content: "🚀 New Product Launches" },
    { id: "ORDERS", content: `📦 Customer Pre-Orders (${metrics.totalPreOrders || 0})` },
  ];

  return (
    <Page
      fullWidth
      title="Pre-Orders"
      subtitle="Manage new upcoming product launches and track customer pre-orders placed through Shopify Checkout."
     
    >
      <BlockStack gap="500">
        {notice && (
          <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
            <p>{notice.message}</p>
          </Banner>
        )}

        {/* TOP LEVEL NAVIGATION TABS */}
        <Card padding="0">
          <Tabs tabs={topTabs} selected={mainView} onSelect={(idx) => setMainView(idx)} />
        </Card>

        {/* ================================================== */}
        {/* VIEW 0: NEW PRODUCT LAUNCHES                       */}
        {/* ================================================== */}
        {mainView === 0 && (
          <BlockStack gap="500">
            {/* METRICS ROW */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <Card padding="400">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    Active Launch Pre-Orders
                  </Text>
                  <Text variant="headingXl" as="h2" tone="success" fontWeight="bold">
                    {launchMetrics.active || 0}
                  </Text>
                </BlockStack>
              </Card>

              <Card padding="400">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    Scheduled Launches
                  </Text>
                  <Text variant="headingXl" as="h2" tone="info" fontWeight="bold">
                    {launchMetrics.scheduled || 0}
                  </Text>
                </BlockStack>
              </Card>

              <Card padding="400">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    Total Launch Products
                  </Text>
                  <Text variant="headingXl" as="h2" fontWeight="bold">
                    {launchMetrics.total || 0}
                  </Text>
                </BlockStack>
              </Card>
            </div>

            {/* LAUNCH PRODUCTS TABLE */}
            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center" gap="300">
                  <div style={{ flex: 1, maxWidth: 400 }}>
                    <TextField
                      placeholder="Search launch product..."
                      value={launchSearch}
                      onChange={(val) => setLaunchSearch(val)}
                      clearButton
                      onClearButtonClick={() => setLaunchSearch("")}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ width: 180 }}>
                    <Select
                      options={[
                        { label: "All Statuses", value: "ALL" },
                        { label: "Active Live", value: "ACTIVE" },
                        { label: "Scheduled", value: "SCHEDULED" },
                        { label: "Launched (Expired)", value: "LAUNCHED" },
                        { label: "Disabled", value: "DISABLED" },
                      ]}
                      value={launchStatusFilter}
                      onChange={(val) => setLaunchStatusFilter(val)}
                    />
                  </div>
                </InlineStack>
              </Box>

              <Divider />

              {launchLoading ? (
                <Box padding="800">
                  <InlineStack align="center">
                    <Spinner size="large" />
                  </InlineStack>
                </Box>
              ) : filteredLaunchConfigs.length === 0 ? (
                <Box padding="800">
                  <EmptyState
                    heading="No product launches configured"
                    action={{
                      content: "+ Configure New Launch Pre-Order",
                      onAction: handleOpenCreateModal,
                    }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      Set up upcoming product launch dates and dynamic storefront Pre-Order badges for your store's new products.
                    </p>
                  </EmptyState>
                </Box>
              ) : (
                <IndexTable
                  itemCount={filteredLaunchConfigs.length}
                  headings={[
                    { title: "Product" },
                    { title: "Launch Date" },
                    { title: "Shipping Starts" },
                    { title: "Badge & Button" },
                    { title: "Status" },
                    { title: "Actions", alignment: "end" },
                  ]}
                  selectable={false}
                >
                  {filteredLaunchConfigs.map((item, index) => {
                    const isToggling = actionLoadingId === item.productId;
                    return (
                      <IndexTable.Row id={item._id} key={item._id} position={index}>
                        {/* PRODUCT */}
                        <IndexTable.Cell>
                          <InlineStack gap="300" blockAlign="center">
                            {item.productImage ? (
                              <Thumbnail source={item.productImage} alt={item.productTitle} size="small" />
                            ) : (
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  background: "#EEF2F6",
                                  borderRadius: 6,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 18,
                                }}
                              >
                                🚀
                              </div>
                            )}
                            <BlockStack gap="050">
                              <Text variant="bodyMd" fontWeight="bold">
                                {item.productTitle || "Untitled Product"}
                              </Text>
                              <Text variant="bodyXs" tone="subdued">
                                ID: {item.productId}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </IndexTable.Cell>

                        {/* LAUNCH DATE */}
                        <IndexTable.Cell>
                          <Text variant="bodyMd" fontWeight="medium">
                            {formatDate(item.launchDate)}
                          </Text>
                        </IndexTable.Cell>

                        {/* SHIPPING DATE */}
                        <IndexTable.Cell>
                          <Text variant="bodyMd" tone="subdued">
                            {formatDate(item.shippingDate)}
                          </Text>
                        </IndexTable.Cell>

                        {/* BADGE & BUTTON */}
                        <IndexTable.Cell>
                          <InlineStack gap="150" blockAlign="center">
                            <span
                              style={{
                                background: "#0F172A",
                                color: "#FFF",
                                fontSize: 11,
                                fontWeight: "700",
                                padding: "2px 8px",
                                borderRadius: 12,
                              }}
                            >
                              {item.badgeText || "🛒 PRE-ORDER"}
                            </span>
                            <span
                              style={{
                                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                                color: "#FFF",
                                fontSize: 10,
                                fontWeight: "700",
                                padding: "2px 6px",
                                borderRadius: 12,
                              }}
                            >
                              {item.launchLabel || "NEW LAUNCH"}
                            </span>
                          </InlineStack>
                        </IndexTable.Cell>

                        {/* STATUS */}
                        <IndexTable.Cell>{getLaunchStatusBadge(item.status)}</IndexTable.Cell>

                        {/* ACTIONS */}
                        <IndexTable.Cell>
                          <InlineStack gap="150" align="end">
                            <Button
                              size="micro"
                              tone="critical"
                              onClick={() =>
                                setConfirmModal({
                                  open: true,
                                  title: `Delete Launch Pre-Order`,
                                  message: `Are you sure you want to remove the launch pre-order configuration for "${item.productTitle}"?`,
                                  confirmTone: "critical",
                                  confirmLabel: "Delete",
                                  confirmAction: () => handleDeleteLaunch(item.productId),
                                })
                              }
                            >
                              Delete
                            </Button>
                          </InlineStack>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    );
                  })}
                </IndexTable>
              )}
            </Card>
          </BlockStack>
        )}

        {/* ================================================== */}
        {/* VIEW 1: CUSTOMER PRE-ORDERS ORDERS                 */}
        {/* ================================================== */}
        {mainView === 1 && (
          <BlockStack gap="500">
            {/* 4 SUMMARY METRICS CARDS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <Card padding="400">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    Total Pre-Orders Placed
                  </Text>
                  <Text variant="headingXl" as="h2" fontWeight="bold">
                    {metrics.totalPreOrders || 0}
                  </Text>
                </BlockStack>
              </Card>

              <Card padding="400">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    Pending Fulfillment
                  </Text>
                  <Text variant="headingXl" as="h2" tone="caution" fontWeight="bold">
                    {metrics.pendingPreOrders || 0}
                  </Text>
                </BlockStack>
              </Card>

              <Card padding="400">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    Fulfilled Orders
                  </Text>
                  <Text variant="headingXl" as="h2" tone="success" fontWeight="bold">
                    {metrics.fulfilledPreOrders || 0}
                  </Text>
                </BlockStack>
              </Card>

              <Card padding="400">
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    Pre-Order Revenue
                  </Text>
                  <Text variant="headingXl" as="h2" tone="success" fontWeight="bold">
                    ${Number(metrics.totalRevenue || 0).toFixed(2)}
                  </Text>
                </BlockStack>
              </Card>
            </div>

            {/* MAIN ORDERS TABLE CARD */}
            <Card padding="0">
              <Tabs
                tabs={orderTabs}
                selected={selectedOrderTab}
                onSelect={(index) => setSelectedOrderTab(index)}
              />

              <Box padding="400">
                <TextField
                  placeholder="Search by order #, customer name, email, or product..."
                  value={orderSearchQuery}
                  onChange={(val) => setOrderSearchQuery(val)}
                  clearButton
                  onClearButtonClick={() => setOrderSearchQuery("")}
                  autoComplete="off"
                />
              </Box>

              <Divider />

              {ordersLoading ? (
                <Box padding="800">
                  <InlineStack align="center">
                    <Spinner size="large" />
                  </InlineStack>
                </Box>
              ) : preOrders.length === 0 ? (
                <Box padding="800">
                  <BlockStack align="center" inlineAlign="center" gap="200">
                    <div style={{ fontSize: 36 }}>🛒</div>
                    <Text variant="headingMd" as="h4">
                      No pre-orders found
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      {orderSearchQuery
                        ? "No real pre-orders match your search criteria."
                        : "When customers complete pre-orders at Shopify Checkout, they will automatically appear here."}
                    </Text>
                    <Button onClick={handleSyncShopify} loading={syncing}>
                      Sync Shopify Orders
                    </Button>
                  </BlockStack>
                </Box>
              ) : (
                <IndexTable
                  itemCount={preOrders.length}
                  headings={[
                    { title: "Order #" },
                    { title: "Product" },
                    { title: "Customer" },
                    { title: "Qty" },
                    { title: "Total" },
                    { title: "Payment" },
                    { title: "Fulfillment" },
                    { title: "Pre-Order Status" },
                    { title: "Actions", alignment: "end" },
                  ]}
                  selectable={false}
                >
                  {preOrders.map((item, index) => {
                    const displayOrderNum = item.shopifyOrderName || item.orderNumber || `#${item._id.slice(-4)}`;
                    return (
                      <IndexTable.Row id={item._id} key={item._id} position={index}>
                        <IndexTable.Cell>
                          <BlockStack gap="050">
                            {item.adminOrderUrl ? (
                              <a
                                href={item.adminOrderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#2C6ECB", textDecoration: "none", fontWeight: "600" }}
                              >
                                {displayOrderNum} ↗
                              </a>
                            ) : (
                              <Text variant="bodyMd" fontWeight="bold">
                                {displayOrderNum}
                              </Text>
                            )}
                            <Text variant="bodyXs" tone="subdued">
                              {formatDate(item.placedAt)}
                            </Text>
                          </BlockStack>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <InlineStack gap="300" blockAlign="center">
                            {item.image ? (
                              <Thumbnail source={item.image} alt={item.productTitle} size="small" />
                            ) : (
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  background: "#F1F5F9",
                                  borderRadius: 6,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 18,
                                }}
                              >
                                📦
                              </div>
                            )}
                            <BlockStack gap="050">
                              <Text variant="bodyMd" fontWeight="bold">
                                {item.productTitle || "Pre-Order Item"}
                              </Text>
                              {item.variantTitle && item.variantTitle !== "Default Title" ? (
                                <Text variant="bodyXs" tone="subdued">
                                  {item.variantTitle}
                                </Text>
                              ) : null}
                            </BlockStack>
                          </InlineStack>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <BlockStack gap="050">
                            <Text variant="bodyMd" fontWeight="medium">
                              {item.customer?.name || "Customer"}
                            </Text>
                            {item.customer?.email ? (
                              <Text variant="bodyXs" tone="subdued">
                                {item.customer.email}
                              </Text>
                            ) : null}
                          </BlockStack>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Text variant="bodyMd" fontWeight="bold">
                            {item.quantity} {item.quantity === 1 ? "unit" : "units"}
                          </Text>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Text variant="bodyMd" fontWeight="bold">
                            {formatCurrency(item.totalPrice, item.currency)}
                          </Text>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Badge tone={item.financialStatus === "PAID" ? "success" : "caution"}>
                            {item.financialStatus || item.paymentStatus || "PENDING"}
                          </Badge>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Badge tone={item.fulfillmentStatus === "FULFILLED" ? "success" : "warning"}>
                            {item.fulfillmentStatus || "UNFULFILLED"}
                          </Badge>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Badge tone={item.status === "FULFILLED" ? "success" : "warning"}>
                            {item.status || "PENDING"}
                          </Badge>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <InlineStack gap="150" align="end" blockAlign="center">
                            {item.status !== "FULFILLED" && (
                              <Button
                                size="micro"
                                variant="primary"
                                loading={actionLoadingId === item._id}
                                onClick={() =>
                                  setConfirmModal({
                                    open: true,
                                    title: `Fulfill Pre-Order ${displayOrderNum}`,
                                    message: `Are you ready to mark order ${displayOrderNum} as fulfilled?`,
                                    confirmTone: "primary",
                                    confirmLabel: "Mark Fulfilled",
                                    confirmAction: () => handleUpdateStatus(item._id, "FULFILLED"),
                                  })
                                }
                              >
                                Fulfill
                              </Button>
                            )}

                            {item.status !== "CANCELLED" ? (
                              <Button
                                size="micro"
                                tone="critical"
                                loading={actionLoadingId === item._id}
                                onClick={() =>
                                  setConfirmModal({
                                    open: true,
                                    title: `Cancel Pre-Order ${displayOrderNum}`,
                                    message: `Are you sure you want to cancel pre-order ${displayOrderNum}?`,
                                    confirmTone: "critical",
                                    confirmLabel: "Cancel Order",
                                    confirmAction: () => handleUpdateStatus(item._id, "CANCELLED"),
                                  })
                                }
                              >
                                Cancel
                              </Button>
                            ) : (
                              <Button
                                size="micro"
                                variant="plain"
                                tone="critical"
                                loading={actionLoadingId === item._id}
                                onClick={() =>
                                  setConfirmModal({
                                    open: true,
                                    title: `Delete Pre-Order Record`,
                                    message: `Permanently delete pre-order record for ${displayOrderNum}?`,
                                    confirmTone: "critical",
                                    confirmLabel: "Delete",
                                    confirmAction: () => handleDeletePreOrder(item._id),
                                  })
                                }
                              >
                                Delete
                              </Button>
                            )}
                          </InlineStack>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    );
                  })}
                </IndexTable>
              )}

              {pagination.totalPages > 1 && (
                <Box padding="400">
                  <InlineStack align="center">
                    <Pagination
                      hasPrevious={pagination.page > 1}
                      onPrevious={() => loadPreOrders(pagination.page - 1)}
                      hasNext={pagination.page < pagination.totalPages}
                      onNext={() => loadPreOrders(pagination.page + 1)}
                    />
                  </InlineStack>
                </Box>
              )}
            </Card>
          </BlockStack>
        )}
      </BlockStack>

      {/* ================================================== */}
      {/* MODAL: CONFIGURE NEW / EDIT PRODUCT LAUNCH         */}
      {/* ================================================== */}
      <Modal
        open={modalOpen}
        size="large"
        onClose={() => setModalOpen(false)}
        title={modalMode === "CREATE" ? "🚀 Configure New Product Launch" : "✏️ Edit Product Launch Configuration"}
        primaryAction={{
          content: savingLaunch ? "Saving..." : "Save Configuration",
          loading: savingLaunch,
          onAction: handleSaveLaunchConfig,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px", alignItems: "start" }}>
            {/* LEFT COLUMN: FORM INPUTS */}
            <BlockStack gap="400">
              {/* PRODUCT SELECTOR */}
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  1. Select Shopify Product
                </Text>
                {configForm.productId ? (
                  <Card padding="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="300" blockAlign="center">
                        {configForm.productImage ? (
                          <Thumbnail source={configForm.productImage} alt={configForm.productTitle} size="small" />
                        ) : (
                          <div style={{ fontSize: 24 }}>📦</div>
                        )}
                        <BlockStack gap="050">
                          <Text variant="bodyMd" fontWeight="bold">
                            {configForm.productTitle}
                          </Text>
                          <Text variant="bodyXs" tone="subdued">
                            ID: {configForm.productId}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      {modalMode === "CREATE" && (
                        <Button size="micro" onClick={() => setProductDropdownOpen(true)}>
                          Change Product
                        </Button>
                      )}
                    </InlineStack>
                  </Card>
                ) : (
                  <Button onClick={() => setProductDropdownOpen(true)}>
                    🔍 Select Product from Catalog
                  </Button>
                )}

                {/* PRODUCT DROPDOWN PICKER */}
                {productDropdownOpen && (
                  <Card padding="300">
                    <BlockStack gap="200">
                      <TextField
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(val) => {
                          setProductSearch(val);
                          loadStoreProducts(val);
                        }}
                        autoComplete="off"
                      />
                      <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        {productsLoading ? (
                          <Box padding="300">
                            <Spinner size="small" />
                          </Box>
                        ) : storeProducts.length === 0 ? (
                          <Text variant="bodySm" tone="subdued">
                            No products found.
                          </Text>
                        ) : (
                          storeProducts.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleSelectProduct(p)}
                              style={{
                                padding: "8px",
                                cursor: "pointer",
                                borderBottom: "1px solid #F1F5F9",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                              }}
                            >
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.title}
                                  style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }}
                                />
                              ) : (
                                <span>📦</span>
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: "600" }}>{p.title}</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>
                                  {p.variantsCount} {p.variantsCount === 1 ? "variant" : "variants"}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <Button size="micro" onClick={() => setProductDropdownOpen(false)}>
                        Close Picker
                      </Button>
                    </BlockStack>
                  </Card>
                )}
              </BlockStack>

              <Divider />

              {/* SCHEDULE & TOGGLE */}
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  2. Launch Schedule
                </Text>
                <Checkbox
                  label="Enable Pre-Order for this Product"
                  checked={configForm.preOrderEnabled}
                  onChange={(checked) => setConfigForm((prev) => ({ ...prev, preOrderEnabled: checked }))}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <TextField
                    label="Launch Date (Required)"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={configForm.launchDate}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, launchDate: val }))}
                    helpText="Pre-order UI automatically expires when this date arrives."
                    autoComplete="off"
                  />

                  <TextField
                    label="Shipping Starts (Optional)"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={configForm.shippingDate}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, shippingDate: val }))}
                    autoComplete="off"
                  />
                </div>

                <TextField
                  label="Pre-Order Opens From (Optional)"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={configForm.preOrderOpensAt}
                  onChange={(val) => setConfigForm((prev) => ({ ...prev, preOrderOpensAt: val }))}
                  helpText="Leave empty to make pre-orders available immediately."
                  autoComplete="off"
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px" }}>
                  <TextField
                    label="Deposit Percentage (%)"
                    type="number"
                    value={configForm.depositPercentage === "" ? "" : String(configForm.depositPercentage ?? 50)}
                    onChange={(val) => {
                      if (val === "") {
                        setConfigForm((prev) => ({ ...prev, depositPercentage: "" }));
                        return;
                      }
                      const num = parseInt(val, 10);
                      const pct = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
                      const selP = storeProducts.find((p) => p.id === configForm.productId);
                      const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || 0);
                      const calcAmt = pPrice > 0 ? Number(((pPrice * pct) / 100).toFixed(2)) : 0;
                      setConfigForm((prev) => ({
                        ...prev,
                        depositPercentage: pct,
                        depositAmount: pct === 0 ? (prev.depositAmount || 0) : calcAmt,
                      }));
                    }}
                    helpText="Percentage of total price (0% - 100%). Set 0% for custom fixed dollar deposit."
                    autoComplete="off"
                  />
                  <TextField
                    label={
                      (() => {
                        const selP = storeProducts.find((p) => p.id === configForm.productId);
                        const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || (configForm.productId ? 126790 : 0));
                        return pPrice > 0 ? `Deposit Price Amount ($ of $${pPrice.toLocaleString()})` : "Deposit Price Amount ($)";
                      })()
                    }
                    type="number"
                    prefix="$"
                    value={
                      (() => {
                        const selP = storeProducts.find((p) => p.id === configForm.productId);
                        const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || (configForm.productId ? 126790 : 0));
                        if (configForm.depositPercentage === 0 || configForm.depositPercentage === "0") {
                          return configForm.depositAmount != null && configForm.depositAmount !== "" ? String(configForm.depositAmount) : "0";
                        }
                        if (pPrice > 0 && configForm.depositPercentage !== "" && configForm.depositPercentage != null) {
                          return ((pPrice * Number(configForm.depositPercentage)) / 100).toFixed(2);
                        }
                        return configForm.depositAmount != null && configForm.depositAmount !== "" ? String(configForm.depositAmount) : "";
                      })()
                    }
                    onChange={(val) => {
                      const selP = storeProducts.find((p) => p.id === configForm.productId);
                      const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || (configForm.productId ? 126790 : 0));
                      if (val === "") {
                        setConfigForm((prev) => ({
                          ...prev,
                          depositAmount: "",
                          depositPercentage: prev.depositPercentage === 0 ? 0 : "",
                        }));
                        return;
                      }
                      const amt = parseFloat(val);
                      const safeAmt = isNaN(amt) ? 0 : Math.max(0, amt);
                      if (pPrice > 0) {
                        if (configForm.depositPercentage === 0 || configForm.depositPercentage === "0") {
                          setConfigForm((prev) => ({ ...prev, depositAmount: safeAmt, depositPercentage: 0 }));
                        } else {
                          const calculatedPct = Math.max(0, Math.min(100, Math.round((safeAmt / pPrice) * 100)));
                          setConfigForm((prev) => ({ ...prev, depositAmount: safeAmt, depositPercentage: calculatedPct }));
                        }
                      } else {
                        setConfigForm((prev) => ({ ...prev, depositAmount: safeAmt }));
                      }
                    }}
                    helpText={
                      (() => {
                        const selP = storeProducts.find((p) => p.id === configForm.productId);
                        const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || (configForm.productId ? 126790 : 0));
                        const isZeroPct = configForm.depositPercentage === 0 || configForm.depositPercentage === "0";
                        const currentDepositAmt = isZeroPct
                          ? Number(configForm.depositAmount || 0)
                          : (pPrice > 0 && configForm.depositPercentage !== "" ? (pPrice * Number(configForm.depositPercentage || 0)) / 100 : Number(configForm.depositAmount || 0));
                        if (pPrice > 0) {
                          const remaining = Math.max(0, pPrice - currentDepositAmt);
                          return `Remaining Balance: $${remaining.toFixed(2)} (Deposit: $${currentDepositAmt.toFixed(2)})`;
                        }
                        return "Calculates or sets deposit amount from price";
                      })()
                    }
                    autoComplete="off"
                  />
                </div>
                <div style={{ marginTop: "4px" }}>
                  <Checkbox
                    label="Enable Partial Deposit Payment"
                    helpText="When enabled, customer only pays the deposit amount at checkout."
                    checked={configForm.depositEnabled !== false}
                    onChange={(checked) => setConfigForm((prev) => ({ ...prev, depositEnabled: checked }))}
                  />
                </div>
              </BlockStack>

              <Divider />

              {/* 3. STOREFRONT TEXT CUSTOMIZATION */}
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  3. Storefront Text Customization
                </Text>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <TextField
                    label="Primary Badge Text"
                    value={configForm.badgeText}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, badgeText: val }))}
                    autoComplete="off"
                  />
                  <TextField
                    label="Secondary Launch Label"
                    value={configForm.launchLabel}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, launchLabel: val }))}
                    autoComplete="off"
                  />
                </div>

                <TextField
                  label="Launch Title"
                  value={configForm.launchTitle}
                  onChange={(val) => setConfigForm((prev) => ({ ...prev, launchTitle: val }))}
                  autoComplete="off"
                />

                <TextField
                  label="Customer Message"
                  value={configForm.customerMessage}
                  onChange={(val) => setConfigForm((prev) => ({ ...prev, customerMessage: val }))}
                  multiline={2}
                  autoComplete="off"
                />

                <TextField
                  label="Launch Details / Note"
                  value={configForm.launchDetails}
                  onChange={(val) => setConfigForm((prev) => ({ ...prev, launchDetails: val }))}
                  placeholder="e.g. Officially launching on 30 Aug 2026."
                  autoComplete="off"
                />

                <TextField
                  label="Pre-Order Button Text"
                  value={configForm.buttonText}
                  onChange={(val) => setConfigForm((prev) => ({ ...prev, buttonText: val }))}
                  autoComplete="off"
                />
              </BlockStack>

              <Divider />

              {/* 4. COLORS & THEME CUSTOMIZATION */}
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  4. Card Colors & Styling
                </Text>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <ColorPickerField
                    label="Card Background Color"
                    value={configForm.cardBackgroundColor || "#FFFFFF"}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, cardBackgroundColor: val }))}
                  />
                  <ColorPickerField
                    label="Text & Title Color"
                    value={configForm.textColor || "#111827"}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, textColor: val }))}
                  />
                  <ColorPickerField
                    label="Button / Accent Color"
                    value={configForm.accentColor || "#4F46E5"}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, accentColor: val }))}
                  />
                  <ColorPickerField
                    label="Card Border Color"
                    value={configForm.borderColor || "#E2E8F0"}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, borderColor: val }))}
                  />
                  <ColorPickerField
                    label="Badge Background Color"
                    value={configForm.badgeBackgroundColor || "#0F172A"}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, badgeBackgroundColor: val }))}
                  />
                  <ColorPickerField
                    label="Badge Text Color"
                    value={configForm.badgeTextColor || "#FFFFFF"}
                    onChange={(val) => setConfigForm((prev) => ({ ...prev, badgeTextColor: val }))}
                  />
                </div>
              </BlockStack>
            </BlockStack>

            {/* RIGHT COLUMN: LIVE STOREFRONT PREVIEW */}
            <div style={{ position: "sticky", top: 0 }}>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  📱 Live Storefront Preview
                </Text>
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: "16px",
                    padding: "20px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                  }}
                >
                  {/* BRAND / VENDOR */}
                  <div style={{ fontSize: 12, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>
                    ProMobile Hub
                  </div>

                  {/* PRODUCT TITLE */}
                  <div style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>
                    {configForm.productTitle || "Apple iPhone 17 Pro"}
                  </div>

                  {/* PRODUCT PRICE */}
                  <div style={{ fontSize: 16, fontWeight: "600", color: "#0F172A", marginBottom: "2px" }}>
                    $126,790.00 USD
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: "16px" }}>
                    Taxes included.
                  </div>

                  {/* QUANTITY SELECTOR MOCK */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: 11, fontWeight: "600", color: "#475569", marginBottom: "4px" }}>Quantity</div>
                    <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid #CBD5E1", borderRadius: "6px", overflow: "hidden", fontSize: "12px" }}>
                      <span style={{ padding: "6px 12px", background: "#F8FAFC", cursor: "pointer" }}>−</span>
                      <span style={{ padding: "6px 14px", fontWeight: "700" }}>1</span>
                      <span style={{ padding: "6px 12px", background: "#F8FAFC", cursor: "pointer" }}>+</span>
                    </div>
                  </div>

                  {/* ONE SINGLE UNIFIED NEW PRODUCT LAUNCH & PRE-ORDER CARD */}
                  <div
                    style={{
                      display: "block",
                      width: "100%",
                      background: configForm.cardBackgroundColor || "#FFFFFF",
                      border: `1.5px solid ${configForm.borderColor || "#E2E8F0"}`,
                      borderRadius: "16px",
                      padding: "20px 22px",
                      boxShadow: "0 4px 16px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)",
                      color: configForm.textColor || "#0F172A",
                      boxSizing: "border-box",
                      transition: "all 0.25s ease",
                    }}
                  >
                    {/* 1. CARD HEADER & BADGES */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "16.5px", fontWeight: "800", color: configForm.textColor || "#0F172A", letterSpacing: "-0.2px", lineHeight: "1.3" }}>
                          🚀 {configForm.launchTitle || "New Product Launch"}
                        </span>
                      </div>

                      <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                        {configForm.badgeText && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              background: configForm.badgeBackgroundColor || "#0F172A",
                              color: configForm.badgeTextColor || "#FFFFFF",
                              fontSize: "10.5px",
                              fontWeight: "700",
                              letterSpacing: "0.6px",
                              textTransform: "uppercase",
                              padding: "4px 10px",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.15)",
                              lineHeight: "1.2",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {configForm.badgeText}
                          </span>
                        )}
                        {configForm.launchLabel && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                              color: "#FFFFFF",
                              fontSize: "10.5px",
                              fontWeight: "700",
                              letterSpacing: "0.6px",
                              textTransform: "uppercase",
                              padding: "4px 9px",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 3px rgba(79, 70, 229, 0.22)",
                              lineHeight: "1.2",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {configForm.launchLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. LAUNCH SCHEDULE (2 COLUMNS) */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "12px" }}>
                      {configForm.launchDate && (
                        <div
                          style={{
                            background: "#F8FAFC",
                            border: `1px solid ${configForm.borderColor || "#E2E8F0"}`,
                            borderRadius: "10px",
                            padding: "10px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                            boxSizing: "border-box",
                          }}
                        >
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            📅 LAUNCH DATE
                          </span>
                          <span style={{ fontSize: "14px", fontWeight: "800", color: configForm.textColor || "#0F172A", letterSpacing: "-0.1px" }}>
                            {formatDate(configForm.launchDate)}
                          </span>
                        </div>
                      )}

                      {configForm.shippingDate && (
                        <div
                          style={{
                            background: "#F8FAFC",
                            border: `1px solid ${configForm.borderColor || "#E2E8F0"}`,
                            borderRadius: "10px",
                            padding: "10px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                            boxSizing: "border-box",
                          }}
                        >
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            📦 SHIPPING STARTS
                          </span>
                          <span style={{ fontSize: "14px", fontWeight: "800", color: configForm.textColor || "#0F172A", letterSpacing: "-0.1px" }}>
                            {formatDate(configForm.shippingDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 3. CUSTOMER MESSAGE */}
                    {configForm.customerMessage && (
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: "600",
                          color: "#312E81",
                          background: "#EEF2FF",
                          borderLeft: `3px solid ${configForm.accentColor || "#4F46E5"}`,
                          padding: "8px 12px",
                          borderRadius: "6px",
                          marginBottom: "14px",
                          lineHeight: "1.4",
                        }}
                      >
                        ✨ {configForm.customerMessage}
                      </div>
                    )}

                    {/* 4. LAUNCH DETAILS NOTE */}
                    {configForm.launchDetails && (
                      <div style={{ fontSize: "11px", color: "#64748B", fontStyle: "italic", marginBottom: "12px" }}>
                        {configForm.launchDetails}
                      </div>
                    )}

                    {/* 5. DIVIDER */}
                    <hr style={{ border: "none", borderTop: `1px solid ${configForm.borderColor || "#E2E8F0"}`, margin: "16px 0" }} />

                    {/* 6. PRE-ORDER PAYMENT BREAKDOWN */}
                    {configForm.depositEnabled !== false && (
                      <div style={{ display: "block", marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.6px", color: configForm.textColor || "#0F172A" }}>
                            PRE-ORDER PAYMENT
                          </span>
                          <span
                            style={{
                              background: configForm.accentColor || "#4F46E5",
                              color: "#FFFFFF",
                              fontSize: "10px",
                              fontWeight: "800",
                              letterSpacing: "0.5px",
                              padding: "3px 8px",
                              borderRadius: "9999px",
                              textTransform: "uppercase",
                            }}
                          >
                            {(configForm.depositPercentage === 0 || configForm.depositPercentage === "0")
                              ? `$${Number(configForm.depositAmount || 0).toFixed(2)} DEPOSIT`
                              : `${configForm.depositPercentage || 50}% DEPOSIT`}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", padding: "6px 0", borderBottom: `1px dashed ${configForm.borderColor || "#E2E8F0"}`, color: "#475569" }}>
                          <span>Total Product Price</span>
                          <strong>
                            ${(() => {
                              const selP = storeProducts.find((p) => p.id === configForm.productId);
                              const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || (configForm.productId ? 126790 : 126790));
                              return pPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            })()}
                          </strong>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "14px", fontWeight: "800", color: configForm.textColor || "#0F172A", padding: "8px 0 6px 0", borderBottom: `1px dashed ${configForm.borderColor || "#E2E8F0"}` }}>
                          <span>Pay Now {(configForm.depositPercentage === 0 || configForm.depositPercentage === "0") ? "(Fixed Deposit)" : `(${configForm.depositPercentage || 50}%)`}</span>
                          <strong style={{ color: configForm.textColor || "#0F172A" }}>
                            ${(() => {
                              const selP = storeProducts.find((p) => p.id === configForm.productId);
                              const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || (configForm.productId ? 126790 : 126790));
                              const isZeroPct = configForm.depositPercentage === 0 || configForm.depositPercentage === "0";
                              const depAmt = isZeroPct ? Number(configForm.depositAmount || 0) : ((pPrice * Number(configForm.depositPercentage || 50)) / 100);
                              return depAmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            })()}
                          </strong>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", padding: "6px 0", color: "#475569" }}>
                          <span>Remaining Balance</span>
                          <strong>
                            ${(() => {
                              const selP = storeProducts.find((p) => p.id === configForm.productId);
                              const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || (configForm.productId ? 126790 : 126790));
                              const isZeroPct = configForm.depositPercentage === 0 || configForm.depositPercentage === "0";
                              const depAmt = isZeroPct ? Number(configForm.depositAmount || 0) : ((pPrice * Number(configForm.depositPercentage || 50)) / 100);
                              const rem = Math.max(0, pPrice - depAmt);
                              return rem.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            })()}
                          </strong>
                        </div>

                        <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: `1px solid ${configForm.borderColor || "#F1F5F9"}`, fontSize: "11.5px", color: "#64748B", lineHeight: "1.45" }}>
                          💡 Pay { (configForm.depositPercentage === 0 || configForm.depositPercentage === "0") ? `$${Number(configForm.depositAmount || 0).toFixed(2)}` : `${configForm.depositPercentage || 50}%` } now to secure your pre-order. Remaining balance will be due before shipping.
                        </div>
                      </div>
                    )}

                    {/* 7. PRE-ORDER CTA BUTTON (INSIDE THE SAME UNIFIED CARD) */}
                    <button
                      type="button"
                      style={{
                        display: "block",
                        width: "100%",
                        minHeight: "48px",
                        background: configForm.accentColor || "#0F172A",
                        color: "#FFFFFF",
                        fontSize: "14.5px",
                        fontWeight: "800",
                        letterSpacing: "0.8px",
                        textTransform: "uppercase",
                        borderRadius: "10px",
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 4px 16px rgba(15, 23, 42, 0.2)",
                        padding: "12px 20px",
                      }}
                    >
                      🛒 {configForm.buttonText || "PRE-ORDER NOW"} · PAY $
                      {(() => {
                        const selP = storeProducts.find((p) => p.id === configForm.productId);
                        const pPrice = Number(configForm.productPrice || configForm.price || selP?.price || (configForm.productId ? 126790 : 126790));
                        const isZeroPct = configForm.depositPercentage === 0 || configForm.depositPercentage === "0";
                        const depAmt = isZeroPct ? Number(configForm.depositAmount || 0) : ((pPrice * Number(configForm.depositPercentage || 50)) / 100);
                        return depAmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                    </button>
                    </div>
                  </div>
                </BlockStack>
            </div>
          </div>
        </Modal.Section>
      </Modal>

      {/* ================================================== */}
      {/* CONFIRMATION MODAL                                 */}
      {/* ================================================== */}
      <Modal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false })}
        title={confirmModal.title}
        primaryAction={{
          content: confirmModal.confirmLabel,
          destructive: confirmModal.confirmTone === "critical",
          onAction: () => {
            if (confirmModal.confirmAction) confirmModal.confirmAction();
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setConfirmModal({ open: false }),
          },
        ]}
      >
        <Modal.Section>
          <Text variant="bodyMd">{confirmModal.message}</Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
