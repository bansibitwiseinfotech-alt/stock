import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Page Components
import Dashboard from "./pages/Dashboard/Dashboard";
import DeadStock from "./pages/DeadStock/DeadStock";
import DeadStockProduct from "./pages/DeadStock/DeadStockProduct";
// import HighDemand from "./pages/HighDemand/HighDemand";
// import HighDemandProduct from "./pages/HighDemand/HighDemandProduct";
import Bundles from "./pages/Bundles/Bundles";
//import Automations from "./pages/Automations/Automations";
import CustomizationIndex from "./pages/Customization/CustomizationIndex";
import ClearanceSaleCustomization from "./pages/Customization/ClearanceSaleCustomization";
import SmartBadgeRecommendations from "./pages/SmartBadges/SmartBadgeRecommendations";
//import Reports from "./pages/Reports/Reports";
//import Notifications from "./pages/Notifications/Notifications";
//import Settings from "./pages/Settings/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dead-stock" element={<DeadStock />} />
        <Route path="/dead-stock/:variantId" element={<DeadStockProduct />} />
        {/* <Route path="/high-demand" element={<HighDemand />} />
        <Route path="/high-demand/:variantId" element={<HighDemandProduct />} /> */}
        <Route path="/bundles" element={<Bundles />} />
        {/* <Route path="/automations" element={<Automations />} /> */} 
        <Route path="/customization" element={<CustomizationIndex />} />
        <Route path="/customization/clearance-sale" element={<ClearanceSaleCustomization />} />
        <Route path="/smart-badges" element={<SmartBadgeRecommendations />} />
        {/* <Route path="/reports" element={<Reports />} /> */}
        {/* <Route path="/notifications" element={<Notifications />} /> */}
        {/* <Route path="/settings" element={<Settings />} /> */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
