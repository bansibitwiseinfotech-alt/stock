import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import Notifications from "../../src/pages/Notifications/Notifications";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "" };
};

export default function NotificationsRoute() {
  const { shop } = useLoaderData();
  return <Notifications shopDomain={shop} />;
}
