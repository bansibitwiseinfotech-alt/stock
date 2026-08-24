import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import PreOrders from "../../src/pages/PreOrders/PreOrders";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function PreOrdersRoute() {
  const { shop } = useLoaderData();
  return <PreOrders shopDomain={shop} />;
}
