chrome.runtime.onInstalled.addListener(() => {
  console.log("Uccharan extension installed")
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
