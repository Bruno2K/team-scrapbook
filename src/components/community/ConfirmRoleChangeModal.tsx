import type { User } from "@/lib/types";
import type { CommunityMemberRoleValue } from "@/api/communities";
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

const ROLE_LABELS: Record<CommunityMemberRoleValue, string> = {
  MEMBER: "Membro",
  MODERATOR: "Moderador",
  ADMIN: "Admin",
};

interface ConfirmRoleChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  newRole: CommunityMemberRoleValue | null;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function ConfirmRoleChangeModal({
  open,
  onOpenChange,
  user,
  newRole,
  onConfirm,
  loading = false,
}: ConfirmRoleChangeModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  const roleLabel = newRole ? ROLE_LABELS[newRole] : "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Alterar cargo</AlertDialogTitle>
          <AlertDialogDescription>
            {user && roleLabel
              ? `Definir ${user.nickname} como ${roleLabel}?`
              : "Confirmar alteração de cargo?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={loading}
          >
            {loading ? "Salvando…" : "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
