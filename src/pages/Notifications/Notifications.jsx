import React, { useState, useEffect, useCallback } from "react";
import {
  Page,
  Layout,
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
  Modal,
  IndexTable,
  Divider,
} from "@shopify/polaris";
import { useSearchParams } from "react-router";
import {
  fetchNotificationsApi,
  cancelNotificationApi,
  triggerRestockApi,
} from "../../services/appApi";

export default function Notifications({ shopDomain } = {}) {
  const [searchParams] = useSearchParams();
  const shop = shopDomain || searchParams.get("shop") || "";

  const [selectedTab, setSelectedTab] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, notified: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockLoading, setRestockLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [restockStock, setRestockStock] = useState("10");

  const tabs = [
    { id: "ALL", content: `All (${counts.total || 0})` },
    { id: "PENDING", content: `Pending (${counts.pending || 0})` },
    { id: "NOTIFIED", content: `Notified (${counts.notified || 0})` },
    { id: "CANCELLED", content: "Cancelled" },
  ];

  const currentStatus = tabs[selectedTab]?.id || "ALL";

  const loadNotifications = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const res = await fetchNotificationsApi({
          shop,
          status: currentStatus,
          search: searchQuery,
          page,
          limit: 20,
        });

        if (res?.success) {
          setNotifications(res.data || []);
          if (res.counts) setCounts(res.counts);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
        setNotice({
          tone: "critical",
          message: "Unable to fetch notification requests.",
        });
      } finally {
        setLoading(false);
      }
    },
    [shop, currentStatus, searchQuery]
  );

  useEffect(() => {
    loadNotifications(1);
  }, [loadNotifications]);

  const handleCancelNotification = async (id) => {
    try {
      setActionLoadingId(id);
      await cancelNotificationApi(shop, id, false);
      setNotice({
        tone: "success",
        message: "✓ Notification request cancelled.",
      });
      loadNotifications(pagination.page);
    } catch (err) {
      setNotice({
        tone: "critical",
        message: err.message || "Failed to cancel request.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteNotification = async (id) => {
    try {
      setActionLoadingId(id);
      await cancelNotificationApi(shop, id, true);
      setNotice({
        tone: "success",
        message: "✓ Notification request permanently deleted.",
      });
      loadNotifications(pagination.page);
    } catch (err) {
      setNotice({
        tone: "critical",
        message: err.message || "Failed to delete request.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleTriggerRestock = async () => {
    if (!selectedItem?.variantId) return;

    const qty = Number(restockStock);
    if (isNaN(qty) || qty <= 0) {
      setNotice({
        tone: "critical",
        message: "Please enter a valid positive restock quantity.",
      });
      return;
    }

    try {
      setRestockLoading(true);
      const res = await triggerRestockApi(shop, selectedItem.variantId, qty);

      if (res.sent > 0) {
        setNotice({
          tone: "success",
          message: `✓ Email sent successfully! Restocked ${
            res.inventory?.newStock !== undefined ? res.inventory.newStock : qty
          } units for ${selectedItem.productTitle || "product"}.`,
        });
        setRestockModalOpen(false);
        loadNotifications(pagination.page);
      } else if (res.processed > 0 && res.sent === 0) {
        const errorDetail =
          res.results?.[0]?.error || res.message || "The email provider rejected the request.";
        setNotice({
          tone: "critical",
          message: `Inventory updated, but failed to send email notifications: ${errorDetail}`,
        });
      } else if (res.processed === 0) {
        setNotice({
          tone: "info",
          message: `✓ Shopify inventory updated${
            res.inventory?.newStock !== undefined ? ` to ${res.inventory.newStock} units` : ""
          }. No pending waitlist subscribers for this variant.`,
        });
        setRestockModalOpen(false);
        loadNotifications(pagination.page);
      } else {
        setNotice({
          tone: "success",
          message: `✓ ${res.message || "Restock processed successfully."}`,
        });
        setRestockModalOpen(false);
        loadNotifications(pagination.page);
      }
    } catch (err) {
      setNotice({
        tone: "critical",
        message: err.message || "Failed to dispatch restock notification.",
      });
    } finally {
      setRestockLoading(false);
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

  const resourceName = {
    singular: "request",
    plural: "requests",
  };

  const rowMarkup = notifications.map((item, index) => {
    const statusUpper = String(item.status || "PENDING").toUpperCase();
    let badgeTone = "warning";
    if (statusUpper === "NOTIFIED") badgeTone = "success";
    if (statusUpper === "CANCELLED") badgeTone = "subdued";

    return (
      <IndexTable.Row id={item._id} key={item._id} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {item.productTitle || "Product"}
            </Text>
            {item.productId ? (
              <Text variant="bodySm" tone="subdued" as="span">
                ID: {item.productId}
              </Text>
            ) : null}
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {item.variantTitle && item.variantTitle !== "Default Title"
              ? item.variantTitle
              : `ID: ${item.variantId}`}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" fontWeight="medium">
            {item.email}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Badge tone={badgeTone}>{statusUpper}</Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued" as="span">
            {formatDate(item.createdAt)}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued" as="span">
            {formatDate(item.notifiedAt)}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <InlineStack gap="150" align="end" blockAlign="center">
            {statusUpper === "PENDING" && (
              <>
                <Button
                  size="micro"
                  variant="primary"
                  onClick={() => {
                    setSelectedItem(item);
                    setRestockStock("10");
                    setRestockModalOpen(true);
                  }}
                >
                  Test Restock
                </Button>
                <Button
                  size="micro"
                  tone="critical"
                  loading={actionLoadingId === item._id}
                  onClick={() => handleCancelNotification(item._id)}
                >
                  Cancel
                </Button>
              </>
            )}
            <Button
              size="micro"
              variant="plain"
              tone="critical"
              loading={actionLoadingId === item._id}
              onClick={() => handleDeleteNotification(item._id)}
            >
              Delete
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      fullWidth
      title="Back-in-Stock Requests"
      subtitle="Manage customer waitlists and automated restock notification delivery."
      primaryAction={{
        content: loading ? "Refreshing..." : "Refresh List",
        onAction: () => loadNotifications(1),
        loading,
      }}
    >
      <BlockStack gap="500">
        {notice && (
          <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
            <p>{notice.message}</p>
          </Banner>
        )}

        {/* METRICS ROW */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card padding="400">
              <BlockStack gap="100">
                <Text variant="bodySm" tone="subdued">Total Waitlist Requests</Text>
                <Text variant="headingXl" as="h2" fontWeight="bold">
                  {counts.total || 0}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card padding="400">
              <BlockStack gap="100">
                <Text variant="bodySm" tone="subdued">Pending Notification</Text>
                <Text variant="headingXl" as="h2" tone="caution" fontWeight="bold">
                  {counts.pending || 0}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card padding="400">
              <BlockStack gap="100">
                <Text variant="bodySm" tone="subdued">Successfully Notified</Text>
                <Text variant="headingXl" as="h2" tone="success" fontWeight="bold">
                  {counts.notified || 0}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* MAIN DATA CARD */}
        <Card padding="0">
          <Tabs
            tabs={tabs}
            selected={selectedTab}
            onSelect={(idx) => setSelectedTab(idx)}
          />
          <Divider />

          <Box padding="400">
            <InlineStack align="space-between" blockAlign="center" gap="400">
              <Box minWidth="340px">
                <TextField
                  placeholder="Search by customer email, product name, or variant..."
                  value={searchQuery}
                  onChange={(val) => setSearchQuery(val)}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearchQuery("")}
                />
              </Box>
              <Text variant="bodySm" tone="subdued" as="span">
                Showing {notifications.length} of {pagination.total || notifications.length} requests
              </Text>
            </InlineStack>
          </Box>

          {loading ? (
            <Box padding="800">
              <InlineStack align="center" blockAlign="center" gap="300">
                <Spinner size="small" />
                <Text variant="bodyMd" tone="subdued">Loading back-in-stock waitlist...</Text>
              </InlineStack>
            </Box>
          ) : notifications.length === 0 ? (
            <Box padding="800">
              <BlockStack align="center" inlineAlign="center" gap="200">
                <span style={{ fontSize: "36px" }}>🔔</span>
                <Text variant="headingMd" as="h3" alignment="center">
                  {searchQuery ? "No matching requests found" : "No back-in-stock requests yet"}
                </Text>
                <Text variant="bodyMd" tone="subdued" alignment="center" as="p">
                  {searchQuery
                    ? "Try adjusting your search terms or selecting a different tab."
                    : "When customers click 'Notify Me' on out-of-stock products, their requests will appear here."}
                </Text>
              </BlockStack>
            </Box>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={notifications.length}
              headings={[
                { title: "PRODUCT" },
                { title: "VARIANT" },
                { title: "CUSTOMER EMAIL" },
                { title: "STATUS" },
                { title: "SUBSCRIBED" },
                { title: "NOTIFIED" },
                { title: "ACTIONS", alignment: "end" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}

          {pagination.totalPages > 1 && (
            <Box padding="400" borderBlockStartWidth="025" borderColor="border-subdued">
              <InlineStack align="center">
                <Pagination
                  hasPrevious={pagination.page > 1}
                  onPrevious={() => loadNotifications(pagination.page - 1)}
                  hasNext={pagination.page < pagination.totalPages}
                  onNext={() => loadNotifications(pagination.page + 1)}
                />
              </InlineStack>
            </Box>
          )}
        </Card>
      </BlockStack>

      {/* Manual Test Restock Modal */}
      <Modal
        open={restockModalOpen}
        onClose={() => {
          if (!restockLoading) setRestockModalOpen(false);
        }}
        title="Simulate Variant Restock"
        primaryAction={{
          content: restockLoading ? "Dispatching..." : "Dispatch Restock Emails",
          onAction: handleTriggerRestock,
          loading: restockLoading,
          disabled: restockLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            disabled: restockLoading,
            onAction: () => setRestockModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text variant="bodyMd">
              Simulate replenishing stock for <strong>{selectedItem?.productTitle || "Product"}</strong> (
              {selectedItem?.variantTitle || `Variant ID: ${selectedItem?.variantId}`}).
            </Text>
            <Text variant="bodySm" tone="subdued">
              This will find all pending subscribers for this variant and dispatch real Back-in-Stock notification emails with direct product purchase links.
            </Text>
            <TextField
              label="Simulated Restock Quantity"
              type="number"
              value={restockStock}
              onChange={(val) => setRestockStock(val)}
              autoComplete="off"
              disabled={restockLoading}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
