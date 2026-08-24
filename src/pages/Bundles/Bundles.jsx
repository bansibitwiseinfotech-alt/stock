import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Button,
  TextField,
  InlineStack,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { fetchBundlesData, createBundleApi } from "../../services/appApi";
import BogoBundleSection from "../../components/Bundles/BogoBundleSection";

export default function Bundles({ shopDomain = "" }) {
  const [bundles, setBundles] = useState([
    { _id: "1", name: "Summer Bundle", type: "Bundle (BOGO)", productsCount: 2, status: "Active", performance: "$1,250" },
    { _id: "2", name: "Flat 20% Off", type: "Discount", productsCount: 15, status: "Active", performance: "$2,300" },
    { _id: "3", name: "Clearance Sale", type: "Discount", productsCount: 8, status: "Scheduled", performance: "$0" },
  ]);

  const [newBundleName, setNewBundleName] = useState("");

  const loadData = async () => {
    try {
      const data = await fetchBundlesData(shopDomain);
      if (data && data.length > 0) setBundles(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopDomain]);

  const handleCreate = async () => {
    if (!newBundleName.trim()) return;
    try {
      await createBundleApi(shopDomain, { name: newBundleName.trim(), type: "Bundle (BOGO)", productsCount: 2 });
      setNewBundleName("");
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const resourceName = { singular: "bundle", plural: "bundles" };

  const rowMarkup = bundles.map((bundle, index) => (
    <IndexTable.Row id={bundle._id} key={bundle._id} position={index}>
      <IndexTable.Cell><Text variant="bodyMd" fontWeight="bold" as="span">{bundle.name}</Text></IndexTable.Cell>
      <IndexTable.Cell>{bundle.type}</IndexTable.Cell>
      <IndexTable.Cell>{bundle.productsCount} SKUs</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={bundle.status === "Active" ? "success" : "warning"}>
          {bundle.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell><Text variant="bodyMd" fontWeight="bold" as="span">{bundle.performance}</Text></IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Bundles & Discounts"
      subtitle="Create bundles and discounts to boost sales and clear stagnant stock."
    >
      <Layout>
        {/* ================================================================ */}
        {/* EXISTING BUNDLE UI (UNCHANGED & PRESERVED ON TOP)                */}
        {/* ================================================================ */}
        <Layout.Section>
          <Card>
            <InlineStack gap="300" align="space-between" blockAlign="center">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Create New Bundle"
                  placeholder="Enter bundle name..."
                  value={newBundleName}
                  onChange={(val) => setNewBundleName(val)}
                  autoComplete="off"
                />
              </div>
              <Button variant="primary" onClick={handleCreate}>Create Bundle</Button>
            </InlineStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={bundles.length}
              headings={[
                { title: "NAME" },
                { title: "TYPE" },
                { title: "PRODUCTS" },
                { title: "STATUS" },
                { title: "PERFORMANCE" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>

        {/* ================================================================ */}
        {/* NEW BOGO SECTION (EXTENDED DIRECTLY BELOW EXISTING BUNDLE UI)    */}
        {/* ================================================================ */}
        <Layout.Section>
          <BogoBundleSection shopDomain={shopDomain} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
