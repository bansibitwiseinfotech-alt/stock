import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import Reports from "../../src/pages/Reports/Reports";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function ReportsRoute() {
  const { shop } = useLoaderData();
  return <Reports shopDomain={shop} />;
}
