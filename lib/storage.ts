import { Storage } from "@plasmohq/storage"

const storage = new Storage()

const DRAFT_KEY = "tweet-draft"
const PENDING_POST_KEY = "pending-post"
const AUTO_MODE_KEY = "auto-mode-enabled"
const PUTER_SESSION_KEY = "puter-session"

export const loadDraft = async () => {
  const value = await storage.get<string>(DRAFT_KEY)
  return value ?? ""
}

export const saveDraft = async (draft: string) => {
  await storage.set(DRAFT_KEY, draft)
}

export const clearDraft = async () => {
  await storage.remove(DRAFT_KEY)
}

export type PendingPost = {
  text: string
  createdAt: number
}

export const savePendingPost = async (post: PendingPost) => {
  await storage.set(PENDING_POST_KEY, post)
}

export const loadPendingPost = async () => {
  return (await storage.get<PendingPost>(PENDING_POST_KEY)) ?? null
}

export const clearPendingPost = async () => {
  await storage.remove(PENDING_POST_KEY)
}

export const loadAutoModeEnabled = async () => {
  return (await storage.get<boolean>(AUTO_MODE_KEY)) ?? false
}

export const saveAutoModeEnabled = async (enabled: boolean) => {
  await storage.set(AUTO_MODE_KEY, enabled)
}

export type PuterSession = {
  token: string
  appId: string
  username?: string
}

export const loadPuterSession = async () => {
  return (await storage.get<PuterSession>(PUTER_SESSION_KEY)) ?? null
}

export const savePuterSession = async (session: PuterSession) => {
  await storage.set(PUTER_SESSION_KEY, session)
}

export const clearPuterSession = async () => {
  await storage.remove(PUTER_SESSION_KEY)
}
