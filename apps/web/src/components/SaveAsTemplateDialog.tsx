import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { createTemplateFromExercises } from "@/lib/templates";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Names and saves a template from a finished workout. Shared by the history
 * card and the finish-workout dialog.
 */
export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  defaultName,
  exerciseIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  exerciseIds: string[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  // Re-seed each time it opens, so reopening after a rename shows the current
  // workout name rather than whatever was typed last time.
  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  async function save() {
    if (!user || saving) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const id = await createTemplateFromExercises(user.id, trimmed, exerciseIds);
    setSaving(false);
    if (!id) {
      toast.error("Couldn't save that template. Try again.");
      return;
    }
    onOpenChange(false);
    toast.success(`${trimmed} saved to your templates.`);
    queryClient.invalidateQueries({ queryKey: ["templates", user.id] });
  }

  const count = exerciseIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {count} exercise{count === 1 ? "" : "s"} in the same order. Weights aren't saved,
          since each session picks those up from your last performance.
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
          maxLength={60}
          autoFocus
          aria-label="Template name"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 flex-1 rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !name.trim()}
            className="h-10 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
