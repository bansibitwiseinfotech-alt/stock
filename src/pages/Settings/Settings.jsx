import React, {
  useEffect,
  useState,
} from "react";

import {
  Page,
  Layout,
  Card,
  FormLayout,
  Select,
  TextField,
  Button,
  Banner,
  Checkbox,
  Text,
  BlockStack,
} from "@shopify/polaris";

import LockedFeatureOverlay from "../../components/LockedFeatureOverlay";
import { fetchSubscription } from "../../services/subscriptionApi";
import {
  fetchEmailSettingsApi,
  saveEmailSettingsApi,
} from "../../services/appApi";

// ==================================================
// TIMEZONE OPTIONS
// ==================================================

const TIMEZONE_OPTIONS = [
  {
    label: "India Standard Time (Asia/Kolkata)",
    value: "Asia/Kolkata",
  },
  {
    label: "Eastern Time (America/New_York)",
    value: "America/New_York",
  },
  {
    label: "Central Time (America/Chicago)",
    value: "America/Chicago",
  },
  {
    label: "Mountain Time (America/Denver)",
    value: "America/Denver",
  },
  {
    label: "Pacific Time (America/Los_Angeles)",
    value: "America/Los_Angeles",
  },
  {
    label: "UK Time (Europe/London)",
    value: "Europe/London",
  },
  {
    label: "Central European Time (Europe/Paris)",
    value: "Europe/Paris",
  },
  {
    label: "Japan Standard Time (Asia/Tokyo)",
    value: "Asia/Tokyo",
  },
  {
    label: "Gulf Standard Time (Asia/Dubai)",
    value: "Asia/Dubai",
  },
  {
    label: "Singapore Time (Asia/Singapore)",
    value: "Asia/Singapore",
  },
  {
    label:
      "Australian Eastern Time (Australia/Sydney)",
    value: "Australia/Sydney",
  },
];

// ==================================================
// TIME OPTIONS
// ==================================================

const TIME_OPTIONS = [
  {
    label: "06:00 AM",
    value: "06:00",
  },
  {
    label: "07:00 AM",
    value: "07:00",
  },
  {
    label: "08:00 AM",
    value: "08:00",
  },
  {
    label: "08:30 AM",
    value: "08:30",
  },
  {
    label: "09:00 AM",
    value: "09:00",
  },
  {
    label: "09:30 AM",
    value: "09:30",
  },
  {
    label: "10:00 AM",
    value: "10:00",
  },
  {
    label: "10:30 AM",
    value: "10:30",
  },
  {
    label: "11:00 AM",
    value: "11:00",
  },
  {
    label: "12:00 PM",
    value: "12:00",
  },
  {
    label: "01:00 PM",
    value: "13:00",
  },
  {
    label: "02:00 PM",
    value: "14:00",
  },
  {
    label: "02:30 PM",
    value: "14:30",
  },
  {
    label: "03:00 PM",
    value: "15:00",
  },
  {
    label: "04:00 PM",
    value: "16:00",
  },
  {
    label: "05:00 PM",
    value: "17:00",
  },
  {
    label: "06:00 PM",
    value: "18:00",
  },
  {
    label: "07:00 PM",
    value: "19:00",
  },
  {
    label: "08:00 PM",
    value: "20:00",
  },
  {
    label: "09:00 PM",
    value: "21:00",
  },
  {
    label: "10:00 PM",
    value: "22:00",
  },
];

// ==================================================
// DAY OPTIONS
// ==================================================

const DAY_OPTIONS = [
  {
    label: "Monday",
    value: "monday",
  },
  {
    label: "Tuesday",
    value: "tuesday",
  },
  {
    label: "Wednesday",
    value: "wednesday",
  },
  {
    label: "Thursday",
    value: "thursday",
  },
  {
    label: "Friday",
    value: "friday",
  },
  {
    label: "Saturday",
    value: "saturday",
  },
  {
    label: "Sunday",
    value: "sunday",
  },
];

// ==================================================
// SETTINGS PAGE
// ==================================================

export default function Settings({
  shopDomain = "",
}) {
  const [
    emailSettings,
    setEmailSettings,
  ] = useState({
    email: "",
    weeklyDigestEnabled: true,
    weeklyDigestDay: "tuesday",
    weeklyDigestTime: "09:00",
    timezone: "Asia/Kolkata",
  });

  const [
    savingEmail,
    setSavingEmail,
  ] = useState(false);

  const [
    loadingEmail,
    setLoadingEmail,
  ] = useState(true);

  const [
    emailMessage,
    setEmailMessage,
  ] = useState("");

  // ==================================================
  // LOAD SETTINGS
  // ==================================================

  const [currentPlan, setCurrentPlan] = useState("free");

  useEffect(() => {
    if (shopDomain) {
      fetchSubscription(shopDomain)
        .then((data) => {
          if (data?.subscription?.plan) {
            setCurrentPlan(data.subscription.plan.toLowerCase());
          }
        })
        .catch(() => null);
    }
  }, [shopDomain]);

  useEffect(() => {
    const loadEmailSettings =
      async () => {
        if (!shopDomain) {
          setLoadingEmail(false);
          return;
        }

        try {
          setLoadingEmail(true);

          const emailRes =
            await fetchEmailSettingsApi(
              shopDomain
            );

          if (emailRes) {
            setEmailSettings({
              email:
                emailRes.email || "",

              weeklyDigestEnabled:
                emailRes.weeklyDigestEnabled !==
                false,

              weeklyDigestDay:
                emailRes.weeklyDigestDay ||
                "tuesday",

              weeklyDigestTime:
                emailRes.weeklyDigestTime ||
                "09:00",

              timezone:
                emailRes.timezone ||
                "Asia/Kolkata",
            });
          }
        } catch (error) {
          console.error(
            "Failed to load email settings:",
            error
          );

          // New merchant can start
          // with default settings.
          setEmailSettings({
            email: "",
            weeklyDigestEnabled: true,
            weeklyDigestDay: "tuesday",
            weeklyDigestTime: "09:00",
            timezone: "Asia/Kolkata",
          });
        } finally {
          setLoadingEmail(false);
        }
      };

    loadEmailSettings();
  }, [shopDomain]);

  // ==================================================
  // SAVE SETTINGS
  // ==================================================

  const handleSaveEmailSettings =
    async () => {
      try {
        setSavingEmail(true);
        setEmailMessage("");

        if (!shopDomain) {
          throw new Error(
            "Shop domain is missing"
          );
        }

        if (
          !emailSettings.email.trim()
        ) {
          throw new Error(
            "Please enter merchant email address"
          );
        }

        await saveEmailSettingsApi({
          shop: shopDomain,

          email:
            emailSettings.email.trim(),

          weeklyDigestEnabled:
            emailSettings.weeklyDigestEnabled,

          weeklyDigestDay:
            emailSettings.weeklyDigestDay,

          weeklyDigestTime:
            emailSettings.weeklyDigestTime,

          timezone:
            emailSettings.timezone,
        });

        setEmailMessage(
          "Email digest settings saved successfully!"
        );
      } catch (error) {
        setEmailMessage(
          error.message ||
            "Failed to save email settings."
        );
      } finally {
        setSavingEmail(false);
      }
    };

  // ==================================================
  // UPDATE HELPER
  // ==================================================

  const updateEmailSetting = (
    key,
    value
  ) => {
    setEmailSettings(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
  };

  // ==================================================
  // UI
  // ==================================================

  return (
    <Page
      fullWidth
      title="Settings"
      subtitle="Manage your weekly inventory email digest preferences."
    >
      <Layout>
        {emailMessage && (
          <Layout.Section>
            <Banner
              tone={
                emailMessage.includes(
                  "successfully"
                )
                  ? "success"
                  : "critical"
              }
              onDismiss={() =>
                setEmailMessage("")
              }
            >
              <p>
                {emailMessage}
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <div style={{ position: "relative", minHeight: "360px" }}>
              {currentPlan !== "premium" && (
                <LockedFeatureOverlay requiredPlan="Premium" />
              )}
              <BlockStack gap="500">
              <BlockStack gap="200">
                <Text
                  variant="headingMd"
                  as="h2"
                >
                  Weekly Inventory Digest
                </Text>

                <Text
                  variant="bodySm"
                  tone="subdued"
                  as="p"
                >
                  Receive an automated
                  weekly inventory digest
                  containing cash at risk,
                  dead stock, and stockout
                  warnings.
                </Text>
              </BlockStack>

              <FormLayout>
                {/* ENABLE */}

                <Checkbox
                  label="Enable Weekly Digest"
                  checked={
                    emailSettings.weeklyDigestEnabled
                  }
                  onChange={(value) =>
                    updateEmailSetting(
                      "weeklyDigestEnabled",
                      value
                    )
                  }
                />

                {/* EMAIL */}

                <TextField
                  label="Email Address"
                  value={
                    emailSettings.email
                  }
                  onChange={(value) =>
                    updateEmailSetting(
                      "email",
                      value
                    )
                  }
                  placeholder="merchant@example.com"
                  autoComplete="email"
                  type="email"
                  helpText="The weekly digest will be sent to this email address."
                />

                {/* DAY */}

                <Select
                  label="Digest Day"
                  options={DAY_OPTIONS}
                  value={
                    emailSettings.weeklyDigestDay
                  }
                  onChange={(value) =>
                    updateEmailSetting(
                      "weeklyDigestDay",
                      value
                    )
                  }
                  helpText="Choose any day from Monday to Sunday."
                />

                {/* TIME */}

                <Select
                  label="Digest Time"
                  options={TIME_OPTIONS}
                  value={
                    emailSettings.weeklyDigestTime
                  }
                  onChange={(value) =>
                    updateEmailSetting(
                      "weeklyDigestTime",
                      value
                    )
                  }
                  helpText="The email will be sent once per week at this local time."
                />

                {/* TIMEZONE */}

                <Select
                  label="Timezone"
                  options={
                    TIMEZONE_OPTIONS
                  }
                  value={
                    emailSettings.timezone
                  }
                  onChange={(value) =>
                    updateEmailSetting(
                      "timezone",
                      value
                    )
                  }
                  helpText="The selected time is interpreted in this timezone."
                />

                {/* SAVE */}

                <Button
                  variant="primary"
                  loading={savingEmail}
                  disabled={loadingEmail}
                  onClick={
                    handleSaveEmailSettings
                  }
                >
                  Save Email Settings
                </Button>
              </FormLayout>
            </BlockStack>
          </div>
        </Card>
      </Layout.Section>
      </Layout>
    </Page>
  );
}