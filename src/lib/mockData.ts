import type { User, Community, FeedItem, ScrapMessage, Achievement } from "./types";

const ACHIEVEMENTS: Achievement[] = [
  { id: "a1", title: "Primeiro Sangue", icon: "🩸", description: "Primeira kill no servidor" },
  { id: "a2", title: "Domination", icon: "💀", description: "Dominou 3 jogadores seguidos" },
  { id: "a3", title: "Über Charge!", icon: "⚡", description: "100 Übercharges completos" },
  { id: "a4", title: "Headshot Maestro", icon: "🎯", description: "500 headshots confirmados" },
  { id: "a5", title: "Sentry Buster", icon: "💥", description: "Destruiu 200 sentries" },
  { id: "a6", title: "Capture Master", icon: "🏁", description: "1000 pontos capturados" },
  { id: "a7", title: "Hat Collector", icon: "🎩", description: "Coletou 50 hats raros" },
  { id: "a8", title: "MVP da Rodada", icon: "⭐", description: "MVP 100 vezes" },
];

export const CURRENT_USER: User = {
  id: "u1",
  name: "Carlos 'Pyro' Silva",
  nickname: "PyroManiac_BR",
  team: "RED",
  mainClass: "Pyro",
  level: 42,
  avatar: "",
  achievements: ACHIEVEMENTS.slice(0, 6),
  reputation: ["Top Fragger", "Carregou o Time"],
  online: true,
};

export const MOCK_USERS: User[] = [
  CURRENT_USER,
  {
    id: "u2",
    name: "Ana 'Medic' Souza",
    nickname: "HealQueen",
    team: "BLU",
    mainClass: "Medic",
    level: 55,
    avatar: "",
    achievements: ACHIEVEMENTS.slice(2, 5),
    reputation: ["Medic de Confiança"],
    online: true,
  },
  {
    id: "u3",
    name: "Ricardo 'Sniper' Lima",
    nickname: "OneShot_Rick",
    team: "RED",
    mainClass: "Sniper",
    level: 38,
    avatar: "",
    achievements: ACHIEVEMENTS.slice(3, 7),
    reputation: ["Top Fragger", "Backstab Master"],
    online: false,
  },
  {
    id: "u4",
    name: "Julia 'Scout' Pereira",
    nickname: "SpeedDemon_JP",
    team: "BLU",
    mainClass: "Scout",
    level: 27,
    avatar: "",
    achievements: ACHIEVEMENTS.slice(0, 3),
    reputation: ["Carregou o Time"],
    online: true,
  },
  {
    id: "u5",
    name: "Pedro 'Heavy' Costa",
    nickname: "BigGunPedro",
    team: "RED",
    mainClass: "Heavy",
    level: 61,
    avatar: "",
    achievements: ACHIEVEMENTS.slice(1, 6),
    reputation: ["Top Fragger", "Carregou o Time"],
    online: true,
  },
  {
    id: "u6",
    name: "Mariana 'Spy' Santos",
    nickname: "ShadowBlade",
    team: "BLU",
    mainClass: "Spy",
    level: 45,
    avatar: "",
    achievements: ACHIEVEMENTS.slice(0, 4),
    reputation: ["Backstab Master"],
    online: false,
  },
  {
    id: "u7",
    name: "Thiago 'Engineer' Alves",
    nickname: "SentryMaster",
    team: "RED",
    mainClass: "Engineer",
    level: 33,
    avatar: "",
    achievements: ACHIEVEMENTS.slice(4, 8),
    reputation: ["Sentry God"],
    online: true,
  },
  {
    id: "u8",
    name: "Fernanda 'Demo' Oliveira",
    nickname: "BoomBoomFe",
    team: "BLU",
    mainClass: "Demoman",
    level: 29,
    avatar: "",
    achievements: ACHIEVEMENTS.slice(2, 6),
    reputation: ["Demolition Expert"],
    online: false,
  },
];

export const MOCK_COMMUNITIES: Community[] = [
  { id: "c1", name: "2Fort Veterans", description: "Veteranos do mapa mais icônico", members: 14523, dominantClass: "Sniper", team: "RED", isMember: true, friendsInCommunity: [MOCK_USERS[1], MOCK_USERS[2]] },
  { id: "c2", name: "Medics United", description: "Quem cura, vence!", members: 8901, dominantClass: "Medic", team: "BLU", isMember: true, friendsInCommunity: [MOCK_USERS[1]] },
  { id: "c3", name: "Spy Check!", description: "Paranoia é sobrevivência", members: 6234, dominantClass: "Spy", isMember: false, friendsInCommunity: [MOCK_USERS[2], MOCK_USERS[5]] },
  { id: "c4", name: "Dustbowl Defenders", description: "Defenda o ponto ou morra tentando", members: 11200, dominantClass: "Engineer", team: "RED", isMember: false, friendsInCommunity: [MOCK_USERS[4], MOCK_USERS[6]] },
  { id: "c5", name: "Hat Trading Brasil", description: "Compra, venda e troca de hats", members: 22100, dominantClass: "Scout", isMember: false, friendsInCommunity: [] },
  { id: "c6", name: "Competitive TF2 BR", description: "Cena competitiva brasileira", members: 5400, isMember: false, friendsInCommunity: [MOCK_USERS[3]] },
];

/** Mock: comunidades em que o usuário é membro (para sidebar / memberOnly). */
export const MOCK_MY_COMMUNITIES: Community[] = MOCK_COMMUNITIES.filter((c) => c.isMember === true);

/** Mock: recomendadas (não sou membro, amigos estão). */
export const MOCK_RECOMMENDED_COMMUNITIES: Community[] = MOCK_COMMUNITIES.filter((c) => c.isMember === false && (c.friendsInCommunity?.length ?? 0) > 0);

export const MOCK_FEED: FeedItem[] = [
  {
    id: "f1",
    user: MOCK_USERS[1],
    content: "Acabei de dar Übercharge no round decisivo! O Heavy agradeceu com um sandvich 🥪",
    timestamp: "5 min atrás",
    type: "post",
  },
  {
    id: "f2",
    user: MOCK_USERS[2],
    content: "🏆 Desbloqueou: Headshot Maestro — 500 headshots confirmados!",
    timestamp: "15 min atrás",
    type: "achievement",
  },
  {
    id: "f3",
    user: MOCK_USERS[3],
    content: "Entrou na comunidade '2Fort Veterans'. Bora dominar o forte! 🏰",
    timestamp: "32 min atrás",
    type: "community",
  },
  {
    id: "f4",
    user: MOCK_USERS[4],
    content: "POOTIS PENCER HERE! Novo recorde: 47 kills em uma única rodada. WHO TOUCHED MY GUN?!",
    timestamp: "1h atrás",
    type: "post",
  },
  {
    id: "f5",
    user: MOCK_USERS[5],
    content: "Backstab triplo no ponto final. 🗡️ Gentlemen.",
    timestamp: "2h atrás",
    type: "post",
  },
  {
    id: "f6",
    user: MOCK_USERS[6],
    content: "Minha sentry nível 3 segurou o último ponto sozinha. Engie life. 🔧",
    timestamp: "3h atrás",
    type: "post",
  },
  {
    id: "s1",
    user: MOCK_USERS[1],
    content: "E aí Pyro! Para de queimar meus pacientes, pelo amor 😂🔥",
    timestamp: "10 min atrás",
    type: "scrap",
    reaction: "burn",
  },
];

export const MOCK_SCRAPS: ScrapMessage[] = [
  {
    id: "s1",
    from: MOCK_USERS[1],
    content: "E aí Pyro! Para de queimar meus pacientes, pelo amor 😂🔥",
    timestamp: "10 min atrás",
    reaction: "burn",
  },
  {
    id: "s2",
    from: MOCK_USERS[4],
    content: "Bora jogar Dustbowl hoje? Preciso de um Pyro pra spy-check!",
    timestamp: "1h atrás",
    reaction: "heal",
  },
  {
    id: "s3",
    from: MOCK_USERS[5],
    content: "Parabéns pelo rank de Major! Merecido demais 🎖️",
    timestamp: "3h atrás",
  },
  {
    id: "s4",
    from: MOCK_USERS[2],
    content: "Te peguei 3x seguidas ontem no 2Fort. GG! 🎯",
    timestamp: "5h atrás",
    reaction: "headshot",
  },
];
