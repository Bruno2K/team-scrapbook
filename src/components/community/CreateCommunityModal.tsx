import { useState } from "react";
import type { TF2Class, Team } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateCommunityInput } from "@/api/communities";

const TF2_CLASSES: TF2Class[] = [
  "Scout", "Soldier", "Pyro", "Demoman", "Heavy", "Engineer", "Medic", "Sniper", "Spy",
];
const TEAMS: Team[] = ["RED", "BLU"];

interface CreateCommunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateCommunityInput) => Promise<void>;
  loading?: boolean;
}

export function CreateCommunityModal({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
}: CreateCommunityModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dominantClass, setDominantClass] = useState<string>("");
  const [team, setTeam] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      dominantClass: dominantClass || undefined,
      team: team || undefined,
    });
    setName("");
    setDescription("");
    setDominantClass("");
    setTeam("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar comunidade</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="create-name">Nome</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Pootis"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="create-desc">Descrição</Label>
            <textarea
              id="create-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que sua comunidade representa?"
              required
              rows={3}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="create-class">Classe dominante</Label>
              <select
                id="create-class"
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
              <Label htmlFor="create-team">Time</Label>
              <select
                id="create-team"
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
              {loading ? "Criando…" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
