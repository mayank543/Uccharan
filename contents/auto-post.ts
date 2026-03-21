import type { PlasmoCSConfig } from "plasmo"

import { clearDraft, clearPendingPost, loadPendingPost } from "~/lib/storage"

const POST_MAX_AGE_MS = 2 * 60 * 1000
const CLOSE_TAB_DELAY_MS = 1500

export const config: PlasmoCSConfig = {
  matches: ["https://twitter.com/*", "https://x.com/*"],
  run_at: "document_idle"
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const getComposerEditor = () => {
  const editorSelectors = [
    '[data-testid="tweetTextarea_0"]',
    'div[role="textbox"][contenteditable="true"]',
    '[contenteditable="true"][data-testid*="tweet"]'
  ]

  for (const selector of editorSelectors) {
    const editor = document.querySelector<HTMLElement>(selector)
    if (editor) {
      return editor
    }
  }

  return null
}

const isSupportedXPage = () => {
  const url = new URL(window.location.href)
  return url.hostname === "x.com" || url.hostname === "twitter.com"
}

const dispatchClick = (element: HTMLElement) => {
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  element.click()
}

const triggerComposerShortcut = () => {
  const editor = getComposerEditor()
  if (!editor) {
    return false
  }

  editor.focus()

  const metaShortcut = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Enter",
    code: "Enter",
    metaKey: true
  })

  const ctrlShortcut = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Enter",
    code: "Enter",
    ctrlKey: true
  })

  editor.dispatchEvent(metaShortcut)
  editor.dispatchEvent(ctrlShortcut)
  return true
}

const clickPostButton = () => {
  const selectors = [
    '[data-testid="tweetButton"]',
    '[data-testid="tweetButtonInline"]',
    '[data-testid="SideNav_NewTweet_Button"]',
    'div[role="button"][data-testid="tweetButton"]',
    'button[data-testid="tweetButton"]',
    'button[aria-label="Post"]',
    'div[role="button"][aria-label="Post"]'
  ]

  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector)
    if (!element) {
      continue
    }

    const disabled =
      element.getAttribute("aria-disabled") === "true" ||
      (element instanceof HTMLButtonElement && element.disabled)

    if (disabled) {
      continue
    }

    dispatchClick(element)
    return true
  }

  const buttonCandidates = Array.from(document.querySelectorAll<HTMLElement>('button, div[role="button"]'))

  for (const element of buttonCandidates) {
    const label = (element.textContent ?? "").trim().toLowerCase()
    if (label !== "post" && label !== "tweet") {
      continue
    }

    const disabled =
      element.getAttribute("aria-disabled") === "true" ||
      (element instanceof HTMLButtonElement && element.disabled)

    if (disabled) {
      continue
    }

    dispatchClick(element)
    return true
  }

  return false
}

const ensureComposerHasText = async (text: string) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const editor = getComposerEditor()
    if (editor) {
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
  if (!isSupportedXPage()) {
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

  const hasComposer = await ensureComposerHasText(pendingPost.text)
  if (!hasComposer) {
    return
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (clickPostButton()) {
      await clearDraft()
      await clearPendingPost()
      window.setTimeout(() => {
        window.close()
      }, CLOSE_TAB_DELAY_MS)
      return
    }

    if (triggerComposerShortcut()) {
      await clearDraft()
      await clearPendingPost()
      window.setTimeout(() => {
        window.close()
      }, CLOSE_TAB_DELAY_MS)
      return
    }

    await sleep(500)
  }
}

void runAutoPost()
