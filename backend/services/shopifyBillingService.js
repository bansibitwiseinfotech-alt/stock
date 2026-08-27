// =====================================================
// SMART STOCK - SHOPIFY BILLING SERVICE
// =====================================================

const shopifyGraphQL = require("./shopifyGraphql");
const SHOPIFY_BILLING_PLANS = require("../config/shopifyBillingPlans");

// GraphQL Mutation: Create App Subscription
const CREATE_APP_SUBSCRIPTION_MUTATION = `
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      lineItems: $lineItems
      test: $test
    ) {
      userErrors {
        field
        message
      }
      appSubscription {
        id
        name
        status
        createdAt
      }
      confirmationUrl
    }
  }
`;

// GraphQL Query: Get App Subscription Details
const GET_APP_SUBSCRIPTION_QUERY = `
  query GetAppSubscription($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        name
        status
        createdAt
        currentPeriodEnd
        lineItems {
          id
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

// GraphQL Mutation: Cancel App Subscription
const CANCEL_APP_SUBSCRIPTION_MUTATION = `
  mutation AppSubscriptionCancel($id: ID!, $prorate: Boolean) {
    appSubscriptionCancel(id: $id, prorate: $prorate) {
      userErrors {
        field
        message
      }
      appSubscription {
        id
        status
      }
    }
  }
`;

/**
 * Creates a real recurring Shopify App Subscription charge.
 */
async function createAppSubscription({
  shop,
  accessToken,
  plan,
  billingCycle = "monthly",
  returnUrl,
  testMode = false,
}) {
  const planConfig = SHOPIFY_BILLING_PLANS[plan];

  if (!planConfig) {
    throw new Error(`Invalid billing plan requested: ${plan}`);
  }

  const cycleConfig =
    billingCycle === "yearly" ? planConfig.yearly : planConfig.monthly;

  if (!cycleConfig) {
    throw new Error(`Invalid billing cycle requested: ${billingCycle}`);
  }

  const variables = {
    name: planConfig.name,
    returnUrl,
    test: testMode,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: cycleConfig.price,
              currencyCode: cycleConfig.currencyCode,
            },
            interval: cycleConfig.interval,
          },
        },
      },
    ],
  };

  const data = await shopifyGraphQL(
    shop,
    accessToken,
    CREATE_APP_SUBSCRIPTION_MUTATION,
    variables
  );

  const result = data?.appSubscriptionCreate;

  if (result?.userErrors && result.userErrors.length > 0) {
    const errorMsg = result.userErrors.map((e) => e.message).join(", ");
    throw new Error(`Shopify Billing Error: ${errorMsg}`);
  }

  if (!result?.confirmationUrl) {
    throw new Error("Shopify did not return a billing confirmation URL.");
  }

  return {
    subscriptionId: result.appSubscription?.id || null,
    status: result.appSubscription?.status || "PENDING",
    confirmationUrl: result.confirmationUrl,
    plan,
    billingCycle,
    price: cycleConfig.price,
  };
}

/**
 * Queries Shopify to inspect the status of an App Subscription.
 */
async function getAppSubscription({ shop, accessToken, subscriptionId }) {
  if (!subscriptionId) return null;

  // Format GID if needed
  const gid = subscriptionId.startsWith("gid://shopify/AppSubscription/")
    ? subscriptionId
    : `gid://shopify/AppSubscription/${subscriptionId}`;

  const data = await shopifyGraphQL(
    shop,
    accessToken,
    GET_APP_SUBSCRIPTION_QUERY,
    { id: gid }
  );

  return data?.node || null;
}

/**
 * Cancels an active Shopify App Subscription.
 */
async function cancelAppSubscription({ shop, accessToken, subscriptionId }) {
  if (!subscriptionId) return null;

  const gid = subscriptionId.startsWith("gid://shopify/AppSubscription/")
    ? subscriptionId
    : `gid://shopify/AppSubscription/${subscriptionId}`;

  const data = await shopifyGraphQL(
    shop,
    accessToken,
    CANCEL_APP_SUBSCRIPTION_MUTATION,
    { id: gid, prorate: true }
  );

  const result = data?.appSubscriptionCancel;

  if (result?.userErrors && result.userErrors.length > 0) {
    console.warn(
      "[ShopifyBilling] Subscription cancel warnings:",
      result.userErrors
    );
  }

  return result?.appSubscription || null;
}

module.exports = {
  createAppSubscription,
  getAppSubscription,
  cancelAppSubscription,
};
