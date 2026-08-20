import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy alias. My Quotes now lives on the external landing page, so this path
 * just forwards there (preserving the requested tab).
 */
export const Route = createFileRoute("/my-quotes")({
  validateSearch: (search: Record<string, unknown>): { tab?: "submitted" | "drafts" } =>
    search["tab"] === "drafts" ? { tab: "drafts" } : {},
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/request-quote",
      search: search.tab === "drafts" ? { tab: "drafts" as const } : {},
      replace: true,
    });
  },
});
