import { useLoaderData, useNavigate, useParams } from "react-router";
import { authenticate } from "../shopify.server";
import DeadStockProduct from "../../src/pages/DeadStock/DeadStockProduct";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop || "", variantId: params.variantId || "" };
};

export default function DeadStockProductRoute() {
  const { shop, variantId: loaderVariantId } = useLoaderData();
  const params = useParams();
  const navigate = useNavigate();
  const variantId = loaderVariantId || params.variantId;

  return (
    <DeadStockProduct
      variantId={variantId}
      shop={shop}
      onBack={() => navigate("/app/dead-stock")}
    />
  );
}
