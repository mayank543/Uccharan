export type SpeechStatus = "idle" | "listening" | "unsupported" | "error"

export type SpeechCallbacks = {
  onStart: () => void
  onResult: (payload: { finalText: string; interimText: string }) => void
  onEnd: () => void
  onError: (message: string) => void
  getSeedText?: () => string
}

type RecognitionConstructor = new () => SpeechRecognition

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start: () => void
    stop: () => void
    abort: () => void
    onstart: (() => void) | null
    onend: (() => void) | null
    onerror: ((event: Event & { readonly error: string }) => void) | null
    onresult: ((event: SpeechRecognitionEvent) => void) | null
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean
    readonly length: number
    item: (index: number) => SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
  }

  interface SpeechRecognitionResultList {
    readonly length: number
    item: (index: number) => SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results: SpeechRecognitionResultList
  }
}

export const isSpeechRecognitionSupported = () => {
  if (typeof window === "undefined") {
    return false
  }

  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export const createSpeechController = (callbacks: SpeechCallbacks, language = "en-US") => {
  const Recognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined

  if (!Recognition) {
    callbacks.onError("Speech recognition is not supported in this browser.")
    return null
  }

  const recognition = new Recognition()
  let finalText = ""

  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = language

  recognition.onstart = () => {
    finalText = callbacks.getSeedText?.().trim() ?? ""
    callbacks.onStart()
  }

  recognition.onresult = (event) => {
    let interimText = ""

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const transcript = result[0]?.transcript ?? ""

      if (result.isFinal) {
        finalText = `${finalText} ${transcript}`.trim()
      } else {
        interimText += transcript
      }
    }

    callbacks.onResult({
      finalText: finalText.trim(),
      interimText: interimText.trim()
    })
  }

  recognition.onerror = (event) => {
    const friendlyMessage =
      event.error === "not-allowed"
        ? "Microphone access was denied. Please enable mic permission in Chrome."
        : `Speech recognition error: ${event.error}`

    callbacks.onError(friendlyMessage)
  }

  recognition.onend = () => {
    callbacks.onEnd()
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    reset: (seedText = "") => {
      finalText = seedText.trim()
    }
  }
}
