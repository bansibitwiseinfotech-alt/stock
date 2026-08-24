import React from "react";

export default function DeadStockRow({ product, onTakeAction }) {
  const title = product.title || product.productTitle || "Untitled Product";
  const sku = product.sku ? `SKU: ${product.sku}` : "SKU: N/A";
  const daysText = product.daysUnsold >= 900 ? "Never sold" : `${product.daysUnsold} days`;
  const formattedCash = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(product.cashTiedUp || 0);

  return (
    <tr
      style={{
        borderBottom: "1px solid #F1F5F9",
        transition: "background-color 0.15s ease",
      }}
    >
      {/* Product Image + Title + SKU */}
      <td style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {product.image ? (
            <img
              src={product.image}
              alt={title}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "8px",
                objectFit: "cover",
                border: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
              }}
            />
          ) : (
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "8px",
                backgroundColor: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "16px",
                border: "1px solid #C7D2FE",
              }}
            >
              {title.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#0F172A",
                marginBottom: "2px",
                fontFamily: "Inter, -apple-system, sans-serif",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#64748B",
                fontFamily: "Inter, -apple-system, sans-serif",
              }}
            >
              {sku}
            </div>
          </div>
        </div>
      </td>

      {/* Days Unsold */}
      <td
        style={{
          padding: "16px 20px",
          fontSize: "14px",
          color: "#334155",
          fontWeight: "500",
        }}
      >
        {daysText}
      </td>

      {/* Stock */}
      <td
        style={{
          padding: "16px 20px",
          fontSize: "14px",
          color: "#334155",
          fontWeight: "500",
        }}
      >
        {product.stock}
      </td>

      {/* Cash Tied Up */}
      <td
        style={{
          padding: "16px 20px",
          fontSize: "14px",
          color: "#0F172A",
          fontWeight: "700",
        }}
      >
        {formattedCash}
      </td>

      {/* Action Button */}
      <td style={{ padding: "16px 20px" }}>
        <button
          onClick={() => onTakeAction(product)}
          style={{
            padding: "7px 16px",
            borderRadius: "8px",
            border: "1px solid #C7D2FE",
            backgroundColor: "#FFFFFF",
            color: "#4F46E5",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow: "0 1px 2px rgba(79, 70, 229, 0.05)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#4F46E5";
            e.currentTarget.style.color = "#FFFFFF";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#FFFFFF";
            e.currentTarget.style.color = "#4F46E5";
          }}
        >
          Take Action
        </button>
      </td>
    </tr>
  );
}
