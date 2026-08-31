const Automation = require("../models/Automation");

async function getAutomations(req, res) {
  try {
    const shopId = req.shopId || req.query.shop;
    const items = await Automation.find({ shopId }).sort({ createdAt: 1 }).lean();
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to load automations." });
  }
}

async function toggleAutomation(req, res) {
  try {
    const shopId = req.shopId || req.query.shop || req.body?.shop;
    const { id, enabled } = req.body;

    const updated = await Automation.findOneAndUpdate(
      { shopId, _id: id },
      { $set: { enabled: Boolean(enabled) } },
      { returnDocument: "after" }
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to update automation." });
  }
}

module.exports = {
  getAutomations,
  toggleAutomation,
};
