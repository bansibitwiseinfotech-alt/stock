import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Button,
  Text,
} from "@shopify/polaris";
import { fetchAutomationsData, toggleAutomationApi } from "../../services/appApi";

export default function Automations({ shopDomain = "" }) {
  const [automations, setAutomations] = useState([
    { _id: "1", name: "Low Stock Badge", trigger: "Stock ≤ 5", action: "Show badge on product", enabled: true },
    { _id: "2", name: "Pre-Order on Out of Stock", trigger: "Stock = 0", action: "Enable pre-order button", enabled: true },
    { _id: "3", name: "Progressive Markdown", trigger: "No sale 30 days", action: "10% discount every 14 days", enabled: true },
    { _id: "4", name: "Add to Clearance Collection", trigger: "No sale 60 days", action: "Add to clearance collection", enabled: true },
  ]);

  const loadData = async () => {
    try {
      const data = await fetchAutomationsData(shopDomain);
      if (data && data.length > 0) setAutomations(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopDomain]);

  const handleToggle = async (item) => {
    try {
      const nextState = !item.enabled;
      await toggleAutomationApi(shopDomain, item._id, nextState);
      setAutomations((prev) => prev.map((a) => (a._id === item._id ? { ...a, enabled: nextState } : a)));
    } catch (err) {
      alert(err.message);
    }
  };

  const resourceName = { singular: "automation", plural: "automations" };

  const rowMarkup = automations.map((item, index) => (
    <IndexTable.Row id={item._id} key={item._id} position={index}>
      <IndexTable.Cell><Text variant="bodyMd" fontWeight="bold" as="span">{item.name}</Text></IndexTable.Cell>
      <IndexTable.Cell>{item.trigger}</IndexTable.Cell>
      <IndexTable.Cell>{item.action}</IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          onClick={() => handleToggle(item)}
          variant={item.enabled ? "primary" : "secondary"}
          tone={item.enabled ? "success" : undefined}
        >
          {item.enabled ? "● ON" : "○ OFF"}
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Automations"
      subtitle="Automate actions to save time and increase storefront conversions."
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={automations.length}
              headings={[
                { title: "NAME" },
                { title: "TRIGGER" },
                { title: "ACTION" },
                { title: "STATUS" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
