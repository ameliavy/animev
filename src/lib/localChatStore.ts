// Local-storage backed chat persistence (per logged-in user).
// Replaces the cloud "conversations" + "messages" tables for storage purposes.

export type LocalMsg = { role: "user" | "assistant"; content: string };

export type LocalConversation = {
  id: string;
  user_id: string;
  anime: string;
  character_name: string;
  messages: LocalMsg[];
  created_at: string;
  updated_at: string;
};

const KEY = (userId: string) => `animev:conversations:${userId}`;

const read = (userId: string): LocalConversation[] => {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as LocalConversation[]) : [];
  } catch {
    return [];
  }
};

const write = (userId: string, list: LocalConversation[]) => {
  localStorage.setItem(KEY(userId), JSON.stringify(list));
};

export const listConversations = (userId: string): LocalConversation[] =>
  read(userId).sort((a, b) => b.updated_at.localeCompare(a.updated_at));

export const getConversation = (
  userId: string,
  id: string
): LocalConversation | null => read(userId).find((c) => c.id === id) ?? null;

export const createConversation = (
  userId: string,
  anime: string,
  character_name: string
): LocalConversation => {
  const now = new Date().toISOString();
  const convo: LocalConversation = {
    id: crypto.randomUUID(),
    user_id: userId,
    anime,
    character_name,
    messages: [],
    created_at: now,
    updated_at: now,
  };
  const list = read(userId);
  list.push(convo);
  write(userId, list);
  return convo;
};

export const saveMessages = (
  userId: string,
  id: string,
  messages: LocalMsg[]
) => {
  const list = read(userId);
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], messages, updated_at: new Date().toISOString() };
  write(userId, list);
};

export const deleteConversation = (userId: string, id: string) => {
  write(
    userId,
    read(userId).filter((c) => c.id !== id)
  );
};

export const hasAnyConversation = (userId: string): boolean =>
  read(userId).length > 0;
