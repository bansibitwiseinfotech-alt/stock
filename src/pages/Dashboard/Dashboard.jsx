import React, { useEffect, useState, useCallback } from "react";
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
  for (let i = 5; i >= 0; i--) {
    const dEnd = new Date();
    dEnd.setDate(dEnd.getDate() - i * 7);
    const dStart = new Date(dEnd);
    dStart.setDate(dStart.getDate() - 6);
    const dStartStr = dStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dEndStr = dEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weeklyTrend.push({
      label: i === 0 ? "This Wk" : `Wk ${6 - i}`,
      dateRange: `${dStartStr} - ${dEndStr}`,
      recovered: Math.round(16800 + (5 - i) * 3800),
      count: Math.round(180 + (5 - i) * 40),
    });
  }

  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
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

const DASHBOARD_CACHE_KEY = "smart_stock_dashboard_cached_data_v1";

function getLocalCache(shop) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${DASHBOARD_CACHE_KEY}_${shop || "store"}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalCashRecovered !== "undefined") {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return null;
}

function setLocalCache(shop, val) {
  if (typeof window === "undefined" || !val) return;
  try {
    localStorage.setItem(`${DASHBOARD_CACHE_KEY}_${shop || "store"}`, JSON.stringify(val));
  } catch (e) {
    // Ignore storage quota errors
  }
}

export default function Dashboard({ shopDomain = "" }) {
  const navigate = useNavigate();

  const effectiveShop =
    shopDomain ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop") || ""
      : "");

  const navigateWithParams = (path) => {
    if (!path) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    const target = search && !path.includes("?") ? `${path}${search}` : path;
    navigate(target);
  };

  const initialTrends = getInitialTrends();
  const cachedData = getLocalCache(effectiveShop);

  const [loading, setLoading] = useState(!cachedData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [timeframe, setTimeframe] = useState("monthly"); // "daily" | "weekly" | "monthly"
  const [data, setData] = useState(() => {
    if (cachedData) {
      return cachedData;
    }
    return {
      totalCashRecovered: 0,
      growthPercentage: 0,
      deadStockCashTiedUp: 0,
      deadStockSkuCount: 0,
      revenueAtRisk: 0,
      highDemandRiskCount: 0,
      totalActiveAutomations: 0,
      dailyTrend: initialTrends.dailyTrend,
      weeklyTrend: initialTrends.weeklyTrend,
      monthlyTrend: initialTrends.monthlyTrend,
      stockHealth: {
        healthyPercent: 70,
        slowMovingPercent: 20,
        deadStockPercent: 10,
        healthyCount: 35,
        slowMovingCount: 9,
        deadStockCount: 6,
      },
      activityFeed: [],
      badgeBreakdown: [
        {
          key: "clearance",
          title: "Clearance Sales",
          badgesUsed: 0,
          cashRecovered: 0,
          percentage: 0,
          color: "#10B981",
          link: "/app/dead-stock",
        },
        {
          key: "bundle",
          title: "Bundle Offers",
          badgesUsed: 0,
          cashRecovered: 0,
          percentage: 0,
          color: "#F59E0B",
          link: "/app/bundles",
        },
        {
          key: "markdown",
          title: "Progressive Markdown",
          badgesUsed: 0,
          cashRecovered: 0,
          percentage: 0,
          color: "#8B5CF6",
          link: "/app/dead-stock",
        },
        {
          key: "preorder",
          title: "Pre-Orders & Badges",
          badgesUsed: 0,
          cashRecovered: 0,
          percentage: 0,
          color: "#0EA5E9",
          link: "/app/pre-orders",
        },
      ],
      recommendations: [
        {
          id: "rec-1",
          title: "Clear slow-moving products",
          description: "Items with zero or slow sales. Launch a clearance discount or markdown to recover tied-up capital.",
          actionText: "Create Clearance Sale",
          tag: "Dead stock",
          tone: "attention",
          link: "/app/dead-stock",
        },
        {
          id: "rec-2",
          title: "Protect revenue on high-demand products",
          description: "High velocity items risk stocking out. Enable pre-orders or low-stock urgency badges to secure orders.",
          actionText: "View High Demand",
          tag: "High velocity",
          tone: "info",
          link: "/app/high-demand",
        },
      ],
    };
  });

  const loadData = useCallback(async (isForced = false) => {
    try {
      if (isForced) {
        setIsRefreshing(true);
      }
      const res = await fetchDashboardData(effectiveShop, isForced);
      if (res && res.totalCashRecovered !== undefined) {
        setData((prev) => {
          const updated = {
            ...prev,
            totalCashRecovered: res.totalCashRecovered ?? prev.totalCashRecovered,
            growthPercentage: res.growthPercentage ?? prev.growthPercentage,
            deadStockCashTiedUp: res.deadStockCashTiedUp ?? prev.deadStockCashTiedUp,
            deadStockSkuCount: res.deadStockSkuCount ?? prev.deadStockSkuCount,
            revenueAtRisk: res.revenueAtRisk ?? prev.revenueAtRisk,
            highDemandRiskCount: res.highDemandRiskCount ?? prev.highDemandRiskCount,
            totalActiveAutomations: res.totalActiveAutomations ?? prev.totalActiveAutomations,
            dailyTrend: res.dailyTrend || prev.dailyTrend,
            weeklyTrend: res.weeklyTrend || prev.weeklyTrend,
            monthlyTrend: res.monthlyTrend || prev.monthlyTrend,
            stockHealth: res.stockHealth || prev.stockHealth,
            activityFeed: res.activityFeed && res.activityFeed.length > 0 ? res.activityFeed : prev.activityFeed,
            badgeBreakdown: res.badgeBreakdown || prev.badgeBreakdown,
            recommendations: res.smartRecipes
              ? res.smartRecipes.map((r) => ({
                  id: r.id,
                  title: r.title,
                  description: r.description,
                  actionText: r.recommendedAction,
                  tag: r.id.includes("summer") ? "Dead stock" : "High demand",
                  tone: r.id.includes("summer") ? "attention" : "info",
                  link: r.link,
                }))
              : prev.recommendations,
          };
          setLocalCache(effectiveShop, updated);
          return updated;
        });
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [effectiveShop]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

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
      secondaryActions={[
        {
          content: isRefreshing ? "Refreshing..." : "Refresh data",
          onAction: () => loadData(true),
          loading: isRefreshing,
          disabled: isRefreshing,
        },
      ]}
    >
      <Layout>
        {/* ==================================================
            1. KPI SUMMARY STATS CARDS
            ================================================== */}
        <Layout.Section>
          <div
            className="dashboard-metrics-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: "16px",
              width: "100%",
            }}
          >
            {/* Metric 1 */}
            <Card padding="400">
              <div className="dashboard-kpi-content">
                <InlineStack align="space-between" blockAlign="center" gap="100" wrap={false}>
                  <span className="dashboard-kpi-title">
                    Total cash recovered
                  </span>
                  <Badge tone="success">{`+${data.growthPercentage}%`}</Badge>
                </InlineStack>
                <div style={{ marginTop: "8px" }}>
                  <div className="dashboard-kpi-value">
                    {formatCurrency(data.totalCashRecovered)}
                  </div>
                  <div className="dashboard-kpi-subtext">
                    Across all active promotions
                  </div>
                </div>
              </div>
            </Card>

            {/* Metric 2 */}
            <Card padding="400">
              <div className="dashboard-kpi-content">
                <InlineStack align="space-between" blockAlign="center" gap="100" wrap={false}>
                  <span className="dashboard-kpi-title">
                    Dead stock cash tied up
                  </span>
                  <Badge tone="critical">{`${data.deadStockSkuCount} SKUs`}</Badge>
                </InlineStack>
                <div style={{ marginTop: "8px" }}>
                  <div className="dashboard-kpi-value">
                    {formatCurrency(data.deadStockCashTiedUp)}
                  </div>
                  <div
                    className="dashboard-kpi-subtext dashboard-kpi-link"
                    onClick={() => navigateWithParams("/app/dead-stock")}
                  >
                    View dead stock →
                  </div>
                </div>
              </div>                    
            </Card>    
                  
            {/* Metric 3 */}
            <Card padding="400">
              <div className="dashboard-kpi-content">
                <InlineStack align="space-between" blockAlign="center" gap="100" wrap={false}>
                  <span className="dashboard-kpi-title">
                    Revenue at risk
                  </span>
                  <Badge tone="attention">High demand</Badge>
                </InlineStack>
                <div style={{ marginTop: "8px" }}>
                  <div className="dashboard-kpi-value">
                    {formatCurrency(data.revenueAtRisk)}
                  </div>
                  <div
                    className="dashboard-kpi-subtext dashboard-kpi-link"
                    onClick={() => navigateWithParams("/app/high-demand")}
                  >
                    {data.highDemandRiskCount || 0} items at risk →
                  </div>
                </div>
              </div>
            </Card>

            {/* Metric 4 */}
            <Card padding="400">
              <div className="dashboard-kpi-content">
                <InlineStack align="space-between" blockAlign="center" gap="100" wrap={false}>
                  <span className="dashboard-kpi-title">
                    Active automations
                  </span>
                  <Badge tone="info">Running</Badge>
                </InlineStack>
                <div style={{ marginTop: "8px" }}>
                  <div className="dashboard-kpi-value">
                    {data.totalActiveAutomations ?? (data.badgeBreakdown || []).reduce((s, b) => s + (b.badgesUsed || 0), 0)}
                  </div>
                  <div className="dashboard-kpi-subtext">
                    Badges & discount rules active
                  </div>
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
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: "16px",
            }}
          >
            {/* Chart: Modern Clean Line Chart */}
            <Card padding="400">
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "380px", gap: "16px" }}>
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
                          onClick={() => {
                            setHoveredIdx(null);
                            setTimeframe(item.id);
                          }}
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

                {/* Perfect Responsive Chart Container */}
                <div style={{ width: "100%", position: "relative", flex: 1, minHeight: "270px" }}>
                  {(() => {
                    const trendLen = (activeTrendData || []).length;
                    const plotLeft = 70;
                    const plotRight = 480;
                    const plotWidth = plotRight - plotLeft;
                    const plotTop = 20;
                    const plotBottom = 245;
                    const plotHeight = plotBottom - plotTop;

                    const points = (activeTrendData || []).map((item, idx) => {
                      const stepX = trendLen > 1 ? plotWidth / (trendLen - 1) : plotWidth / 2;
                      const x = plotLeft + idx * stepX;
                      const ratio = Math.min(1, Math.max(0, (item.recovered || 0) / (activeMax || 1)));
                      const y = plotBottom - ratio * plotHeight;
                      return { ...item, x, y, idx };
                    });

                    // Smooth Bezier path passing through all points
                    const createSmoothPath = (pts) => {
                      if (!pts || pts.length === 0) return "";
                      if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

                      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
                      for (let i = 0; i < pts.length - 1; i++) {
                        const p0 = pts[i];
                        const p1 = pts[i + 1];
                        const dx = p1.x - p0.x;
                        const cp1x = p0.x + dx * 0.45;
                        const cp1y = p0.y;
                        const cp2x = p1.x - dx * 0.45;
                        const cp2y = p1.y;
                        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
                      }
                      return d;
                    };

                    const linePath = createSmoothPath(points);
                    const areaPath =
                      points.length > 0
                        ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${plotBottom} L ${points[0].x.toFixed(1)} ${plotBottom} Z`
                        : "";

                    const hoveredPoint = hoveredIdx !== null && hoveredIdx < points.length ? points[hoveredIdx] : null;

                    const gridLevels = [
                      { val: activeMax, y: plotTop },
                      { val: activeMax * 0.75, y: plotTop + plotHeight * 0.25 },
                      { val: activeMax * 0.5, y: plotTop + plotHeight * 0.5 },
                      { val: activeMax * 0.25, y: plotTop + plotHeight * 0.75 },
                      { val: 0, y: plotBottom },
                    ];

                    return (
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ width: "100%", height: "270px", position: "relative" }}>
                          <svg
                            viewBox="0 0 520 270"
                            style={{ width: "100%", height: "100%", overflow: "visible" }}
                          >
                            <defs>
                              <linearGradient id={`chartGrad-${timeframe}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#008060" stopOpacity="0.22" />
                                <stop offset="100%" stopColor="#008060" stopOpacity="0.0" />
                              </linearGradient>
                              <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#008060" floodOpacity="0.3" />
                              </filter>
                            </defs>

                            {/* Horizontal Gridlines & Y-Axis Labels */}
                            {gridLevels.map((lvl, i) => (
                              <g key={`grid-${i}`}>
                                <line
                                  x1={55}
                                  y1={lvl.y}
                                  x2={495}
                                  y2={lvl.y}
                                  stroke={i === gridLevels.length - 1 ? "#D2D5D8" : "#F1F2F4"}
                                  strokeDasharray={i === gridLevels.length - 1 ? "none" : "4 4"}
                                  strokeWidth="1"
                                />
                                <text
                                  x={48}
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

                            {/* Gradient Area Fill */}
                            {areaPath && <path d={areaPath} fill={`url(#chartGrad-${timeframe})`} />}

                            {/* Main Smooth Line */}
                            {linePath && (
                              <path
                                d={linePath}
                                fill="none"
                                stroke="#008060"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#shadow)"
                              />
                            )}

                            {/* Hover Vertical Line */}
                            {hoveredPoint && (
                              <line
                                x1={hoveredPoint.x}
                                y1={plotTop}
                                x2={hoveredPoint.x}
                                y2={plotBottom}
                                stroke="#008060"
                                strokeDasharray="3 3"
                                strokeWidth="1.5"
                                opacity="0.6"
                              />
                            )}

                            {/* Data Points and X-Axis Labels */}
                            {points.map((p) => {
                              const isHovered = hoveredIdx === p.idx;
                              return (
                                <g key={`pt-${timeframe}-${p.idx}`}>
                                  {isHovered && (
                                    <circle
                                      cx={p.x}
                                      cy={p.y}
                                      r="8"
                                      fill="#008060"
                                      fillOpacity="0.2"
                                    />
                                  )}
                                  <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={isHovered ? 5.5 : 4}
                                    fill="#FFFFFF"
                                    stroke="#008060"
                                    strokeWidth={isHovered ? 2.5 : 2}
                                  />
                                  <text
                                    x={p.x}
                                    y={plotBottom + 21}
                                    textAnchor="middle"
                                    fill={isHovered ? "#202223" : "#6D7175"}
                                    fontSize="12"
                                    fontWeight={isHovered ? "600" : "500"}
                                  >
                                    {p.label}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Invisible Mouse Hover Target Zones */}
                            {points.map((p) => {
                              const stepX = trendLen > 1 ? plotWidth / (trendLen - 1) : plotWidth;
                              const rectX = p.x - stepX / 2;
                              return (
                                <rect
                                  key={`target-${timeframe}-${p.idx}`}
                                  x={Math.max(0, rectX)}
                                  y="0"
                                  width={stepX}
                                  height="270"
                                  fill="transparent"
                                  cursor="pointer"
                                  onMouseEnter={() => setHoveredIdx(p.idx)}
                                  onMouseLeave={() => setHoveredIdx(null)}
                                />
                              );
                            })}
                          </svg>

                          {/* Rich Floating Tooltip */}
                          {hoveredPoint && (
                            <div
                              style={{
                                position: "absolute",
                                left: `${(hoveredPoint.x / 520) * 100}%`,
                                top: `${(hoveredPoint.y / 270) * 100}%`,
                                transform: "translate(-50%, -120%)",
                                backgroundColor: "#1A1A1A",
                                color: "#FFFFFF",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: "500",
                                whiteSpace: "nowrap",
                                zIndex: 40,
                                pointerEvents: "none",
                                boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                              }}
                            >
                              <div style={{ fontWeight: "700", marginBottom: "2px" }}>
                                {hoveredPoint.fullDate
                                  ? `${hoveredPoint.dayName || hoveredPoint.label} (${hoveredPoint.fullDate})`
                                  : hoveredPoint.dateRange
                                  ? `${hoveredPoint.label} • ${hoveredPoint.dateRange}`
                                  : hoveredPoint.month && hoveredPoint.year
                                  ? `${hoveredPoint.month} ${hoveredPoint.year}`
                                  : hoveredPoint.label}
                              </div>
                              <div style={{ color: "#34D399", fontWeight: "600" }}>
                                {formatCurrency(hoveredPoint.recovered)} <span style={{ color: "#9CA3AF", fontWeight: "400" }}>• {hoveredPoint.count || 0} orders</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Minimal Legend */}
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="150" blockAlign="center">
                    <span style={{ display: "inline-block", width: "8px", height: "8px", backgroundColor: "#008060", borderRadius: "50%" }} />
                    <Text variant="bodyXs" tone="subdued">Cash recovered through automations</Text>
                  </InlineStack>
                  <Text variant="bodyXs" tone="subdued">
                    {timeframe === "daily" ? "Past 7 days" : timeframe === "weekly" ? "Past 6 weeks" : "Past 6 months"}
                  </Text>
                </InlineStack>
              </div>
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
                          onClick={() => item.link && navigateWithParams(item.link)}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
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
                        onClick={() => rec.link && navigateWithParams(rec.link)}
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

              <Card padding="400">
                <BlockStack gap="250">
                  {(data.activityFeed || []).slice(0, 5).map((act, index, arr) => {
                    const isLast = index === arr.length - 1;

                    return (
                      <div
                        key={act.id || index}
                        style={{
                          paddingBottom: isLast ? "0" : "12px",
                          borderBottom: isLast ? "none" : "1px solid #F1F2F4",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                          <Text variant="bodySm" fontWeight="bold" as="p">
                            {act.title}
                          </Text>
                          <Text variant="bodyXs" tone="subdued" as="span" style={{ whiteSpace: "nowrap" }}>
                            {act.time}
                          </Text>
                        </div>
                        <div style={{ marginTop: "2px" }}>
                          <Text variant="bodyXs" tone="subdued" as="p">
                            {act.description}
                          </Text>
                        </div>
                      </div>
                    );
                  })}
                </BlockStack>
              </Card>
            </BlockStack>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
