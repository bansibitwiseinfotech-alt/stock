import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import Dashboard from "../../src/pages/Dashboard/Dashboard";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "";
  return { shop };
};

export default function IndexRoute() {
  const { shop } = useLoaderData();
  return <Dashboard shopDomain={shop} />;
}