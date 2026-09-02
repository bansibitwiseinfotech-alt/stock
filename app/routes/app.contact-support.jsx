import React, { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Divider,
  Box,
  TextField,
  Select,
  Button,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { submitContactSupportApi } from "../../src/services/appApi";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function ContactSupport() {
  const { shop } = useLoaderData();
  const navigate = useNavigate();

  const handleBack = () => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    navigate(`/app/billing${search}`);
  };

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const categoryOptions = [
    { label: "General Inquiry & Setup", value: "general" },
    { label: "Billing, Plans & Quotas", value: "billing" },
    { label: "Dead Stock & Inventory Analytics", value: "dead_stock" },
    { label: "Badges & Customization", value: "customization" },
    { label: "Pre-Orders & Deposit Setup", value: "pre_orders" },
    { label: "Bug Report / Technical Issue", value: "bug" },
    { label: "Feature Request", value: "feature" },
  ];

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg("Please enter a valid contact email address.");
      return;
    }

    if (!subject.trim()) {
      setErrorMsg("Please enter a subject for your support request.");
      return;
    }

    if (!message.trim()) {
      setErrorMsg("Please describe your issue or inquiry in detail.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await submitContactSupportApi({
        shop: shop || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("shop") : "") || "",
        name: name.trim(),
        email: email.trim(),
        category,
        subject: subject.trim(),
        message: message.trim(),
      });

      setSubmittedData({
        ticketNumber: res.ticket?.ticketNumber || res.ticket?.id?.slice(-6)?.toUpperCase() || "NEW",
        email: email.trim(),
      });

      setSubject("");
      setMessage("");
    } catch (err) {
      console.error("Support ticket submission failed:", err);
      setErrorMsg(err.message || "Failed to submit support request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page
      title="Contact Support"
      subtitle="We are here to help you optimize inventory, setup campaigns, and resolve issues."
      backAction={{
        content: "Billing & Plans",
        onAction: handleBack,
      }}
      compactTitle
    >
      <BlockStack gap="400">
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
              <Text style={{ color: "#008060", fontWeight: "600", textDecoration: "none" }}>
                <Text> support@bitwiseinfotech.com</Text>
              </Text>
            </Text>
          </BlockStack>
        </Box>

        {submittedData ? (
          <Banner
            tone="success"
            title={`Support ticket #${submittedData.ticketNumber} submitted successfully!`}
            onDismiss={() => setSubmittedData(null)}
          >
            <BlockStack gap="200">
              <p>
                Thank you for reaching out. We have saved your ticket and sent a confirmation to{" "}
                <strong>{submittedData.email}</strong>. Our team will reply within <strong>2–4 hours</strong> (Mon–Sat).
              </p>
              <div>
                <Button onClick={() => setSubmittedData(null)}>
                  Send Another Message
                </Button>
              </div>
            </BlockStack>
          </Banner>
        ) : (
          <Card padding="500">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Send Us a Message
              </Text>

              <Divider />

              {errorMsg && (
                <Banner
                  tone="critical"
                  title="Unable to submit support request"
                  onDismiss={() => setErrorMsg(null)}
                >
                  <p>{errorMsg}</p>
                </Banner>
              )}

              <form onSubmit={handleSubmit}>
                <BlockStack gap="400">
                  <TextField
                    label="Your Name"
                    value={name}
                    onChange={setName}
                    placeholder="e.g. Alex Smith"
                    autoComplete="name"
                  />

                  <TextField
                    label="Contact Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="merchant@example.com"
                    autoComplete="email"
                    helpText="We will reply to this email address."
                    requiredIndicator
                  />

                  <Select
                    label="Inquiry Category"
                    options={categoryOptions}
                    value={category}
                    onChange={setCategory}
                  />

                  <TextField
                    label="Subject"
                    value={subject}
                    onChange={setSubject}
                    placeholder="e.g. Question about Pre-Order badge customization"
                    autoComplete="off"
                    requiredIndicator
                  />

                  <TextField
                    label="Message / Issue Description"
                    value={message}
                    onChange={setMessage}
                    placeholder="Describe what you need help with in detail..."
                    multiline={5}
                    autoComplete="off"
                    requiredIndicator
                  />

                  <InlineStack align="end" gap="300">
                    <Button
                      variant="primary"
                      onClick={handleSubmit}
                      loading={submitting}
                      disabled={!message.trim() || !subject.trim() || !email.trim()}
                    >
                      Send Support Request
                    </Button>
                  </InlineStack>
                </BlockStack>
              </form>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
