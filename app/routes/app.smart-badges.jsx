import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import SmartBadgeRecommendations from "../../src/pages/SmartBadges/SmartBadgeRecommendations";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function SmartBadgesRoute() {
  const { shop } = useLoaderData();
  return <SmartBadgeRecommendations shopDomain={shop} />;
}
