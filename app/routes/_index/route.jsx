import { redirect } from "react-router";
import { authenticate } from "../../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (
    url.searchParams.get("shop") ||
    url.searchParams.get("host") ||
    url.searchParams.get("embedded") ||
    url.searchParams.get("id_token")
  ) {
    return redirect(`/app?${url.searchParams.toString()}`);
  }

  try {
    const { session } = await authenticate.admin(request);
    if (session?.shop) {
      return redirect(`/app?shop=${encodeURIComponent(session.shop)}`);
    }
  } catch (_) {}

  return redirect(`/app${url.search ? url.search : ""}`);
};

export default function Index() {
  return null;
}

