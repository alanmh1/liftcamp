import { createFileRoute, redirect } from "@tanstack/react-router";

// Progress folded into the History screen as a tab. The old /progress URL is
// kept as a permanent redirect so bookmarks and links keep working.
export const Route = createFileRoute("/progress")({
  beforeLoad: () => {
    throw redirect({ to: "/history", replace: true });
  },
});
