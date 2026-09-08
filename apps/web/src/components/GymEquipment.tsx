import { useGymSettings } from "@/lib/gym-settings";
import { DEFAULT_BAR, DEFAULT_PLATES, DEFAULT_PAIRS, trimNum, type PlateInventory } from "@/lib/plate-math";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Custom gym inventory: bar weight plus how many pairs of each plate the
 * lifter can actually reach. Drives the plate calculator.
 */
export function GymEquipment() {
  const { unit, bar, inventory, save } = useGymSettings();

  const sizes = Array.from(
    new Set([...DEFAULT_PLATES[unit], ...Object.keys(inventory).map(Number)]),
  )
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);

  function pairsFor(size: number): number {
    const v = Number(inventory[String(size)] ?? 0);
    return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }

  function setPairs(size: number, pairs: number) {
    const next: PlateInventory = { ...inventory };
    if (pairs <= 0) delete next[String(size)];
    else next[String(size)] = pairs;
    save({ plate_inventory: next });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="micro text-muted-foreground">Gym equipment</p>
        <p className="text-sm text-muted-foreground">
          Used by the plate calculator on barbell sets.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="bar-weight" className="text-sm w-24 shrink-0">
          Bar weight
        </label>
        <Input
          id="bar-weight"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          placeholder={String(DEFAULT_BAR[unit])}
          defaultValue={bar}
          key={`${unit}-${bar}`}
          onBlur={(e) => {
            const t = e.target.value.trim();
            if (t === "") return save({ bar_weight: null });
            const n = Number(t);
            if (Number.isFinite(n) && n > 0) save({ bar_weight: n });
          }}
          className="font-mono"
        />
        <span className="text-sm text-muted-foreground w-8">{unit}</span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm">Plate pairs available</p>
        <ul className="flex flex-col gap-1.5">
          {sizes.map((size) => {
            const pairs = pairsFor(size);
            return (
              <li key={size} className="flex items-center gap-2">
                <span className="num w-16 shrink-0 text-sm">
                  {trimNum(size)} {unit}
                </span>
                <div className="inline-flex overflow-hidden rounded-md border border-input text-[13px]">
                  {[0, 1, 2, 4, 6, DEFAULT_PAIRS].map((n, i) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPairs(size, n)}
                      aria-pressed={pairs === n}
                      className={cn(
                        "num h-8 px-2.5",
                        i > 0 && "border-l border-input",
                        pairs === n ? "bg-accent font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-muted-foreground">
          Set a size to 0 if your gym doesn't have it.
        </p>
      </div>
    </section>
  );
}
