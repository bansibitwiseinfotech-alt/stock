import React, { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Divider,
  Box,
  ProgressBar,
} from "@shopify/polaris";
import { useNavigate } from "react-router";
import { fetchDashboardData } from "../../services/appApi";

const getInitialTrends = () => {
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const dailyTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayName = daysOfWeek[d.getDay()];
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyTrend.push({
      label: i === 0 ? "Today" : dayName,
      fullDate: dateStr,
      dayName,
      recovered: Math.round(2800 + (6 - i) * 650 + (d.getDay() % 3) * 450),
      count: Math.round(28 + (6 - i) * 7 + (d.getDay() % 3) * 5),
    });
  }

  const weeklyTrend = [];
  for (let i = 3; i >= 0; i--) {
    const dEnd = new Date();
    dEnd.setDate(dEnd.getDate() - i * 7);
    const dStart = new Date(dEnd);
    dStart.setDate(dStart.getDate() - 6);
    const dStartStr = dStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dEndStr = dEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weeklyTrend.push({
      label: i === 0 ? "This Wk" : `Wk ${4 - i}`,
      dateRange: `${dStartStr} - ${dEndStr}`,
      recovered: Math.round(16800 + (3 - i) * 3800),
      count: Math.round(180 + (3 - i) * 40),
    });
  }

  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthName = monthNames[d.getMonth()];
    const monthYear = d.getFullYear();
    monthlyTrend.push({
      label: monthName,
      month: monthName,
      year: monthYear,
      recovered: Math.round(32000 + (5 - i) * 9800),
      count: Math.round(240 + (5 - i) * 85),
    });
  }

  return { dailyTrend, weeklyTrend, monthlyTrend };
};

export default function Dashboard({ shopDomain = "" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [timeframe, setTimeframe] = useState("monthly"); // "daily" | "weekly" | "monthly"
  const initialTrends = getInitialTrends();
  const [data, setData] = useState({
    totalCashRecovered: 300755,
    growthPercentage: 14.8,
    deadStockCashTiedUp: 18450,
    deadStockSkuCount: 29,
    dailyTrend: initialTrends.dailyTrend,
    weeklyTrend: initialTrends.weeklyTrend,
    monthlyTrend: initialTrends.monthlyTrend,
    stockHealth: {
      healthyPercent: 62,
      slowMovingPercent: 25,
      deadStockPercent: 13,
      healthyCount: 142,
      slowMovingCount: 57,
      deadStockCount: 29,
    },
    activityFeed: [
      {
        id: "act-1",
        title: "Companion Bundle created",
        description: "Automated BOGO bundle created for slow-moving phone accessories",
        time: "10m ago",
        status: "Active",
      },
      {
        id: "act-2",
        title: "Clearance discount applied",
        description: "20% discount activated on 18 dead stock SKUs",
        time: "45m ago",
        status: "Live",
      },
      {
        id: "act-3",
        title: "Low stock badge assigned",
        description: "Urgency counter badge published on 6 trending variants",
        time: "2h ago",
        status: "Live",
      },
      {
        id: "act-4",
        title: "Progressive markdown step updated",
        description: "15% markdown tier applied to items idle over 45 days",
        time: "5h ago",
        status: "Updated",
      },
      {
        id: "act-5",
        title: "Inventory sync finished",
        description: "Full sync completed for 228 variants across all locations",
        time: "Yesterday",
        status: "Completed",
      },
    ],
    badgeBreakdown: [
      {
        key: "markdown",
        title: "Progressive Markdown",
        badgesUsed: 2619,
        cashRecovered: 278696,
        percentage: 92,
        color: "#008060",
        link: "/app/dead-stock",
      },
      {
        key: "bundle",
        title: "Bundle Offers",
        badgesUsed: 103,
        cashRecovered: 16441,
        percentage: 5,
        color: "#5C6AC4",
        link: "/app/bundles",
      },
      {
        key: "clearance",
        title: "Clearance Sales",
        badgesUsed: 42,
        cashRecovered: 5363,
        percentage: 2,
        color: "#47C1BF",
        link: "/app/dead-stock",
      },
      {
        key: "urgency",
        title: "Urgency Badges",
        badgesUsed: 3,
        cashRecovered: 255,
        percentage: 1,
        color: "#2C6ECB",
        link: "/app/high-demand",
      },
    ],
    recommendations: [
      {
        id: "rec-1",
        title: "Clear 42 slow-moving products",
        description: "Items have had zero sales for 60+ days. Launching a clearance discount could recover an estimated $15,960.",
        actionText: "Create Clearance Sale",
        tag: "Dead stock",
        tone: "attention",
        link: "/app/dead-stock",
      },
      {
        id: "rec-2",
        title: "Protect revenue on 54 high-demand products",
        description: "High sales velocity items risk stocking out during high-traffic periods. Enable low-stock badges to drive conversion.",
        actionText: "View High Demand",
        tag: "High velocity",
        tone: "info",
        link: "/app/high-demand",
      },
    ],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchDashboardData(shopDomain);
      if (res && res.totalCashRecovered !== undefined) {
        setData((prev) => ({
          ...prev,
          totalCashRecovered: res.totalCashRecovered ?? prev.totalCashRecovered,
          growthPercentage: res.growthPercentage ?? prev.growthPercentage,
          deadStockCashTiedUp: res.deadStockCashTiedUp ?? prev.deadStockCashTiedUp,
          deadStockSkuCount: res.deadStockSkuCount ?? prev.deadStockSkuCount,
          dailyTrend: res.dailyTrend || prev.dailyTrend,
          weeklyTrend: res.weeklyTrend || prev.weeklyTrend,
          monthlyTrend: res.monthlyTrend || prev.monthlyTrend,
          badgeBreakdown:
            res.badgeBreakdown?.map((b) => ({
              ...b,
              percentage: Math.round(((b.cashRecovered || 0) / (res.totalCashRecovered || 1)) * 100),
            })) || prev.badgeBreakdown,
        }));
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopDomain]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Active trend data depending on timeframe selector
  const activeTrendData =
    timeframe === "daily"
      ? data.dailyTrend
      : timeframe === "weekly"
      ? data.weeklyTrend
      : data.monthlyTrend;

  const rawMax = Math.max(...(activeTrendData || []).map((m) => m.recovered), 100);
  
  // Clean nice max calculation with 4-step divisible intervals
  const getNiceMax = (val) => {
    const target = val * 1.15; // 15% headroom
    if (target <= 1000) return Math.max(800, Math.ceil(target / 200) * 200);
    if (target <= 4000) return Math.ceil(target / 800) * 800;
    if (target <= 10000) return Math.ceil(target / 2000) * 2000;
    if (target <= 40000) return Math.ceil(target / 4000) * 4000;
    if (target <= 100000) return Math.ceil(target / 10000) * 10000;
    return Math.ceil(target / 20000) * 20000;
  };

  const activeMax = getNiceMax(rawMax);

  const activeTotal = (activeTrendData || []).reduce((sum, item) => sum + (item.recovered || 0), 0);
  const activeAvg = Math.round(activeTotal / Math.max(activeTrendData.length, 1));
  const periodLabel = timeframe === "daily" ? "day" : timeframe === "weekly" ? "wk" : "mo";

  const formatScale = (amount) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) {
      const k = amount / 1000;
      return k % 1 === 0 ? `$${k}k` : `$${k.toFixed(1)}k`;
    }
    return `$${Math.round(amount)}`;
  };

  return (
    <Page
      fullWidth
      title="Dashboard"
      subtitle="Overview of inventory performance, cash recovery, and automated promotions."
    >
      <Layout>
        {/* ==================================================
            1. KPI SUMMARY STATS CARDS
            ================================================== */}
        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Metric 1 */}
            <Card padding="400">
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "105px" }}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued" fontWeight="medium">
                    Total cash recovered
                  </Text>
                  <Badge tone="success">{`+${data.growthPercentage}%`}</Badge>
                </InlineStack>
                <div>
                  <Text variant="heading2xl" as="p" fontWeight="bold">
                    {formatCurrency(data.totalCashRecovered)}
                  </Text>
                  <Text variant="bodyXs" tone="subdued">
                    Across all active promotions
                  </Text>
                </div>
              </div>
            </Card>

            {/* Metric 2 */}
            <Card padding="400">
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "105px" }}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued" fontWeight="medium">
                    Dead stock cash tied up
                  </Text>
                  <Badge tone="critical">{`${data.deadStockSkuCount} SKUs`}</Badge>
                </InlineStack>
                <div>
                  <Text variant="heading2xl" as="p" fontWeight="bold">
                    {formatCurrency(data.deadStockCashTiedUp)}
                  </Text>
                  <div style={{ paddingTop: "2px" }}>
                    <Button
                      variant="plain"
                      size="slim"
                      onClick={() => navigate("/app/dead-stock")}
                    >
                      View dead stock →
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Metric 3 */}
            <Card padding="400">
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "105px" }}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued" fontWeight="medium">
                    Revenue at risk
                  </Text>
                  <Badge tone="attention">High demand</Badge>
                </InlineStack>
                <div>
                  <Text variant="heading2xl" as="p" fontWeight="bold">
                    {formatCurrency(24300)}
                  </Text>
                  <div style={{ paddingTop: "2px" }}>
                    <Button
                      variant="plain"
                      size="slim"
                      onClick={() => navigate("/app/high-demand")}
                    >
                      54 items low in stock →
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Metric 4 */}
            <Card padding="400">
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "105px" }}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued" fontWeight="medium">
                    Active automations
                  </Text>
                  <Badge tone="info">Running</Badge>
                </InlineStack>
                <div>
                  <Text variant="heading2xl" as="p" fontWeight="bold">
                    {(data.badgeBreakdown || []).reduce((s, b) => s + (b.badgesUsed || 0), 0).toLocaleString()}
                  </Text>
                  <Text variant="bodyXs" tone="subdued">
                    Badges & discount rules active
                  </Text>
                </div>
              </div>
            </Card>
          </div>
        </Layout.Section>

        {/* ==================================================
            2. MODERN MINIMALIST CHART & STRATEGY SECTION
            ================================================== */}
        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Chart: Clean Minimalist Bar Chart */}
            <Card padding="400">
              <BlockStack gap="400">
                {/* Header */}
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Cash recovery
                    </Text>
                    <Text variant="bodyXs" tone="subdued">
                      Total: <span style={{ fontWeight: "600", color: "#202223" }}>{formatCurrency(activeTotal)}</span> • Avg: <span style={{ fontWeight: "600", color: "#202223" }}>{formatCurrency(activeAvg)}/{periodLabel}</span>
                    </Text>
                  </BlockStack>

                  {/* Clean Segmented Timeframe Switcher */}
                  <div
                    style={{
                      display: "inline-flex",
                      backgroundColor: "#F1F2F4",
                      borderRadius: "8px",
                      padding: "3px",
                      border: "1px solid #E4E5E7",
                    }}
                  >
                    {[
                      { id: "daily", label: "Daily" },
                      { id: "weekly", label: "Weekly" },
                      { id: "monthly", label: "Monthly" },
                    ].map((item) => {
                      const isActive = timeframe === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTimeframe(item.id)}
                          style={{
                            border: "none",
                            background: isActive ? "#FFFFFF" : "transparent",
                            borderRadius: "6px",
                            padding: "4px 12px",
                            fontSize: "12px",
                            fontWeight: isActive ? "600" : "500",
                            color: isActive ? "#202223" : "#6D7175",
                            cursor: "pointer",
                            boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </InlineStack>

                {/* Pixel-Perfect SVG Line Chart Container */}
                <div style={{ position: "relative", width: "100%", height: "250px" }}>
                  {(() => {
                    const trendLen = (activeTrendData || []).length;
                    const plotLeft = 45;
                    const plotRight = 485;
                    const plotWidth = plotRight - plotLeft;
                    const plotTop = 20;
                    const plotBottom = 155;
                    const plotHeight = plotBottom - plotTop;

                    const points = (activeTrendData || []).map((item, idx) => {
                      const stepX = trendLen > 1 ? plotWidth / (trendLen - 1) : plotWidth / 2;
                      const x = plotLeft + idx * stepX;
                      const ratio = Math.min(1, Math.max(0, (item.recovered || 0) / (activeMax || 1)));
                      const y = plotBottom - ratio * plotHeight;
                      return { ...item, x, y, idx };
                    });

                    // Build smooth curve path with boundary clamping
                    const createSmoothPath = (pts) => {
                      if (pts.length === 0) return "";
                      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
                      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
                      for (let i = 0; i < pts.length - 1; i++) {
                        const p0 = pts[i];
                        const p1 = pts[i + 1];
                        const cpX1 = p0.x + (p1.x - p0.x) * 0.45;
                        const cpY1 = Math.min(plotBottom, Math.max(plotTop, p0.y));
                        const cpX2 = p1.x - (p1.x - p0.x) * 0.45;
                        const cpY2 = Math.min(plotBottom, Math.max(plotTop, p1.y));
                        d += ` C ${cpX1.toFixed(1)} ${cpY1.toFixed(1)}, ${cpX2.toFixed(1)} ${cpY2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
                      }
                      return d;
                    };

                    const linePath = createSmoothPath(points);
                    const areaPath =
                      points.length > 0
                        ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${plotBottom} L ${points[0].x.toFixed(1)} ${plotBottom} Z`
                        : "";

                    const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

                    const gridLevels = [
                      { val: activeMax, y: plotTop },
                      { val: activeMax * 0.75, y: plotTop + plotHeight * 0.25 },
                      { val: activeMax * 0.5, y: plotTop + plotHeight * 0.5 },
                      { val: activeMax * 0.25, y: plotTop + plotHeight * 0.75 },
                      { val: 0, y: plotBottom },
                    ];

                    return (
                      <div style={{ width: "100%", height: "100%", position: "relative" }}>
                        <svg
                          viewBox="0 0 520 195"
                          preserveAspectRatio="none"
                          style={{ width: "100%", height: "100%", overflow: "visible" }}
                        >
                          <defs>
                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2C6ECB" stopOpacity="0.22" />
                              <stop offset="100%" stopColor="#2C6ECB" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Horizontal Gridlines & Y-Axis Labels */}
                          {gridLevels.map((lvl, i) => (
                            <g key={i}>
                              <line
                                x1={plotLeft}
                                y1={lvl.y}
                                x2={plotRight}
                                y2={lvl.y}
                                stroke={i === gridLevels.length - 1 ? "#D2D5D8" : "#E5E7EB"}
                                strokeDasharray={i === gridLevels.length - 1 ? "none" : "3 3"}
                                strokeWidth="1"
                              />
                              <text
                                x={plotLeft - 8}
                                y={lvl.y + 4}
                                textAnchor="end"
                                fill="#8C9196"
                                fontSize="11"
                                fontWeight="400"
                              >
                                {formatScale(lvl.val)}
                              </text>
                            </g>
                          ))}

                          {/* Gradient Area */}
                          {areaPath && <path d={areaPath} fill="url(#chartGrad)" />}

                          {/* Hover Vertical Guide Line */}
                          {hoveredPoint && (
                            <line
                              x1={hoveredPoint.x}
                              y1={plotTop}
                              x2={hoveredPoint.x}
                              y2={plotBottom}
                              stroke="#2C6ECB"
                              strokeDasharray="2 2"
                              strokeWidth="1.5"
                              opacity="0.6"
                            />
                          )}

                          {/* Main Smooth Line */}
                          {linePath && (
                            <path
                              d={linePath}
                              fill="none"
                              stroke="#2C6ECB"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Data Points and X-Axis Labels */}
                          {points.map((p) => {
                            const isHovered = hoveredIdx === p.idx;
                            return (
                              <g key={p.label || p.idx}>
                                {isHovered && (
                                  <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r="8"
                                    fill="#2C6ECB"
                                    fillOpacity="0.2"
                                  />
                                )}
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isHovered ? 5.5 : 4}
                                  fill="#FFFFFF"
                                  stroke="#2C6ECB"
                                  strokeWidth={isHovered ? 2.5 : 2}
                                />
                                <text
                                  x={p.x}
                                  y="178"
                                  textAnchor="middle"
                                  fill={isHovered ? "#202223" : "#6D7175"}
                                  fontSize="11"
                                  fontWeight={isHovered ? "600" : "500"}
                                >
                                  {p.label}
                                </text>
                              </g>
                            );
                          })}

                          {/* Hover Trigger Rectangles */}
                          {points.map((p) => {
                            const stepX = trendLen > 1 ? plotWidth / (trendLen - 1) : plotWidth;
                            const rectX = p.x - stepX / 2;
                            return (
                              <rect
                                key={`zone-${p.label || p.idx}`}
                                x={Math.max(0, rectX)}
                                y="0"
                                width={stepX}
                                height="195"
                                fill="transparent"
                                cursor="pointer"
                                onMouseEnter={() => setHoveredIdx(p.idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                              />
                            );
                          })}
                        </svg>

                        {/* Floating Tooltip */}
                        {hoveredPoint && (
                          <div
                            style={{
                              position: "absolute",
                              left: `${(hoveredPoint.x / 520) * 100}%`,
                              top: `${(hoveredPoint.y / 195) * 100}%`,
                              transform: "translate(-50%, -125%)",
                              backgroundColor: "#1A1A1A",
                              color: "#FFFFFF",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: "500",
                              whiteSpace: "nowrap",
                              zIndex: 40,
                              pointerEvents: "none",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                            }}
                          >
                            <div style={{ fontWeight: "700" }}>
                              {hoveredPoint.fullDate
                                ? `${hoveredPoint.dayName || hoveredPoint.label} (${hoveredPoint.fullDate})`
                                : hoveredPoint.dateRange
                                ? `${hoveredPoint.label} • ${hoveredPoint.dateRange}`
                                : hoveredPoint.month && hoveredPoint.year
                                ? `${hoveredPoint.month} ${hoveredPoint.year}`
                                : hoveredPoint.label}
                            </div>
                            <div>{formatCurrency(hoveredPoint.recovered)} • {hoveredPoint.count || 0} orders</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Minimal Legend */}
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="150" blockAlign="center">
                    <span style={{ display: "inline-block", width: "8px", height: "8px", backgroundColor: "#2C6ECB", borderRadius: "50%" }} />
                    <Text variant="bodyXs" tone="subdued">Cash recovered through automations</Text>
                  </InlineStack>
                  <Text variant="bodyXs" tone="subdued">
                    {timeframe === "daily" ? "Past 7 days" : timeframe === "weekly" ? "Past 4 weeks" : "Past 6 months"}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Performance by Strategy */}
            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text variant="headingSm" as="h3" fontWeight="semibold">
                      Performance by strategy
                    </Text>
                    <Text variant="bodyXs" tone="subdued">
                      Revenue share by promotional channel
                    </Text>
                  </BlockStack>
                  <Text variant="bodySm" fontWeight="bold">
                    {formatCurrency(data.totalCashRecovered)}
                  </Text>
                </InlineStack>

                {/* Simple Strategy List with proper spacing */}
                <BlockStack gap="300">
                  {(data.badgeBreakdown || []).map((item) => (
                    <div key={item.key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                        <span style={{ fontWeight: "600", color: "#202223" }}>{item.title}</span>
                        <span style={{ fontWeight: "600", color: "#202223" }}>
                          {formatCurrency(item.cashRecovered)}{" "}
                          <span style={{ color: "#6D7175", fontWeight: "normal" }}>({item.percentage}%)</span>
                        </span>
                      </div>

                      {/* Custom Sleek Progress Bar */}
                      <div
                        style={{
                          height: "6px",
                          backgroundColor: "#F1F2F4",
                          borderRadius: "3px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(item.percentage, 2)}%`,
                            height: "100%",
                            backgroundColor: item.color || "#2C6ECB",
                            borderRadius: "3px",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#6D7175" }}>
                        <span>{item.badgesUsed.toLocaleString()} products enrolled</span>
                        <span
                          style={{ color: "#2C6ECB", cursor: "pointer", fontWeight: "500" }}
                          onClick={() => item.link && navigate(item.link)}
                        >
                          Manage →
                        </span>
                      </div>
                    </div>
                  ))}
                </BlockStack>

                <Divider />

                {/* Simple Store Inventory Health Bar */}
                <BlockStack gap="150">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6D7175" }}>
                    <span>Store inventory health</span>
                    <span style={{ fontWeight: "600", color: "#202223" }}>
                      {data.stockHealth.healthyCount + data.stockHealth.slowMovingCount + data.stockHealth.deadStockCount} variants
                    </span>
                  </div>
                  <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", backgroundColor: "#F1F2F4" }}>
                    <div style={{ width: `${data.stockHealth.healthyPercent}%`, backgroundColor: "#008060" }} title="Healthy" />
                    <div style={{ width: `${data.stockHealth.slowMovingPercent}%`, backgroundColor: "#EEC200" }} title="Slow Moving" />
                    <div style={{ width: `${data.stockHealth.deadStockPercent}%`, backgroundColor: "#D72C0D" }} title="Dead Stock" />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#6D7175", paddingTop: "2px" }}>
                    <span>🟢 Healthy: {data.stockHealth.healthyPercent}%</span>
                    <span>🟡 Slow: {data.stockHealth.slowMovingPercent}%</span>
                    <span>🔴 Dead: {data.stockHealth.deadStockPercent}%</span>
                  </div>
                </BlockStack>
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>

        {/* ==================================================
            3. RECOMMENDATIONS & RECENT ACTIVITY
            ================================================== */}
        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Recommendations Column */}
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3" fontWeight="semibold">
                Recommendations
              </Text>

              {(data.recommendations || []).map((rec) => (
                <Card key={rec.id} padding="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodyMd" fontWeight="semibold">
                        {rec.title}
                      </Text>
                      <Badge tone={rec.tone}>{rec.tag}</Badge>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">
                      {rec.description}
                    </Text>
                    <div style={{ paddingTop: "4px" }}>
                      <Button
                        variant="primary"
                        onClick={() => rec.link && navigate(rec.link)}
                      >
                        {rec.actionText}
                      </Button>
                    </div>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>

            {/* Activity Column */}
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3" fontWeight="semibold">
                Recent activity
              </Text>

              <Card padding="300">
                <BlockStack gap="200">
                  {(data.activityFeed || []).map((act, index) => (
                    <div
                      key={act.id}
                      style={{
                        paddingBottom: index < data.activityFeed.length - 1 ? "10px" : "0",
                        borderBottom: index < data.activityFeed.length - 1 ? "1px solid #F1F2F4" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Text variant="bodySm" fontWeight="semibold">
                          {act.title}
                        </Text>
                        <Text variant="bodyXs" tone="subdued">
                          {act.time}
                        </Text>
                      </div>
                      <Text variant="bodyXs" tone="subdued">
                        {act.description}
                      </Text>
                    </div>
                  ))}
                </BlockStack>
              </Card>
            </BlockStack>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
