import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { Muscle } from "react-body-highlighter";

const Model = lazy(() => import("react-body-highlighter"));

type Props = {
  type: "anterior" | "posterior";
  data: { name: string; muscles: Muscle[]; frequency: number }[];
};

export function BodyDiagram({ type, data }: Props) {
  return (
    <ClientOnly fallback={<div style={{ aspectRatio: "1/2" }} />}>
      <Suspense fallback={<div style={{ aspectRatio: "1/2" }} />}>
        <Model
          type={type}
          data={data}
          highlightedColors={["#2563EB", "#93C5FD"]}
          bodyColor="#E5E7EB"
          style={{ width: "100%", height: "auto", padding: 0 }}
        />
      </Suspense>
    </ClientOnly>
  );
}
