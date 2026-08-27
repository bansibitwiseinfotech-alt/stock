import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Page,
  Layout,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Box,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  Card,
  Grid,
  Divider,
} from "@shopify/polaris";
import {
  fetchSubscription,
  upgradeSubscriptionApi,
  switchFreeApi,
  verifySubscriptionApi,
   } from "../../services/subscriptionApi";
import { BILLING_PLANS } from "../../config/billingPlans";
import CurrentPlanCard from "../../components/Billing/CurrentPlanCard";
import PlanCard from "../../components/Billing/PlanCard";
import ChangePlanModal from "../../components/Billing/ChangePlanModal";
import SwitchFreeModal from "../../components/Billing/SwitchFreeModal";

export default function BillingPlans({ shopDomain = "" }) {
  const comparisonSectionRef = useRef(null);

  // Extract shop from prop or fallback to URL query parameters
  const [shop] = useState(() => {
    if (shopDomain) return shopDomain;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return (
        params.get("shop") ||
        window?.shopify?.config?.shop ||
        ""
      );
    }
    return "";
  });

  // 1. BILLING CYCLE STATE: "monthly" (default) or "yearly"
  const [billingCycle, setBillingCycle] = useState("monthly");

  // Subscription state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscription, setSubscription] = useState(null);

  // URL query parameter feedback banners
  const [urlBanner, setUrlBanner] = useState(null);

  // Modals state
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState("pro");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState(null);

  const [switchFreeModalOpen, setSwitchFreeModalOpen] = useState(false);
  const [switchFreeLoading, setSwitchFreeLoading] = useState(false);
  const [switchFreeError, setSwitchFreeError] = useState(null);

  // Fetch / verify subscription from backend
  const loadSubscriptionData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let urlChargeId = "";
      let urlPlan = "";
      let urlCycle = "";
      let billingStatus = "";

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        urlChargeId = params.get("charge_id") || "";
        urlPlan = params.get("plan") || "";
        urlCycle = params.get("cycle") || "";
        billingStatus = params.get("billing") || "";
      }

      let data;
      // If returning from Shopify approval callback
      if (urlChargeId || billingStatus === "confirm" || billingStatus === "success") {
        try {
          data = await verifySubscriptionApi({
            shop,
            charge_id: urlChargeId,
            plan: urlPlan,
            billingCycle: urlCycle || "monthly",
          });
        } catch {
          data = await fetchSubscription(shop);
        }
      } else {
        data = await fetchSubscription(shop);
      }

      if (data?.success && data?.subscription) {
        setSubscription(data.subscription);
      } else {
        throw new Error(data?.message || "Failed to load subscription details.");
      }
    } catch (err) {
      console.error("[BillingPlans] Fetch Error:", err);
      setError(
        err.message || "Failed to load billing and subscription information."
      );
    } finally {
      setLoading(false);
    }
  }, [shop]);

  // Handle URL banners and initial fetch
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const billingStatus = params.get("billing");
      const approvedPlan = params.get("plan");

      if (billingStatus === "success" || billingStatus === "confirm") {
        setUrlBanner({
          tone: "success",
          title: "Subscription Activated",
          message: approvedPlan
            ? `Your Smart Stock ${approvedPlan.toUpperCase()} plan is now active.`
            : "Your plan upgrade was successfully verified and is now active.",
        });
      } else if (billingStatus === "free") {
        setUrlBanner({
          tone: "info",
          title: "Switched to Free Plan",
          message: "Your subscription has been switched to the Free Plan.",
        });
      } else if (billingStatus === "cancelled") {
        setUrlBanner({
          tone: "warning",
          title: "Upgrade Cancelled",
          message:
            "Plan upgrade was cancelled. Your current plan remains unchanged.",
        });
      } else if (billingStatus === "error") {
        setUrlBanner({
          tone: "critical",
          title: "Subscription Error",
          message:
            "Unable to verify Shopify subscription charge. Please try again.",
        });
      }
    }

    loadSubscriptionData();
  }, [loadSubscriptionData]);

  // Open upgrade modal
  const handleOpenUpgrade = (planId) => {
    const targetPlan = planId && planId !== "free" ? planId : "pro";
    setSelectedPlanForUpgrade(targetPlan);
    setUpgradeError(null);
    setChangePlanModalOpen(true);
  };

  // Submit upgrade to Shopify GraphQL checkout
  const handleConfirmUpgrade = async ({ plan, billingCycle: cycle }) => {
    setUpgradeLoading(true);
    setUpgradeError(null);
    try {
      const result = await upgradeSubscriptionApi({
        shop,
        plan,
        billingCycle: cycle,
      });

      if (result?.confirmationUrl) {
        // Break out of Shopify Admin iframe for top-level approval
        if (typeof window !== "undefined") {
          if (window.top) {
            window.top.location.href = result.confirmationUrl;
          } else {
            window.location.assign(result.confirmationUrl);
          }
        }
      } else {
        throw new Error("No confirmation URL received from Shopify.");
      }
    } catch (err) {
      console.error("[Billing Upgrade Error]:", err);
      setUpgradeError(
        err.message || "Failed to initiate Shopify subscription checkout."
      );
      setUpgradeLoading(false);
    }
  };

  // Open Switch to Free modal
  const handleOpenSwitchFree = () => {
    setSwitchFreeError(null);
    setSwitchFreeModalOpen(true);
  };

  // Submit switch to free
  const handleConfirmSwitchFree = async () => {
    setSwitchFreeLoading(true);
    setSwitchFreeError(null);
    try {
      await switchFreeApi(shop);
      setSwitchFreeModalOpen(false);
      setUrlBanner({
        tone: "info",
        title: "Switched to Free Plan",
        message: "Your subscription has been switched to the Free Plan.",
      });
      await loadSubscriptionData();
    } catch (err) {
      console.error("[Billing Switch Free Error]:", err);
      setSwitchFreeError(
        err.message || "Failed to cancel paid subscription."
      );
    } finally {
      setSwitchFreeLoading(false);
    }
  };

  const scrollToComparison = () => {
    if (comparisonSectionRef.current) {
      comparisonSectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Skeleton loading state
  if (loading && !subscription) {
    return (
      <SkeletonPage title="Billing & Plans" primaryAction fullWidth>
        <Layout>
          <Layout.Section>
            <Grid columns={{ xs: 1, sm: 3, md: 3, lg: 3, xl: 3 }}>
              {[1, 2, 3].map((i) => (
                <Grid.Cell key={i}>
                  <Card>
                    <BlockStack gap="300">
                      <SkeletonDisplayText size="small" />
                      <SkeletonBodyText lines={2} />
                    </BlockStack>
                  </Card>
                </Grid.Cell>
              ))}
            </Grid>
          </Layout.Section>
          <Layout.Section>
            <Grid columns={{ xs: 1, sm: 2, md: 2, lg: 4, xl: 4 }}>
              {[1, 2, 3, 4].map((i) => (
                <Grid.Cell key={i}>
                  <Card>
                    <BlockStack gap="300">
                      <SkeletonDisplayText size="small" />
                      <SkeletonBodyText lines={6} />
                    </BlockStack>
                  </Card>
                </Grid.Cell>
              ))}
            </Grid>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  const currentPlanId = subscription?.plan || "free";

  return (
    <Page
      title="Billing & Plans"
      subtitle="Manage your Smart Stock subscription and unlock more inventory automation features."
      fullWidth
    >
      <BlockStack gap="600">
        {/* 1. URL FEEDBACK BANNER (SUCCESS / FREE / CANCELLED / ERROR) */}
        {urlBanner && (
          <Banner
            tone={urlBanner.tone}
            title={urlBanner.title}
            onDismiss={() => setUrlBanner(null)}
          >
            <p>{urlBanner.message}</p>
          </Banner>
        )}

        {/* 2. ERROR BANNER */}
        {error && (
          <Banner
            tone="critical"
            title="Unable to load subscription"
            action={{ content: "Retry", onAction: loadSubscriptionData }}
          >
            <p>{error}</p>
          </Banner>
        )}

        {/* 3. CURRENT PLAN DASHBOARD */}
        <CurrentPlanCard
          subscription={subscription}
          onUpgradeClick={scrollToComparison}
        />

        {/* 4. PLAN COMPARISON HEADER & ACCESSIBLE MONTHLY / YEARLY TOGGLE */}
        <Box paddingTop="300" ref={comparisonSectionRef}>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="050">
              <Text variant="headingLg" as="h2" fontWeight="bold">
                Available Subscription Tiers
              </Text>
              <Text variant="bodyMd" tone="subdued" as="p">
                Choose the right plan to scale your store's inventory velocity and dead-stock recovery.
              </Text>
            </BlockStack>

            {/* MONTHLY / YEARLY BILLING TOGGLE */}
            <div
              role="group"
              aria-label="Billing cycle selector"
              style={{
                display: "inline-flex",
                alignItems: "center",
                backgroundColor: "#f1f2f3",
                borderRadius: "8px",
                padding: "4px",
                border: "1px solid #e1e3e5",
              }}
            >
              <button
                type="button"
                role="radio"
                aria-checked={billingCycle === "monthly"}
                onClick={() => setBillingCycle("monthly")}
                style={{
                  background: billingCycle === "monthly" ? "#ffffff" : "transparent",
                  color: billingCycle === "monthly" ? "#202223" : "#6d7175",
                  fontWeight: billingCycle === "monthly" ? "600" : "500",
                  fontSize: "13px",
                  padding: "6px 14px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  boxShadow:
                    billingCycle === "monthly"
                      ? "0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)"
                      : "none",
                  transition: "all 0.15s ease-in-out",
                  outline: "none",
                }}
              >
                Monthly
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={billingCycle === "yearly"}
                onClick={() => setBillingCycle("yearly")}
                style={{
                  background: billingCycle === "yearly" ? "#ffffff" : "transparent",
                  color: billingCycle === "yearly" ? "#202223" : "#6d7175",
                  fontWeight: billingCycle === "yearly" ? "600" : "500",
                  fontSize: "13px",
                  padding: "6px 14px",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  boxShadow:
                    billingCycle === "yearly"
                      ? "0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)"
                      : "none",
                  transition: "all 0.15s ease-in-out",
                  outline: "none",
                }}
              >
                Yearly (Save ~17%)
              </button>
            </div>
          </InlineStack>
        </Box>

        {/* 5. 4-TIER RESPONSIVE PLAN CARDS */}
        <Grid columns={{ xs: 1, sm: 2, md: 2, lg: 4, xl: 4 }}>
          {BILLING_PLANS.map((plan) => (
            <Grid.Cell key={plan.id}>
              <PlanCard
                plan={plan}
                currentPlanId={currentPlanId}
                billingCycle={billingCycle}
                onSelectUpgrade={handleOpenUpgrade}
                onSelectSwitchFree={handleOpenSwitchFree}
              />
            </Grid.Cell>
          ))}
        </Grid>

        {/* 6. FAQ SECTION */}
        <Box paddingBlock="300">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3" fontWeight="bold">
                Frequently Asked Questions
              </Text>
              <Divider />
              <Grid columns={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2 }}>
                <Grid.Cell>
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="h4">
                      How do usage limits work?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Limits are counted only upon successful creation of an automation (e.g. a clearance sale or bundle). Viewing, editing, or deleting existing setups never consumes usage.
                    </Text>
                  </BlockStack>
                </Grid.Cell>
                <Grid.Cell>
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="h4">
                      Can I upgrade, downgrade, or cancel anytime?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Yes. All plan upgrades take effect immediately and are securely billed through Shopify's standard Subscription API. Switching to Free cancels your active recurring charge instantly.
                    </Text>
                  </BlockStack>
                </Grid.Cell>
              </Grid>
            </BlockStack>
          </Card>
        </Box>
      </BlockStack>

      {/* CHANGE YOUR PLAN MODAL */}
      <ChangePlanModal
        open={changePlanModalOpen}
        onClose={() => setChangePlanModalOpen(false)}
        initialPlan={selectedPlanForUpgrade}
        billingCycle={billingCycle}
        currentPlanId={currentPlanId}
        onConfirmUpgrade={handleConfirmUpgrade}
        loading={upgradeLoading}
        error={upgradeError}
      />

      {/* SWITCH TO FREE WARNING MODAL */}
      <SwitchFreeModal
        open={switchFreeModalOpen}
        onClose={() => setSwitchFreeModalOpen(false)}
        currentPlanId={currentPlanId}
        onConfirmSwitch={handleConfirmSwitchFree}
        loading={switchFreeLoading}
        error={switchFreeError}
      />
    </Page>
  );
}
