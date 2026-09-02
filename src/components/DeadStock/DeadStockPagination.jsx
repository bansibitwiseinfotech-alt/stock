import React from "react";

import {
  Pagination,
  InlineStack,
  Text,
  Box,
} from "@shopify/polaris";

export default function DeadStockPagination({
  mode = "cursor",

  // Cursor pagination
  currentPage = 1,
  hasNextPage = false,
  hasPreviousPage = false,
  onNext,
  onPrevious,
  pageSize = 50,
  resultCount = 0,

  // MongoDB pagination
  pagination,
  onPageChange,
}) {
  // ============================================================
  // SHOPIFY GRAPHQL CURSOR MODE
  // ============================================================

  if (mode === "cursor") {
    return (
      <Box paddingBlockStart="400">
        <InlineStack
          align="space-between"
          blockAlign="center"
          gap="200"
          wrap
        >
          <Text
            variant="bodySm"
            tone="subdued"
          >
            {resultCount < pageSize &&
            !hasNextPage
              ? `${resultCount} product${
                  resultCount !== 1
                    ? "s"
                    : ""
                } total`
              : `${resultCount} product${
                  resultCount !== 1
                    ? "s"
                    : ""
                } on this page`}
          </Text>

          <InlineStack
            gap="200"
            blockAlign="center"
          >
            <Text
              variant="bodySm"
              tone="subdued"
            >
              Page {currentPage}
            </Text>

            <Pagination
              hasPrevious={
                hasPreviousPage
              }
              onPrevious={onPrevious}
              hasNext={hasNextPage}
              onNext={onNext}
              label={`Page ${currentPage}`}
            />
          </InlineStack>
        </InlineStack>
      </Box>
    );
  }

  // ============================================================
  // MONGODB OFFSET MODE
  // ============================================================

  const {
    page = 1,
    totalPages = 1,
    totalItems = 0,
  } = pagination || {};

  return (
    <Box paddingBlockStart="400">
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="200"
        wrap
      >
        <Text
          variant="bodySm"
          tone="subdued"
        >
          {totalItems} dead stock item
          {totalItems !== 1
            ? "s"
            : ""}{" "}
          total
        </Text>

        <InlineStack
          gap="200"
          blockAlign="center"
        >
          <Text
            variant="bodySm"
            tone="subdued"
          >
            Page {page} of{" "}
            {totalPages}
          </Text>

          <Pagination
            hasPrevious={page > 1}
            onPrevious={() =>
              onPageChange(page - 1)
            }
            hasNext={
              page < totalPages
            }
            onNext={() =>
              onPageChange(page + 1)
            }
            label={`Page ${page} of ${totalPages}`}
          />
        </InlineStack>
      </InlineStack>
    </Box>
  );
}