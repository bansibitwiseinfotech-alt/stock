const { processAllStoresMondayDigests } = require("../services/mondayBadgeDigest.service");

let jobInterval = null;
let isJobRunning = false;

/**
 * Execute a single iteration of the Monday Badge Digest background job.
 */
async function runMondayDigestIteration() {
  if (isJobRunning) {
    console.log("[MondayDigest Scheduler] Previous cycle still running. Skipping overlap.");
    return;
  }

  try {
    isJobRunning = true;
    await processAllStoresMondayDigests();
  } catch (err) {
    console.error("[MondayDigest Scheduler] Error during scheduler cycle:", err.message);
  } finally {
    isJobRunning = false;
  }
}

/**
 * Start the background scheduler for Monday Morning Smart Badge Digests.
 * Runs every 15 minutes to check which stores in their respective local timezones
 * have reached Monday 9:00 AM.
 */
function startMondayBadgeDigestScheduler(intervalMs = 15 * 60 * 1000) {
  if (jobInterval) {
    console.log("[MondayDigest Scheduler] Scheduler is already active.");
    return;
  }

  console.log(`[MondayDigest Scheduler] Initializing Monday Digest background worker (cycle interval: ${intervalMs / 1000}s)...`);

  // Run initial check after a short 10-second startup delay
  setTimeout(() => {
    runMondayDigestIteration().catch((err) =>
      console.error("[MondayDigest Scheduler] Startup check error:", err.message)
    );
  }, 10000);

  // Set recurring interval
  jobInterval = setInterval(() => {
    runMondayDigestIteration().catch((err) =>
      console.error("[MondayDigest Scheduler] Interval iteration error:", err.message)
    );
  }, intervalMs);

  // Allow process to exit cleanly if needed
  if (jobInterval && typeof jobInterval.unref === "function") {
    jobInterval.unref();
  }
}

/**
 * Stop the background scheduler
 */
function stopMondayBadgeDigestScheduler() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log("[MondayDigest Scheduler] Stopped Monday Digest background worker.");
  }
}

module.exports = {
  startMondayBadgeDigestScheduler,
  stopMondayBadgeDigestScheduler,
  runMondayDigestIteration,
};
