import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/test/$id")({
  component: TestIdPage,
});

function TestIdPage() {
  const { id } = Route.useParams();
  return (
    <div className="p-8">
      <h1>Test ID Page</h1>
      <p>ID: {id}</p>
      <Link to="/" className="text-blue-500 underline block mt-4">
        Go Home
      </Link>
    </div>
  );
}
