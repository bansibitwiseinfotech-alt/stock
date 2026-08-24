import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
//import Automations from "../../src/pages/Automations/Automations";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function AutomationsRoute() {
  const { shop } = useLoaderData();
  return <Automations shopDomain={shop} />;
}
