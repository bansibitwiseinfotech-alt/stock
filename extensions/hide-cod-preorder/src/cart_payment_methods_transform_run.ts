import type {
  CartPaymentMethodsTransformRunInput,
  CartPaymentMethodsTransformRunResult,
} from "../generated/api";

const NO_CHANGES: CartPaymentMethodsTransformRunResult = {
  operations: [],
};

export function cartPaymentMethodsTransformRun(
  input: CartPaymentMethodsTransformRunInput
): CartPaymentMethodsTransformRunResult {
  // Check if any line in the cart is a pre-order
  const hasPreOrder = (input.cart?.lines || []).some((line) => {
    const isPreOrderAttr =
      line.attribute?.value === "true" ||
      line.isPreorder?.value === "true" ||
      Boolean(line.preorderText?.value);

    let hasTag = false;
    if (line.merchandise && "product" in line.merchandise) {
      hasTag = Boolean(line.merchandise.product?.hasAnyTag);
    }

    return isPreOrderAttr || hasTag;
  });

  // If there are no pre-order items in the cart, do not modify payment methods
  if (!hasPreOrder) {
    return NO_CHANGES;
  }

  // Find all Cash on Delivery (COD) payment methods and hide them
  const hideOperations = (input.paymentMethods || [])
    .filter((method) => {
      const name = (method.name || "").toLowerCase();
      return (
        name.includes("cash on delivery") ||
        name.includes("cod") ||
        name.includes("cash_on_delivery") ||
        name.includes("cash-on-delivery") ||
        name.includes("cash")
      );
    })
    .map((method) => ({
      paymentMethodHide: {
        paymentMethodId: method.id,
      },
    }));

  return {
    operations: hideOperations,
  };
}