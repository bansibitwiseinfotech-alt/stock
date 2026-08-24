function roundPrice(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateDiscountedPrice(originalPrice, discountPercent) {
  const price = Number(originalPrice);
  const discount = Number(discountPercent);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Invalid original price");
  }

  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new Error("Invalid discount percentage");
  }

  const discountedPrice =
    price - (price * discount) / 100;

  return roundPrice(discountedPrice);
}

function calculateNextDiscount({
  currentDiscount,
  incrementPercent,
  maximumDiscount,
}) {
  const nextDiscount =
    Number(currentDiscount) + Number(incrementPercent);

  return Math.min(
    nextDiscount,
    Number(maximumDiscount)
  );
}

function addDays(date, days) {
  const result = new Date(date);

  result.setDate(result.getDate() + Number(days));

  return result;
}

module.exports = {
  roundPrice,
  calculateDiscountedPrice,
  calculateNextDiscount,
  addDays,
};
