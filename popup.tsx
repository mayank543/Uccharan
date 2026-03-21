import "~/style.css"

import { useEffect, useRef, useState } from "react"

import { Toggle } from "~/components/toggle"
import { clearDraft, loadAutoModeEnabled, loadDraft, saveAutoModeEnabled, saveDraft, savePendingPost } from "~/lib/storage"
import { createSpeechController, isSpeechRecognitionSupported } from "~/lib/speech"
import { buildTwitterIntentUrl, getTweetLength, isTweetTooLong, MAX_TWEET_LENGTH } from "~/lib/twitter"

const Popup = () => {
  const [transcript, setTranscript] = useState("")
  const [interimText, setInterimText] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState("")
  const [isSupported, setIsSupported] = useState(true)
  const [autoModeEnabled, setAutoModeEnabled] = useState(false)
  const speechControllerRef = useRef<ReturnType<typeof createSpeechController>>(null)
  const transcriptRef = useRef("")
  const livePreviewRef = useRef("")
  const autoPostOnStopRef = useRef(false)

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  const postToX = async (rawText: string) => {
    const text = rawText.trim()

    if (!text) {
      setError("Add some text before opening Twitter.")
      return
    }

    if (isTweetTooLong(text)) {
      setError("This draft is over the tweet limit. Trim it before posting.")
      return
    }

    await savePendingPost({
      text,
      createdAt: Date.now()
    })

    const url = `${buildTwitterIntentUrl(text)}#uccharan-auto-post`

    chrome.runtime.sendMessage({ type: "OPEN_TWITTER_INTENT", url }, (response) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message ?? "Failed to open Twitter.")
        return
      }

      if (!response?.ok) {
        setError(response?.error ?? "Failed to open Twitter.")
      }
    })
  }

  const requestMicAndStart = () => {
    if (!speechControllerRef.current) {
      setError("Speech recognition is unavailable right now.")
      return
    }

    setError("")

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is unavailable in this browser context.")
      return
    }

    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop())
        speechControllerRef.current?.start()
      })
      .catch(() => {
        setError("Microphone access was denied. Allow mic access for this extension in Chrome settings.")
      })
  }

  useEffect(() => {
    const initialize = async () => {
      const supported = isSpeechRecognitionSupported()
      setIsSupported(supported)

      const [draft, autoMode] = await Promise.all([loadDraft(), loadAutoModeEnabled()])
      setTranscript(draft)
      setAutoModeEnabled(autoMode)

      if (!supported) {
        setError("Web Speech API is unavailable in this browser. Use Chrome for the best result.")
        return
      }

      speechControllerRef.current = createSpeechController({
        onStart: () => {
          setError("")
          setIsListening(true)
        },
        onResult: ({ finalText, interimText: interim }) => {
          setTranscript(finalText)
          setInterimText(interim)
        },
        onEnd: () => {
          setIsListening(false)
          setInterimText("")

          if (autoPostOnStopRef.current) {
            autoPostOnStopRef.current = false
            void postToX(livePreviewRef.current)
          }
        },
        onError: (message) => {
          setError(message)
          setIsListening(false)
          autoPostOnStopRef.current = false
        },
        getSeedText: () => transcriptRef.current
      })
    }

    void initialize()

    return () => {
      speechControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    void saveDraft(transcript)
  }, [transcript])

  const livePreview = `${transcript}${interimText ? ` ${interimText}` : ""}`.trim()
  const characterCount = getTweetLength(livePreview)
  const tooLong = isTweetTooLong(livePreview)

  useEffect(() => {
    livePreviewRef.current = livePreview
  }, [livePreview])

  const handleToggleListening = () => {
    if (isListening) {
      autoPostOnStopRef.current = autoModeEnabled
      speechControllerRef.current?.stop()
      return
    }

    requestMicAndStart()
  }

  const handleTranscriptChange = (value: string) => {
    setTranscript(value)
    setInterimText("")
  }

  const handleClear = async () => {
    setTranscript("")
    setInterimText("")
    setError("")
    autoPostOnStopRef.current = false
    await clearDraft()
  }

  const handleAutoModeChange = (enabled: boolean) => {
    setAutoModeEnabled(enabled)
    void saveAutoModeEnabled(enabled)
    chrome.runtime.sendMessage({ type: "SET_AUTO_MODE", enabled }, () => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message ?? "Failed to update auto mode.")
      }
    })
  }

  const handlePostToX = async () => {
    await postToX(livePreview)
  }

  return (
    <main className="min-h-screen bg-transparent p-4 text-ink">
      <section className="rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-card backdrop-blur">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Uccharan</p>
            <h1 className="mt-1 text-2xl font-bold">Speak your tweet</h1>
            <p className="mt-1 text-sm text-slate-600">Record, clean up the text, then open X in a background tab.</p>
          </div>
          <div className="rounded-full bg-mist px-3 py-1 text-xs font-medium text-slate-600">
            {isListening ? "Listening" : "Ready"}
          </div>
        </div>

        <label className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Auto Mode</p>
            <p className="text-xs text-slate-500">Clicking the extension icon opens a compact recorder and posts on stop.</p>
          </div>
          <Toggle ariaLabel="Toggle auto mode" checked={autoModeEnabled} onChange={handleAutoModeChange} />
        </label>

        <button
          className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
            isListening ? "bg-accent hover:bg-orange-500" : "bg-brand hover:bg-teal-700"
          } ${!isSupported ? "cursor-not-allowed opacity-50" : ""}`}
          disabled={!isSupported}
          onClick={handleToggleListening}>
          {isListening ? "Stop Listening" : "Start Listening"}
        </button>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700" htmlFor="tweet-text">
              Transcript
            </label>
            <span className={`text-xs font-semibold ${tooLong ? "text-red-600" : "text-slate-500"}`}>
              {characterCount}/{MAX_TWEET_LENGTH}
            </span>
          </div>

          <textarea
            id="tweet-text"
            className="min-h-36 w-full resize-none border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            onChange={(event) => handleTranscriptChange(event.target.value)}
            placeholder="Your speech will appear here..."
            value={livePreview}
          />
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

        {tooLong ? (
          <p className="mt-3 text-sm text-amber-700">This draft is over the tweet limit. Trim it before posting.</p>
        ) : null}

        <div className="mt-4 flex gap-3">
          <button
            className={`rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 ${
              autoModeEnabled ? "w-full" : "flex-1"
            }`}
            onClick={() => void handleClear()}>
            Clear
          </button>
          {autoModeEnabled ? null : (
            <button
              className="flex-1 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              disabled={tooLong}
              onClick={() => void handlePostToX()}>
              Post to X
            </button>
          )}
        </div>
      </section>
    </main>
  )
}

export default Popup
