export const ANIMES = [
  { name: "Demon Slayer", emoji: "🗡️", color: "from-red-500/30 to-orange-500/30" },
  { name: "Jujutsu Kaisen", emoji: "👁️", color: "from-violet-500/30 to-fuchsia-500/30" },
  { name: "Naruto", emoji: "🍥", color: "from-orange-500/30 to-yellow-500/30" },
  { name: "One Piece", emoji: "🏴‍☠️", color: "from-amber-500/30 to-red-500/30" },
  { name: "Vanitas no Carte", emoji: "🌙", color: "from-blue-500/30 to-indigo-500/30" },
  { name: "Bungo Stray Dogs", emoji: "🎩", color: "from-slate-500/30 to-cyan-500/30" },
  { name: "Black Butler", emoji: "🖤", color: "from-zinc-700/40 to-purple-900/40" },
] as const;

export type AnimeName = (typeof ANIMES)[number]["name"];
