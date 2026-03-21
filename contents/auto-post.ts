import type { PlasmoCSConfig } from "plasmo"

import { clearPendingPost, loadPendingPost } from "~/lib/storage"

const AUTO_POST_HASH = "#uccharan-auto-post"
const POST_MAX_AGE_MS = 2 * 60 * 1000

export const config: PlasmoCSConfig = {
  matches: ["https://twitter.com/*", "https://x.com/*"],
  run_at: "document_idle"
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const isAutoPostPage = () => {
  const url = new URL(window.location.href)
  return url.hash === AUTO_POST_HASH && (url.hostname === "x.com" || url.hostname === "twitter.com")
}

const clickPostButton = () => {
  const selectors = [
    '[data-testid="tweetButton"]',
    '[data-testid="tweetButtonInline"]',
    '[data-testid="SideNav_NewTweet_Button"]',
    'div[role="button"][data-testid="tweetButton"]'
  ]

  for (const selector of selectors) {
    const element = document.querySelector<HTMLButtonElement | HTMLDivElement>(selector)
    if (!element) {
      continue
    }

    const disabled =
      element.getAttribute("aria-disabled") === "true" ||
      (element instanceof HTMLButtonElement && element.disabled)

    if (disabled) {
      return false
    }

    element.click()
    return true
  }

  return false
}

const ensureComposerHasText = async (text: string) => {
  const editorSelectors = [
    '[data-testid="tweetTextarea_0"]',
    'div[role="textbox"][contenteditable="true"]',
    '[contenteditable="true"][data-testid*="tweet"]'
  ]

  for (let attempt = 0; attempt < 30; attempt += 1) {
    for (const selector of editorSelectors) {
      const editor = document.querySelector<HTMLElement>(selector)
      if (!editor) {
        continue
      }

      const currentText = editor.innerText.trim()
      if (currentText.length > 0) {
        return true
      }

      editor.focus()
      document.execCommand("selectAll", false)
      document.execCommand("insertText", false, text)
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }))
      return true
    }

    await sleep(500)
  }

  return false
}

const runAutoPost = async () => {
  if (!isAutoPostPage()) {
    return
  }

  const pendingPost = await loadPendingPost()
  if (!pendingPost) {
    return
  }

  if (Date.now() - pendingPost.createdAt > POST_MAX_AGE_MS) {
    await clearPendingPost()
    return
  }

  await ensureComposerHasText(pendingPost.text)

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (clickPostButton()) {
      await clearPendingPost()
      return
    }

    await sleep(500)
  }
}

void runAutoPost()
