import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  IndexTable,
  Badge,
  Button,
  InlineStack,
  Text,
  BlockStack,
  Banner,
  Spinner,
  Box,
  Select,
} from "@shopify/polaris";
import {
  getHighDemandReordersApi,
  confirmHighDemandReorderApi,
  cancelHighDemandReorderApi,
} from "../../services/appApi";

export default function HighDemandReorders({ shopDomain = "" }) {
  const [reorders, setReorders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [notice, setNotice] = useState(null);

  const loadReorders = useCallback(async () => {
    if (!shopDomain) return;
    try {
      setLoading(true);
      setNotice(null);
      const res = await getHighDemandReordersApi({
        shop: shopDomain,
        status: statusFilter !== "all" ? statusFilter : "",
      });
      setReorders(res.data || res.reorders || []);
    } catch (err) {
      console.error("Failed to load reorders:", err);
      setNotice({ tone: "critical", message: err.message || "Failed to load reorder requests." });
    } finally {
      setLoading(false);
    }
  }, [shopDomain, statusFilter]);

  useEffect(() => {
    loadReorders();
  }, [loadReorders]);

  const handleConfirm = async (id) => {
    try {
      setActionLoadingId(id);
      await confirmHighDemandReorderApi(id);
      setNotice({ tone: "success", message: "Reorder request confirmed successfully." });
      await loadReorders();
    } catch (err) {
      setNotice({ tone: "critical", message: err.message || "Failed to confirm reorder." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id) => {
    try {
      setActionLoadingId(id);
      await cancelHighDemandReorderApi(id);
      setNotice({ tone: "success", message: "Reorder request cancelled successfully." });
      await loadReorders();
    } catch (err) {
      setNotice({ tone: "critical", message: err.message || "Failed to cancel reorder." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const resourceName = {
    singular: "reorder request",
    plural: "reorder requests",
  };

  const rowMarkup = reorders.map((item, index) => {
    const isPending = item.status === "PENDING";
    const isConfirmed = item.status === "CONFIRMED";
    const isCancelled = item.status === "CANCELLED";

    let badgeTone = "info";
    if (isConfirmed) badgeTone = "success";
    if (isCancelled) badgeTone = "critical";

    const isProcessing = actionLoadingId === item._id;

    return (
      <IndexTable.Row id={item._id} key={item._id} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text variant="bodyMd" fontWeight="bold">
              {item.productName || "Product"}
            </Text>
            <Text variant="bodySm" tone="subdued">
              {item.variantTitle || "Default Title"}
            </Text>
          </BlockStack>
        </IndexTable.Cell>

        <IndexTable.Cell>{item.sku || "—"}</IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="semibold">
            {item.requestedQuantity ?? item.reorderQuantity ?? 0} units
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Badge
            tone={
              item.riskLevel === "CRITICAL"
                ? "critical"
                : item.riskLevel === "HIGH"
                ? "warning"
                : "success"
            }
          >
            {item.riskLevel || "SAFE"}
          </Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Badge tone={badgeTone}>{item.status || "PENDING"}</Badge>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued">
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
          </Text>
        </IndexTable.Cell>

        <IndexTable.Cell>
          <InlineStack gap="200">
            {isPending ? (
              <>
                <Button
                  size="micro"
                  variant="primary"
                  loading={isProcessing}
                  onClick={() => handleConfirm(item._id)}
                >
                  Confirm
                </Button>
                <Button
                  size="micro"
                  tone="critical"
                  loading={isProcessing}
                  onClick={() => handleCancel(item._id)}
                >
                  Cancel
                </Button>
              </>
            ) : isConfirmed ? (
              <Text variant="bodySm" tone="success" fontWeight="bold">
                ✓ Confirmed
              </Text>
            ) : (
              <Text variant="bodySm" tone="subdued">
                ✕ Cancelled
              </Text>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <BlockStack gap="400">
      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          <p>{notice.message}</p>
        </Banner>
      )}

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h3">
              📦 Reorder Requests ({reorders.length})
            </Text>

            <Box width="200px">
              <Select
                label=""
                labelHidden
                options={[
                  { label: "All Statuses", value: "all" },
                  { label: "Pending", value: "PENDING" },
                  { label: "Confirmed", value: "CONFIRMED" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </Box>
          </InlineStack>

          {loading ? (
            <Box padding="800" textAlign="center">
              <Spinner size="large" />
            </Box>
          ) : reorders.length === 0 ? (
            <Box padding="600" textAlign="center">
              <Text tone="subdued">No reorder requests found.</Text>
            </Box>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={reorders.length}
              headings={[
                { title: "Product" },
                { title: "SKU" },
                { title: "Requested Qty" },
                { title: "Risk Level" },
                { title: "Status" },
                { title: "Created At" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
