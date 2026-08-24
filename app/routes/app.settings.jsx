import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import Settings from "../../src/pages/Settings/Settings";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function SettingsRoute() {
  const { shop } = useLoaderData();
  return <Settings shopDomain={shop} />;
}
