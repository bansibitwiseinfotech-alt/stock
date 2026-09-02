import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
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
  Modal,
  Badge,
  List,
  TextField,
  Button,
} from "@shopify/polaris";
import {
  fetchSubscription,
  upgradeSubscriptionApi,
  switchFreeApi,
  verifySubscriptionApi,
} from "../../services/subscriptionApi";
import { submitContactSupportApi } from "../../services/appApi";
import { BILLING_PLANS } from "../../config/billingPlans";
import PlanCard from "../../components/Billing/PlanCard";
import ChangePlanModal from "../../components/Billing/ChangePlanModal";
import SwitchFreeModal from "../../components/Billing/SwitchFreeModal";

export default function BillingPlans({ shopDomain = "" }) {
  const navigate = useNavigate();
  const comparisonSectionRef = useRef(null);

  const navigateWithParams = (path) => {
    if (!path) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    const target = search && !path.includes("?") ? `${path}${search}` : path;
    navigate(target);
  };

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

  // Privacy Policy, Terms & Contact Support modals state
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [termsConditionsOpen, setTermsConditionsOpen] = useState(false);
  const [contactSupportOpen, setContactSupportOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportError, setSupportError] = useState(null);

  const handleSupportSubmit = async (e) => {
    if (e) e.preventDefault();
    setSupportError(null);
    if (!supportEmail.trim()) {
      setSupportError("Please enter a valid contact email address.");
      return;
    }
    if (!supportSubject.trim()) {
      setSupportError("Please enter a subject.");
      return;
    }
    if (!supportMessage.trim()) {
      setSupportError("Please describe your issue or inquiry.");
      return;
    }
    try {
      setSupportLoading(true);
      await submitContactSupportApi({
        shop,
        name: supportName.trim(),
        email: supportEmail.trim(),
        category: "general",
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
      });
      setSupportSuccess(true);
      setSupportSubject("");
      setSupportMessage("");
    } catch (err) {
      console.error("Failed to submit support request:", err);
      setSupportError(err.message || "Failed to submit support request. Please try again.");
    } finally {
      setSupportLoading(false);
    }
  };

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
          try {
            if (window.shopify?.navigation?.open) {
              window.shopify.navigation.open(result.confirmationUrl, "_top");
              return;
            }
          } catch (e) {
            console.warn("shopify.navigation.open failed:", e);
          }

          try {
            if (typeof open === "function") {
              open(result.confirmationUrl, "_top");
              return;
            }
          } catch (e) {
            console.warn("open(_top) failed:", e);
          }

          try {
            if (typeof window.open === "function") {
              window.open(result.confirmationUrl, "_top");
              return;
            }
          } catch (e) {
            console.warn("window.open(_top) failed:", e);
          }

          try {
            if (window.top) {
              window.top.location.href = result.confirmationUrl;
            } else {
              window.location.href = result.confirmationUrl;
            }
          } catch (e) {
            window.location.href = result.confirmationUrl;
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
      <BlockStack gap="400">
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

        {/* 4. ACCESSIBLE MONTHLY / YEARLY TOGGLE */}
        <Box ref={comparisonSectionRef}>
          <div className="billing-cycle-wrapper">
            {/* MONTHLY / YEARLY BILLING TOGGLE */}
            <div
              role="group"
              aria-label="Billing cycle selector"
              className="billing-cycle-selector"
            >
              <button
                type="button"
                role="radio"
                aria-checked={billingCycle === "monthly"}
                onClick={() => setBillingCycle("monthly")}
                className={`billing-cycle-btn ${billingCycle === "monthly" ? "billing-cycle-btn--active" : ""}`}
              >
                Monthly
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={billingCycle === "yearly"}
                onClick={() => setBillingCycle("yearly")}
                className={`billing-cycle-btn ${billingCycle === "yearly" ? "billing-cycle-btn--active" : ""}`}
              >
                Yearly
              </button>
            </div>
          </div>
        </Box>

        {/* MOBILE PLAN QUICK JUMP PILLS */}
        <div className="billing-mobile-plan-pills">
          {BILLING_PLANS.map((p) => {
            const isCurr = String(currentPlanId).toLowerCase() === String(p.id).toLowerCase();
            return (
              <button
                key={p.id}
                type="button"
                className={`billing-mobile-pill ${isCurr ? "billing-mobile-pill--current" : ""}`}
                onClick={() => {
                  const el = document.getElementById(`billing-plan-${p.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
              >
                {p.name} {isCurr ? "✓" : ""}
              </button>
            );
          })}
        </div>

        {/* 5. 4-TIER RESPONSIVE PLAN CARDS */}
        <div className="billing-plans-grid-container">
          <Grid columns={{ xs: 1, sm: 2, md: 2, lg: 4, xl: 4 }}>
            {BILLING_PLANS.map((plan) => (
              <Grid.Cell key={plan.id}>
                <div id={`billing-plan-${plan.id}`} style={{ scrollMarginTop: "24px", height: "100%" }}>
                  <PlanCard
                    plan={plan}
                    currentPlanId={currentPlanId}
                    currentBillingCycle={subscription?.billingCycle || "monthly"}
                    billingCycle={billingCycle}
                    onSelectUpgrade={handleOpenUpgrade}
                    onSelectSwitchFree={handleOpenSwitchFree}
                  />
                </div>
              </Grid.Cell>
            ))}
          </Grid>
        </div>

        {/* 6. BILLING FOOTER */}
        <Box paddingBlockStart="600" paddingBlockEnd="400">
          <div className="billing-footer-wrapper">
            <div className="billing-footer-copy">
              © {new Date().getFullYear()} <span style={{ fontWeight: "600", color: "#202223" }}>Smart Stock</span>. All rights reserved. Managed via Shopify Billing.
            </div>

            <div className="billing-footer-links">
              <a
                href="#privacy-policy"
                onClick={(e) => {
                  e.preventDefault();
                  setPrivacyPolicyOpen(true);
                }}
                className="billing-footer-link"
              >
                Privacy Policy
              </a>
              <span className="billing-footer-pipe">•</span>
              <a
                href="#terms-and-conditions"
                onClick={(e) => {
                  e.preventDefault();
                  setTermsConditionsOpen(true);
                }}
                className="billing-footer-link"
              >
                Terms & Conditions
              </a>
              <span className="billing-footer-pipe">•</span>
              <a
                href="#contact-support"
                onClick={(e) => {
                  e.preventDefault();
                  setContactSupportOpen(true);
                }}
                className="billing-footer-link"
              >
                Contact Support
              </a>
            </div>
          </div>
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

      {/* PRIVACY POLICY MODAL */}
      <Modal
        open={privacyPolicyOpen}
        onClose={() => setPrivacyPolicyOpen(false)}
        title="Privacy Policy — Smart Stock"
        size="large"
        primaryAction={{
          content: "Close",
          onAction: () => setPrivacyPolicyOpen(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Header */}
            <BlockStack gap="100">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingLg">
                  Smart Stock Privacy Policy
                </Text>
                {/* <Badge tone="success">Active</Badge> */}
              </InlineStack>
              <Text as="p" tone="subdued" variant="bodySm">
                Last Updated: September 1, 2026
              </Text>
            </BlockStack>

            <Text as="p">
              This Privacy Policy describes how <strong>Smart Stock</strong> ("we", "us", or "our") collects, uses, stores, and shares your information when you install and use our Shopify App. This app is developed and operated by <strong>Bitwise Infotech</strong>, located in Rajkot, Gujarat, India.
            </Text>

            <Divider />

            {/* 1. Information We Collect */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">1. Information We Collect</Text>
              <Text as="p">
                When you install and use the App, we may access and collect certain information from your Shopify store, including:
              </Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    <strong>Store Information:</strong> Shop domain, store name, email address, subscription plan details, and billing information.
                  </List.Item>
                  <List.Item>
                    <strong>Product &amp; Inventory Data:</strong> Product IDs, titles, variant IDs, SKUs, inventory quantities, prices, and cost per item required to power dead-stock detection, clearance automation, and storefront badge widgets.
                  </List.Item>
                  <List.Item>
                    <strong>Order &amp; Sales History:</strong> Order line items, fulfillment status, and timestamps used strictly to compute inventory velocity and days without sales.
                  </List.Item>
                  <List.Item>
                    <strong>Merchant Configuration:</strong> Custom discount thresholds, badge text, styling preferences, email digest schedules, and selected subscription tier.
                  </List.Item>
                  <List.Item>
                    <strong>Analytics Data:</strong> Widget interaction metrics including widget views, clicks, and conversion interactions to analyze app performance.
                  </List.Item>
                </List>
              </Box>
              <Text as="p" tone="subdued" variant="bodySm">
                Smart Stock only accesses the minimum Shopify store data necessary to provide app functionality.
              </Text>
            </BlockStack>

            <Divider />

            {/* 2. How We Use Your Information */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">2. How We Use Your Information</Text>
              <Text as="p">We use the information we collect to:</Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    <strong>Dead Stock Detection:</strong> Identify SKUs with 30+, 60+, or 90+ days without sales and calculate tied-up working capital.
                  </List.Item>
                  <List.Item>
                    <strong>High Demand &amp; Stockout Alerts:</strong> Analyze sales velocity to predict imminent stockouts and calculate revenue at risk.
                  </List.Item>
                  <List.Item>
                    <strong>Clearance &amp; Pre-Order Automation:</strong> Generate automated clearance discounts, BOGO bundles, progressive markdowns, and storefront pre-order badges.
                  </List.Item>
                  <List.Item>
                    <strong>Weekly Inventory Digests:</strong> Deliver scheduled performance emails with cash recovered, dead-stock counts, and stockout warnings.
                  </List.Item>
                  <List.Item>
                    <strong>Subscription Management:</strong> Manage app plan quotas, billing cycles, and feature access via Shopify Billing API.
                  </List.Item>
                  <List.Item>
                    Detect, prevent, and mitigate fraud, security incidents, and unauthorized use of the Service.
                  </List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 3. What We Do Not Use, Store, or Share */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">3. What We Do Not Use, Store, or Share</Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    We do not sell, rent, share, or use merchant or customer data for advertising, profiling, or unrelated purposes. All access is limited to functionality required by the Shopify App.
                  </List.Item>
                  <List.Item>
                    We do not collect or store your customers' payment card information.
                  </List.Item>
                  <List.Item>
                    We do not use customer data for advertising, profiling, resale, or independent marketing purposes.
                  </List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 4. Sharing Your Information */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">4. Sharing Your Information</Text>
              <Text as="p">We may share information only with:</Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    <strong>Shopify:</strong> To comply with Shopify platform requirements, billing APIs, and authentication services.
                  </List.Item>
                  <List.Item>
                    <strong>Service Providers:</strong> Trusted third-party vendors including cloud hosting providers, MongoDB database services, and analytics providers.
                  </List.Item>
                  <List.Item>
                    <strong>Legal Requirements:</strong> When required by law, regulation, legal process, or governmental request.
                  </List.Item>
                </List>
              </Box>
              <Text as="p" tone="subdued" variant="bodySm">
                All service providers are authorized to process information only as necessary to provide services on our behalf and are required to maintain appropriate confidentiality and security measures.
              </Text>
            </BlockStack>

            <Divider />

            {/* 5. Your Rights */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">5. Your Rights</Text>
              <Text as="p">
                Depending on your location and applicable laws, you may have the right to access personal information we hold about you, request correction of inaccurate information, or request deletion of your information. For users in the EEA, UK, and similar jurisdictions, we process personal data under legitimate interests and contractual necessity required to provide the Service.
              </Text>
              <Text as="p">
                To request deletion of your information, contact{" "}
                <a href="mailto:support@bitwiseinfotech.com" style={{ color: "#008060", fontWeight: "600", textDecoration: "none" }}>
                  support@bitwiseinfotech.com
                </a>. We will respond within a reasonable timeframe.
              </Text>
            </BlockStack>

            <Divider />

            {/* 6. Data Storage, Security & Retention */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">6. Data Storage, Security &amp; Retention</Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>
                    We securely store application data using trusted cloud infrastructure, including MongoDB databases.
                  </List.Item>
                  <List.Item>
                    Data is transmitted using encrypted HTTPS connections and access is restricted to authorized personnel.
                  </List.Item>
                  <List.Item>
                    We implement commercially reasonable security measures to protect information from unauthorized access or disclosure.
                  </List.Item>
                  <List.Item>
                    We retain your information while your shop is registered with the App and for up to <strong>45 days after uninstallation</strong> for backup recovery, fraud prevention, dispute resolution, and legal compliance. Merchant data is deleted or anonymized after the retention period unless retention is required by law.
                  </List.Item>
                  <List.Item>
                    Smart Stock fully complies with Shopify's mandatory GDPR/CCPA webhooks: <code>app/uninstalled</code>, <code>shop/redact</code>, <code>customers/data_request</code>, and <code>customers/redact</code>.
                  </List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 7. Changes to This Privacy Policy */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">7. Changes to This Privacy Policy</Text>
              <Text as="p">
                We may update this Privacy Policy from time to time to reflect changes in our practices or App functionality. Continued use of the App constitutes acceptance of the revised policy.
              </Text>
            </BlockStack>

            <Divider />

            {/* 8. Contact Us */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">8. Contact Us</Text>
              <Text as="p">
                If you have questions regarding this Privacy Policy, your store data, or would like to request explicit data deletion, please contact our support team:
              </Text>
              <Box
                padding="300"
                borderWidth="025"
                borderRadius="200"
                borderColor="border"
                background="bg-surface-secondary"
              >
                <BlockStack gap="100">
                  <Text as="p"><strong>App:</strong> Smart Stock</Text>
                  <Text as="p"><strong>Developer:</strong> Bitwise Infotech, Rajkot, Gujarat, India</Text>
                  <Text as="p">
                    <strong>Support Email:</strong>{" "}
                    <a href="mailto:support@bitwiseinfotech.com" style={{ color: "#008060", fontWeight: "600", textDecoration: "none" }}>
                      support@bitwiseinfotech.com
                    </a>
                  </Text>
                </BlockStack>
              </Box>
            </BlockStack>

          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* TERMS & CONDITIONS MODAL */}
      <Modal
        open={termsConditionsOpen}
        onClose={() => setTermsConditionsOpen(false)}
        title="Terms & Conditions — Smart Stock"
        size="large"
        primaryAction={{
          content: "Close",
          onAction: () => setTermsConditionsOpen(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Header */}
            <BlockStack gap="100">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingLg">
                  Smart Stock Terms & Conditions
                </Text>
              </InlineStack>
              <Text as="p" tone="subdued" variant="bodySm">
                Last Updated: September 1, 2026
              </Text>
            </BlockStack>

            <Text as="p">
              Please read these Terms of Service ("Terms") carefully before installing or using the <strong>Smart Stock</strong> Shopify App ("App" or "Service"). By installing, accessing, or using the App, you ("Merchant", "you", or "your") agree to be bound by these Terms. The Service is provided by <strong>Bitwise Infotech</strong>, located in Rajkot, Gujarat, India.
            </Text>

            <Divider />

            {/* 1. Acceptance of Terms */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">1. Acceptance of Terms</Text>
              <Text as="p">
                By installing Smart Stock through the Shopify App Store, you acknowledge that you have read, understood, and agreed to these Terms and our Privacy Policy.
              </Text>
            </BlockStack>

            <Divider />

            {/* 2. Description of Service */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">2. Description of Service</Text>
              <Text as="p">
                Smart Stock is a Shopify application designed to help merchants optimize inventory, eliminate dead stock, prevent stockouts, and maximize store profits through:
              </Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>Dead Stock Detection &amp; Tied-Up Capital Analysis</List.Item>
                  <List.Item>High Demand &amp; Stockout Alerts</List.Item>
                  <List.Item>Automated Clearance Sales &amp; Progressive Markdowns</List.Item>
                  <List.Item>Smart Badges (Clearance, Low Stock, Pre-Order)</List.Item>
                  <List.Item>Clearance Bundles (BOGO) &amp; Bulk Collection Sales</List.Item>
                  <List.Item>Weekly Inventory Digest Reports</List.Item>
                </List>
              </Box>
              <Text as="p" tone="subdued" variant="bodySm">
                We reserve the right to modify, improve, suspend, or discontinue any feature of the Service at any time.
              </Text>
            </BlockStack>

            <Divider />

            {/* 3. Merchant Responsibilities */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">3. Merchant Responsibilities</Text>
              <Text as="p">As a merchant using Smart Stock, you agree to:</Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>Comply with all applicable laws, regulations, and industry standards.</List.Item>
                  <List.Item>Comply with Shopify's Terms of Service and all applicable Shopify policies.</List.Item>
                  <List.Item>Ensure all products, pricing, discounts, and inventory information configured in the App are accurate and lawful.</List.Item>
                  <List.Item>Not reverse engineer, copy, decompile, modify, or attempt to extract source code from the App.</List.Item>
                  <List.Item>Not use the Service to upload malicious software, interfere with operation, or abuse functionality.</List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 4. Subscription, Billing & Plans */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">4. Subscription, Billing &amp; Plans</Text>
              <Text as="p">Smart Stock may offer free and paid subscription plans.</Text>
              <Text as="p">By subscribing to a paid plan:</Text>
              <Box paddingInlineStart="400">
                <List type="bullet">
                  <List.Item>You authorize Shopify to charge applicable fees through Shopify's Billing API.</List.Item>
                  <List.Item>Billing is processed exclusively through Shopify. We do not collect or store your payment card information.</List.Item>
                  <List.Item>Subscription charges are billed through Shopify and refunds are handled according to Shopify billing policies and applicable law.</List.Item>
                  <List.Item>We may modify pricing or features upon reasonable notice.</List.Item>
                </List>
              </Box>
            </BlockStack>

            <Divider />

            {/* 5. Intellectual Property */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">5. Intellectual Property</Text>
              <Text as="p">
                Smart Stock, including all software, source code, content, algorithms, designs, and functionality, is owned exclusively by Bitwise Infotech and its licensors. Merchants receive only a limited, non-exclusive, non-transferable, revocable license to use the App during an active subscription.
              </Text>
            </BlockStack>

            <Divider />

            {/* 6. Data Usage & Privacy */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">6. Data Usage &amp; Privacy</Text>
              <Text as="p">
                Your use of the Service is governed by our Privacy Policy. By using the App, you authorize us to access, process, store, and use Shopify store data (including catalog data, inventory levels, order velocity, and analytics) necessary to provide the Service.
              </Text>
            </BlockStack>

            <Divider />

            {/* 7. Data Storage & Security */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">7. Data Storage &amp; Security</Text>
              <Text as="p">
                To provide the Service, data may be stored using secure cloud infrastructure providers, including MongoDB. We implement commercially reasonable security measures, but we cannot guarantee absolute protection against all threats. Data is transmitted using encrypted HTTPS connections and access is restricted to authorized personnel.
              </Text>
            </BlockStack>

            <Divider />

            {/* 8. Third-Party Services */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">8. Third-Party Services</Text>
              <Text as="p">
                The Service relies on third-party providers including Shopify, MongoDB, cloud hosting providers, and transactional email providers. We are not responsible for outages or service failures caused by third-party providers beyond our reasonable control.
              </Text>
            </BlockStack>

            <Divider />

            {/* 9. Disclaimer of Warranties */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">9. Disclaimer of Warranties</Text>
              <Text as="p">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. We do not guarantee that the Service will be uninterrupted, error-free, or that inventory recovery results will meet specific revenue targets. Maintenance, upgrades, Shopify platform changes, or third-party provider outages may temporarily affect functionality.
              </Text>
            </BlockStack>

            <Divider />

            {/* 10. Limitation of Liability */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">10. Limitation of Liability</Text>
              <Text as="p">
                TO THE FULLEST EXTENT PERMITTED BY LAW, BITWISE INFOTECH SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE TOTAL SUBSCRIPTION FEES PAID BY YOU DURING THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
              </Text>
            </BlockStack>

            <Divider />

            {/* 11. Termination */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">11. Termination</Text>
              <Text as="p">
                We may suspend or terminate access to the Service immediately if you violate these Terms, if Shopify requires suspension, or if we detect abuse or security risks. You may terminate your use of the Service at any time by uninstalling the App.
              </Text>
            </BlockStack>

            <Divider />

            {/* 12. Data Retention After Uninstallation */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">12. Data Retention After Uninstallation</Text>
              <Text as="p">
                Certain data may be retained for up to 45 days after app uninstallation for backup recovery, fraud prevention, dispute resolution, and legal compliance purposes.
              </Text>
            </BlockStack>

            <Divider />

            {/* 13. Changes to Terms */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">13. Changes to Terms</Text>
              <Text as="p">
                We may update these Terms from time to time. Continued use of the Service after changes become effective constitutes acceptance of the revised Terms.
              </Text>
            </BlockStack>

            <Divider />

            {/* 14. Governing Law */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">14. Governing Law</Text>
              <Text as="p">
                These Terms shall be governed by the laws of India and courts located in Gujarat shall have exclusive jurisdiction.
              </Text>
            </BlockStack>

            <Divider />

            {/* 15. Contact Us */}
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">15. Contact Us</Text>
              <Text as="p">
                If you have questions regarding these Terms or the Service, please contact:
              </Text>
              <Box
                padding="300"
                borderWidth="025"
                borderRadius="200"
                borderColor="border"
                background="bg-surface-secondary"
              >
                <BlockStack gap="100">
                  <Text as="p"><strong>App:</strong> Smart Stock</Text>
                  <Text as="p"><strong>Developer:</strong> Bitwise Infotech, Rajkot, Gujarat, India</Text>
                  <Text as="p">
                    <strong>Support Email:</strong>{" "}
                    <a href="mailto:support@bitwiseinfotech.com" style={{ color: "#008060", fontWeight: "600", textDecoration: "none" }}>
                      support@bitwiseinfotech.com
                    </a>
                  </Text>
                </BlockStack>
              </Box>
            </BlockStack>

          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* CONTACT SUPPORT MODAL */}
      <Modal
        open={contactSupportOpen}
        onClose={() => {
          setContactSupportOpen(false);
          setSupportSuccess(false);
          setSupportError(null);
        }}
        title="Contact Support — Smart Stock"
        size="large"
        primaryAction={{
          content: "Close",
          onAction: () => {
            setContactSupportOpen(false);
            setSupportSuccess(false);
            setSupportError(null);
          },
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Header */}
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg">
                Contact Support
              </Text>
              <Text as="p" tone="subdued" variant="bodySm">
                We are here to help you optimize inventory, setup campaigns, and resolve any issues.
              </Text>
            </BlockStack>

            {/* Direct Contact Info Box */}
            <Box
              padding="300"
              borderWidth="025"
              borderRadius="200"
              borderColor="border"
              background="bg-surface-secondary"
            >
              <BlockStack gap="100">
                <Text as="p"><strong>App:</strong> Smart Stock</Text>
                <Text as="p"><strong>Developer:</strong> Bitwise Infotech, Rajkot, Gujarat, India</Text>
                <Text as="p">
                  <strong>Support Email:</strong>{" "}
                  <a href="mailto:support@bitwiseinfotech.com" style={{ color: "#008060", fontWeight: "600", textDecoration: "none" }}>
                    support@bitwiseinfotech.com
                  </a>
                </Text>
              </BlockStack>
            </Box>

            <Divider />

            {supportSuccess ? (
              <Banner
                tone="success"
                title="Support request submitted successfully!"
                onDismiss={() => setSupportSuccess(false)}
              >
                <BlockStack gap="200">
                  <p>
                    Thank you for reaching out. We have received your request and our support team will reply within <strong>2–4 hours</strong> (Mon–Sat).
                  </p>
                  <div>
                    <Button onClick={() => setSupportSuccess(false)}>
                      Send Another Message
                    </Button>
                  </div>
                </BlockStack>
              </Banner>
            ) : (
              <form onSubmit={handleSupportSubmit}>
                <BlockStack gap="300">
                  {supportError && (
                    <Banner tone="critical" onDismiss={() => setSupportError(null)}>
                      <p>{supportError}</p>
                    </Banner>
                  )}

                  <TextField
                    label="Your Name"
                    value={supportName}
                    onChange={setSupportName}
                    placeholder="e.g. Alex Smith"
                    autoComplete="name"
                  />

                  <TextField
                    label="Contact Email"
                    type="email"
                    value={supportEmail}
                    onChange={setSupportEmail}
                    placeholder="merchant@example.com"
                    autoComplete="email"
                    requiredIndicator
                  />

                  <TextField
                    label="Subject"
                    value={supportSubject}
                    onChange={setSupportSubject}
                    placeholder="e.g. Question about billing or inventory sync"
                    autoComplete="off"
                    requiredIndicator
                  />

                  <TextField
                    label="Message / Issue Description"
                    value={supportMessage}
                    onChange={setSupportMessage}
                    placeholder="Describe what you need help with in detail..."
                    multiline={4}
                    autoComplete="off"
                    requiredIndicator
                  />

                  <InlineStack align="end" gap="200">
                    <Button
                      variant="primary"
                      onClick={handleSupportSubmit}
                      loading={supportLoading}
                      disabled={!supportEmail.trim() || !supportSubject.trim() || !supportMessage.trim()}
                    >
                      Send Support Request
                    </Button>
                  </InlineStack>
                </BlockStack>
              </form>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
