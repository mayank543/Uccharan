import { loadAutoModeEnabled } from "~/lib/storage"

const DEFAULT_POPUP = "popup.html"
const RECORDER_PAGE = "tabs/recorder.html"

const syncActionPopup = async () => {
  const autoModeEnabled = await loadAutoModeEnabled()

  await chrome.action.setPopup({
    popup: autoModeEnabled ? RECORDER_PAGE : DEFAULT_POPUP
  })
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Uccharan extension installed")
  void syncActionPopup()
})

chrome.runtime.onStartup.addListener(() => {
  void syncActionPopup()
})

void syncActionPopup()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SET_AUTO_MODE" && typeof message.enabled === "boolean") {
    void chrome.action
      .setPopup({
        popup: message.enabled ? RECORDER_PAGE : DEFAULT_POPUP
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error: Error) =>
        sendResponse({
          ok: false,
          error: error.message
        })
      )

    return true
  }

  if (message?.type !== "OPEN_TWITTER_INTENT" || typeof message.url !== "string") {
    return false
  }

  chrome.tabs.create({ url: message.url, active: false }, (tab) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError.message
      })
      return
    }

    sendResponse({
      ok: true,
      tabId: tab?.id ?? null
    })
  })

  return true
})
