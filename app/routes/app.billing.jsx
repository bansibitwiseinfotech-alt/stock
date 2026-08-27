import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import BillingPlans from "../../src/pages/Billing/BillingPlans";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function BillingRoute() {
  const { shop } = useLoaderData();
  return <BillingPlans shopDomain={shop} />;
}
