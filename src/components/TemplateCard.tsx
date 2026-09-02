import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { startWorkoutFromTemplate, type TemplateRow } from "@/lib/templates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** A user's own saved template: tap to start, menu to rename or delete.
 *  System routines use SystemTemplateCard instead. */
export function TemplateCard({ template }: { template: TemplateRow }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draftName, setDraftName] = useState(template.name);
  const [saving, setSaving] = useState(false);

  async function start() {
    if (!user || busy) return;
    setBusy(true);
    const id = await startWorkoutFromTemplate(user.id, template);
    if (!id) {
      setBusy(false);
      return;
    }
    navigate({ to: "/workout/$workoutId", params: { workoutId: id } });
  }

  function openRename() {
    setDraftName(template.name);
    setRenaming(true);
  }

  async function saveName() {
    const trimmed = draftName.trim();
    if (!user || saving) return;
    if (!trimmed || trimmed === template.name) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("templates")
      .update({ name: trimmed })
      .eq("id", template.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't rename that template. Try again.");
      return;
    }
    setRenaming(false);
    queryClient.invalidateQueries({ queryKey: ["templates", user.id] });
  }

  async function remove() {
    if (!user || saving) return;
    setSaving(true);
    // template_exercises cascades on template_id, so one delete is enough.
    const { error } = await supabase.from("templates").delete().eq("id", template.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't delete that template. Try again.");
      return;
    }
    setConfirmingDelete(false);
    toast.success(`${template.name} deleted.`);
    queryClient.invalidateQueries({ queryKey: ["templates", user.id] });
  }

  const count = template.template_exercises.length;

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 hover:bg-accent/40 transition-colors">
        <button
          onClick={start}
          disabled={busy}
          className="min-w-0 flex-1 text-left disabled:opacity-60"
        >
          <p className="text-sm font-semibold tracking-tight truncate">{template.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {busy ? "Starting…" : `${count} exercise${count === 1 ? "" : "s"}`}
          </p>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Template options"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={openRename}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void share()}>
              <Share2 className="mr-2 h-4 w-4" />
              Share link
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmingDelete(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename template</DialogTitle>
          </DialogHeader>
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveName();
            }}
            maxLength={60}
            autoFocus
            aria-label="Template name"
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setRenaming(false)}
              className="h-10 flex-1 rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
            <Button onClick={() => void saveName()} disabled={saving} className="h-10 flex-1 rounded-lg text-sm font-semibold">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {template.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The template is removed from your home screen. Workouts you already logged from
              it are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmingDelete(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
