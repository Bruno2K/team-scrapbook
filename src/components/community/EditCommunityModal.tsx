import { useState, useEffect } from "react";
import type { CommunityDetail } from "@/lib/types";
import type { TF2Class, Team } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { UpdateCommunityInput } from "@/api/communities";

const TF2_CLASSES: TF2Class[] = [
  "Scout", "Soldier", "Pyro", "Demoman", "Heavy", "Engineer", "Medic", "Sniper", "Spy",
];
const TEAMS: Team[] = ["RED", "BLU"];

interface EditCommunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  community: CommunityDetail | null;
  onSubmit: (data: UpdateCommunityInput) => Promise<void>;
  loading?: boolean;
}

export function EditCommunityModal({
  open,
  onOpenChange,
  community,
  onSubmit,
  loading = false,
}: EditCommunityModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [dominantClass, setDominantClass] = useState<string>("");
  const [team, setTeam] = useState<string>("");

  useEffect(() => {
    if (community) {
      setName(community.name);
      setDescription(community.description);
      setIsPrivate(community.isPrivate ?? false);
      setDominantClass(community.dominantClass ?? "");
      setTeam(community.team ?? "");
    }
  }, [community]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      isPrivate,
      dominantClass: dominantClass || null,
      team: team || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar comunidade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Nome</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-desc">Descrição</Label>
            <textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="edit-private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              className="data-[state=checked]:bg-accent"
            />
            <Label htmlFor="edit-private" className="cursor-pointer">Comunidade privada</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-class">Classe dominante</Label>
              <select
                id="edit-class"
                value={dominantClass}
                onChange={(e) => setDominantClass(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhuma</option>
                {TF2_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-team">Time</Label>
              <select
                id="edit-team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhum</option>
                {TEAMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !description.trim()}>
              {loading ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
