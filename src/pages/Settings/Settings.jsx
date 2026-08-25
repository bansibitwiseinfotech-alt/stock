import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  Select,
  TextField,
  Button,
  Banner,
} from "@shopify/polaris";
import { fetchSettingsData, saveSettingsApi } from "../../services/appApi";

export default function Settings({ shopDomain = "" }) {
  const [settings, setSettings] = useState({
    deadStockThresholdDays: 60,
    lowStockThresholdUnits: 5,
    stockoutPredictionDays: 7,
    markdownRule: "10% every 14 days",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchSettingsData(shopDomain);
        if (res) setSettings(res);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [shopDomain]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSettingsApi(shopDomain, settings);
      setMessage("Settings saved successfully!");
    } catch (err) {
      setMessage("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      fullWidth
      title="Settings"
      subtitle="Manage your inventory threshold rules and automation preferences."
    >
      <Layout>
        {message && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setMessage("")}>
              <p>{message}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <FormLayout>
              <Select
                label="Dead Stock Threshold (No Sales)"
                options={[
                  { label: "30 Days", value: "30" },
                  { label: "60 Days", value: "60" },
                  { label: "90 Days", value: "90" },
                ]}
                value={String(settings.deadStockThresholdDays)}
                onChange={(val) => setSettings({ ...settings, deadStockThresholdDays: Number(val) })}
              />

              <Select
                label="Low Stock Threshold"
                options={[
                  { label: "3 Items", value: "3" },
                  { label: "5 Items", value: "5" },
                  { label: "10 Items", value: "10" },
                ]}
                value={String(settings.lowStockThresholdUnits)}
                onChange={(val) => setSettings({ ...settings, lowStockThresholdUnits: Number(val) })}
              />

              <Select
                label="Stockout Prediction Days"
                options={[
                  { label: "5 Days", value: "5" },
                  { label: "7 Days", value: "7" },
                  { label: "14 Days", value: "14" },
                ]}
                value={String(settings.stockoutPredictionDays)}
                onChange={(val) => setSettings({ ...settings, stockoutPredictionDays: Number(val) })}
              />

              <TextField
                label="Markdown Rule"
                value={settings.markdownRule}
                onChange={(val) => setSettings({ ...settings, markdownRule: val })}
                autoComplete="off"
              />

              <Button variant="primary" loading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </FormLayout>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
