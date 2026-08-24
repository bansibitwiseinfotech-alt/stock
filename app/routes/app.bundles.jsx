import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import Bundles from "../../src/pages/Bundles/Bundles";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function BundlesRoute() {
  const { shop } = useLoaderData();
  return <Bundles shopDomain={shop} />;
}
