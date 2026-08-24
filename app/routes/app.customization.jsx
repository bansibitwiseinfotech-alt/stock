import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import CustomizationIndex from "../../src/pages/Customization/CustomizationIndex";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session?.shop || "";
  const token = session?.accessToken || "";

  const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
  let initialConfig = null;

  try {
    const res = await fetch(
      `${backendBaseUrl}/api/customization/clearance-sale?shop=${encodeURIComponent(shop)}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Shop-Domain": shop,
          "X-Shopify-Access-Token": token,
        },
      }
    );
    if (res.ok) {
      const json = await res.json();
      if (json.success) initialConfig = json.data;
    }
  } catch (err) {
    console.error("Customization loader error:", err.message);
  }

  return { shop, initialConfig };
};

export default function CustomizationRoute() {
  const { shop, initialConfig } = useLoaderData();
  return <CustomizationIndex shopDomain={shop} initialConfig={initialConfig} />;
}
