import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/test-link")({
  component: TestLinkPage,
});

function TestLinkPage() {
  return (
    <div className="p-8">
      <h1>Test Link Page</h1>
      <Link
        to="/test/$id"
        params={{ id: "abc123" }}
        className="text-blue-500 underline block mt-4"
      >
        Go to Test ID
      </Link>
    </div>
  );
}
