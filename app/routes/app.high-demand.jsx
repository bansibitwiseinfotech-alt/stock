import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import HighDemand from "../../src/pages/HighDemand/HighDemand";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function HighDemandRoute() {
  const { shop } = useLoaderData();
  return <HighDemand shopDomain={shop} />;
}