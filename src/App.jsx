import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";

// Page Components
import Dashboard from "./pages/Dashboard/Dashboard";
import DeadStock from "./pages/DeadStock/DeadStock";
import DeadStockProduct from "./pages/DeadStock/DeadStockProduct";
import HighDemand from "./pages/HighDemand/HighDemand";
import HighDemandProduct from "./pages/HighDemand/HighDemandProduct";
import Bundles from "./pages/Bundles/Bundles";
import CustomizationIndex from "./pages/Customization/CustomizationIndex";
import ClearanceSaleCustomization from "./pages/Customization/ClearanceSaleCustomization";
import SmartBadgeRecommendations from "./pages/SmartBadges/SmartBadgeRecommendations";
import Reports from "./pages/Reports/Reports";
import Settings from "./pages/Settings/Settings";
import BillingPlans from "./pages/Billing/BillingPlans";
import PreOrders from "./pages/PreOrders/PreOrders";

export default function App({ children }) {
  if (children) {
    return <div className="smart-stock-app-root">{children}</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dead-stock" element={<DeadStock />} />
        <Route path="/dead-stock/:variantId" element={<DeadStockProduct />} />
        <Route path="/high-demand" element={<HighDemand />} />
        <Route path="/high-demand/:variantId" element={<HighDemandProduct />} />
        <Route path="/bundles" element={<Bundles />} />
        <Route path="/customization" element={<CustomizationIndex />} />
        <Route path="/customization/clearance-sale" element={<ClearanceSaleCustomization />} />
        <Route path="/smart-badges" element={<SmartBadgeRecommendations />} />
        <Route path="/pre-orders" element={<PreOrders />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/billing" element={<BillingPlans />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
