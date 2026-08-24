const cron = require("node-cron");

const {
    processDueMarkdownRules,
} = require("../services/markdown.service");

function startMarkdownJob() {
    // Runs every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
        console.log(
            "[Markdown Job] Checking due rules..."
        );

        try {
            const results =
                await processDueMarkdownRules();

            console.log(
                "[Markdown Job] Completed:",
                results
            );
        } catch (error) {
            console.error(
                "[Markdown Job] Error:",
                error
            );
        }
    });

    console.log(
        "[Markdown Job] Started"
    );
}

module.exports = {
    startMarkdownJob,
};
