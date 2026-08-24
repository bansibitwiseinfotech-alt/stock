/**
 * ============================================================================
 * SMART STOCK - PROGRESSIVE MARKDOWN STOREFRONT CLIENT
 * ============================================================================
 * Handles Progressive Markdown storefront block cleanup and synchronization.
 */

(function () {
  'use strict';

  function initProgressiveMarkdown(container) {
    if (!container) return;
    try {
      container.remove();
    } catch (e) {
      container.style.display = 'none';
    }
  }

  function initAll() {
    var containers = document.querySelectorAll('[data-progressive-markdown-root]');
    containers.forEach(initProgressiveMarkdown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', initAll);
})();

