const mongoose = require("mongoose");

// ==================================================
// EmailSettings Model
// Collection: tbl_emailsettings
// One document per merchant shop.
// ==================================================

const emailSettingsSchema = new mongoose.Schema(
  {
    shop: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    weeklyDigestEnabled: {
      type: Boolean,
      default: true,
    },

    weeklyDigestDay: {
      type: String,
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      default: "monday",
    },

    // Stored as HH:mm — e.g. "09:00", "18:30"
    weeklyDigestTime: {
      type: String,
      default: "09:00",
      trim: true,
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata",
      trim: true,
    },

    lastWeeklyDigestSentAt: {
      type: Date,
      default: null,
    },

    // Duplicate-prevention key:
    // Format: "shop-YYYY-MM-DD-HH:mm"
    // Set after successful send for this scheduled slot.
    lastDigestScheduleKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "tbl_emailsettings",
  }
);

module.exports =
  mongoose.models.EmailSettings ||
  mongoose.model("EmailSettings", emailSettingsSchema, "tbl_emailsettings");