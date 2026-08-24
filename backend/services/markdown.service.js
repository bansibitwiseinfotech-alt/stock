const progressiveMarkdownService = require("./progressiveMarkdownService");

module.exports = {
  createMarkdownRule: progressiveMarkdownService.createMarkdownRule,
  processMarkdownRule: progressiveMarkdownService.processActiveMarkdownRules,
  processDueMarkdownRules: progressiveMarkdownService.processActiveMarkdownRules,
  pauseMarkdownRule: progressiveMarkdownService.pauseMarkdownRule,
  stopMarkdownRule: progressiveMarkdownService.stopMarkdownRule,
  getMarkdownRules: progressiveMarkdownService.getMarkdownRules,
  getMarkdownRuleByVariant: progressiveMarkdownService.getMarkdownRuleByVariant,
  getStorefrontMarkdownData: progressiveMarkdownService.getStorefrontMarkdownData,
};

