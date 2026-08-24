const shopifyGraphQL = require("./shopifyGraphql");

const GET_PAYMENT_CUSTOMIZATIONS_QUERY = `
  query GetPaymentCustomizations {
    paymentCustomizations(first: 25) {
      nodes {
        id
        title
        enabled
        functionId
      }
    }
    shopifyFunctions(first: 25) {
      nodes {
        id
        title
        apiType
        app {
          title
        }
      }
    }
  }
`;

const CREATE_PAYMENT_CUSTOMIZATION_MUTATION = `
  mutation CreatePaymentCustomization($paymentCustomization: PaymentCustomizationInput!) {
    paymentCustomizationCreate(paymentCustomization: $paymentCustomization) {
      paymentCustomization {
        id
        title
        enabled
        functionId
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Ensures the "Hide COD for Pre-Order" payment customization is registered and enabled on the store.
 */
async function ensurePreOrderPaymentCustomization(shop, accessToken) {
  try {
    if (!shop || !accessToken) return;

    const data = await shopifyGraphQL(shop, accessToken, GET_PAYMENT_CUSTOMIZATIONS_QUERY);
    if (!data) return;

    const existingCustomizations = data.paymentCustomizations?.nodes || [];
    const functions = data.shopifyFunctions?.nodes || [];

    // Find our hide-cod-preorder function
    const hideCodFunc = functions.find(
      (f) =>
        f.title?.toLowerCase().includes("hide-cod-preorder") ||
        f.title?.toLowerCase().includes("hide cod") ||
        f.apiType === "cart_payment_methods_transform"
    );

    if (!hideCodFunc) {
      console.log(`[PaymentCustomization] No matching function found for shop ${shop}`);
      return;
    }

    // Check if already active
    const alreadyActive = existingCustomizations.some(
      (c) => c.functionId === hideCodFunc.id && c.enabled
    );

    if (alreadyActive) {
      return;
    }

    // Create payment customization
    const result = await shopifyGraphQL(shop, accessToken, CREATE_PAYMENT_CUSTOMIZATION_MUTATION, {
      paymentCustomization: {
        title: "Smart Stock: Hide COD for Pre-Orders",
        enabled: true,
        functionId: hideCodFunc.id,
      },
    });

    if (result?.paymentCustomizationCreate?.userErrors?.length > 0) {
      console.error(
        "[PaymentCustomization] Error registering customization:",
        result.paymentCustomizationCreate.userErrors
      );
    } else {
      console.log(`[PaymentCustomization] Successfully activated for shop ${shop}`);
    }
  } catch (err) {
    console.error("[PaymentCustomization] Registration failed:", err.message);
  }
}

module.exports = {
  ensurePreOrderPaymentCustomization,
};
