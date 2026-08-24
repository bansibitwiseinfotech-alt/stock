async function getReportMetrics(req, res) {
  try {
    return res.status(200).json({
      success: true,
      data: {
        totalCashRecovered: 14250,
        growthPercentage: 12.5,
        salesGenerated: 32450,
        ordersCount: 450,
        productsSold: 1250,
        chartData: [
          { date: "Apr 5", cash: 2000, sales: 5000 },
          { date: "Apr 11", cash: 4500, sales: 11000 },
          { date: "Apr 16", cash: 7000, sales: 18000 },
          { date: "Apr 21", cash: 10500, sales: 25000 },
          { date: "May 1", cash: 14250, sales: 32450 },
        ],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load report metrics." });
  }
}

module.exports = {
  getReportMetrics,
};
