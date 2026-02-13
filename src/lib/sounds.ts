import type { ReactionType } from "./types";

/** Placeholder paths for reaction sounds. Add MP3 files under public/sounds/ to enable. */
export const REACTION_SOUND_PATHS: Record<ReactionType, string> = {
  headshot: "/sounds/headshot.mp3",
  heal: "/sounds/heal.mp3",
  burn: "/sounds/burn.mp3",
  backstab: "/sounds/backstab.mp3",
};

export function playReactionSound(reaction: ReactionType): void {
  const path = REACTION_SOUND_PATHS[reaction];
  const audio = new Audio(path);
  audio.play().catch(() => {});
}
