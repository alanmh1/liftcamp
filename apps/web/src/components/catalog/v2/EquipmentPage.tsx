import { REGIONS, type Region } from "@/lib/muscle-regions";
import { EQUIPMENT_PAGES, type EquipmentPage as EquipmentPageData } from "@/lib/equipment-pages";
import type { CatalogRow } from "@/lib/public-catalog.functions";
import { Breadcrumb, HubHero, HubShell, LinkBand, RowList, regionLabel } from "./HubParts";

/** Equipment index page: one flat, fully server-rendered list. Authored rows
 *  (has_notes) lead, matching the region pages and giving the indexable
 *  detail pages an internal link from an indexed page. */
export function EquipmentPage({
  page,
  rows,
  counts,
}: {
  page: EquipmentPageData;
  rows: CatalogRow[];
  counts: Record<Region, number>;
}) {
  const sorted = [...rows].sort(
    (a, b) => Number(b.has_notes) - Number(a.has_notes) || (a.name < b.name ? -1 : 1),
  );

  return (
    <HubShell>
      <HubHero
        breadcrumb={<Breadcrumb items={[]} current={page.label} />}
        h1={page.h1}
        intro={[page.intro]}
        count={`${rows.length} exercises.`}
      />

      <div className="mx-auto max-w-4xl px-ds-lg pb-ds-2xl">
        <RowList rows={sorted} />
      </div>

      <LinkBand
        groups={[
          {
            id: "by-equipment",
            title: "By equipment",
            links: Object.values(EQUIPMENT_PAGES)
              .filter((p) => p.slug !== page.slug)
              .map((p) => ({ label: p.label, slug: p.slug })),
          },
          {
            id: "by-muscle",
            title: "By muscle",
            links: REGIONS.map((r) => ({ label: regionLabel(r), slug: r, count: counts[r] })),
          },
        ]}
      />
    </HubShell>
  );
}
