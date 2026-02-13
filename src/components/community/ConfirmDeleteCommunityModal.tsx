import type { Community } from "@/lib/types";
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

interface ConfirmDeleteCommunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  community: Community | null;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function ConfirmDeleteCommunityModal({
  open,
  onOpenChange,
  community,
  onConfirm,
  loading = false,
}: ConfirmDeleteCommunityModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir comunidade?</AlertDialogTitle>
          <AlertDialogDescription>
            {community
              ? `"${community.name}" será excluída permanentemente. Todas as publicações e dados serão perdidos.`
              : "Esta comunidade será excluída permanentemente."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Excluindo…" : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
