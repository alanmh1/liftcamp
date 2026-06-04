import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/test")({
  component: TestPage,
});

function TestPage() {
  return (
    <div className="p-8">
      <h1>Test Page</h1>
      <Link to="/" className="text-blue-500 underline block mt-4">
        Go Home
      </Link>
    </div>
  );
}
