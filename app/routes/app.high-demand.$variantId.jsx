import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import HighDemandProduct from "../../src/pages/HighDemand/HighDemandProduct";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session?.shop || "", variantId: params.variantId };
};

export default function HighDemandProductRoute() {
  const { shop, variantId } = useLoaderData();
  const navigate = useNavigate();
  return <HighDemandProduct variantId={variantId} shop={shop} onBack={() => navigate("/app/high-demand")} />;
}
