import "@heyputer/puter.js/dist/puter.cjs"

import { clearPuterSession, loadPuterSession, savePuterSession } from "~/lib/storage"

type PuterClient = typeof window.puter
type PuterUser = Awaited<ReturnType<PuterClient["auth"]["getUser"]>>

export type SpeechStatus = "idle" | "listening" | "unsupported" | "error"

export type SpeechCallbacks = {
  onStart: () => void
  onResult: (payload: { finalText: string; interimText: string }) => void
  onEnd: () => void
  onError: (message: string) => void
  getSeedText?: () => string
}

export type SpeechController = {
  start: () => Promise<void>
  stop: () => void
  abort: () => void
  reset: (seedText?: string) => void
}

const getMediaRecorderClass = () => {
  if (typeof window === "undefined") {
    return null
  }

  return window.MediaRecorder ?? null
}

const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop())
}

const toFriendlyError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone access was denied. Please enable mic permission in Chrome."
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Transcription failed. Please try again."
}

const getPuter = (): PuterClient => {
  const client = window.puter

  if (!client?.auth || !client?.ai) {
    throw new Error("Puter failed to initialize. Reload the extension and try again.")
  }

  return client
}

const getUsername = (user: PuterUser, fallback?: string) => {
  return typeof user?.username === "string" && user.username.trim() ? user.username : fallback
}

export const restorePuterSession = async () => {
  const puter = getPuter()
  const session = await loadPuterSession()

  if (!session) {
    return null
  }

  puter.setAuthToken(session.token)
  puter.setAppID(session.appId)

  try {
    const user = await puter.auth.getUser()
    const restoredSession = {
      token: session.token,
      appId: session.appId,
      username: getUsername(user, session.username)
    }

    await savePuterSession(restoredSession)
    return restoredSession
  } catch {
    puter.resetAuthToken()
    await clearPuterSession()
    return null
  }
}

export const connectPuter = async () => {
  const puter = getPuter()
  const result = await puter.auth.signIn()

  if (!result.success) {
    throw new Error(result.error ?? result.msg ?? "Sign in to Puter to transcribe audio.")
  }

  puter.setAuthToken(result.token)
  puter.setAppID(result.app_uid)

  const user = await puter.auth.getUser()
  const session = {
    token: result.token,
    appId: result.app_uid,
    username: getUsername(user, result.username)
  }

  await savePuterSession(session)
  return session
}

const ensureSignedIn = async () => {
  const puter = getPuter()

  if (puter.auth.isSignedIn()) {
    return
  }

  const restoredSession = await restorePuterSession()

  if (!restoredSession) {
    throw new Error("Connect Puter before recording.")
  }
}

const transcribeAudio = async (audio: Blob) => {
  const puter = getPuter()

  await ensureSignedIn()

  return await puter.ai.speech2txt(audio)
}

const getTranscriptText = (result: string | { text?: string } | null | undefined) => {
  if (typeof result === "string") {
    return result
  }

  if (result && typeof result === "object" && "text" in result && typeof result.text === "string") {
    return result.text
  }

  throw new Error("Puter returned an unsupported transcription response.")
}

export const isSpeechRecognitionSupported = () => {
  if (typeof window === "undefined") {
    return false
  }

  return Boolean(navigator.mediaDevices && getMediaRecorderClass())
}

export const createSpeechController = (callbacks: SpeechCallbacks): SpeechController | null => {
  const MediaRecorderClass = getMediaRecorderClass()

  if (!MediaRecorderClass) {
    callbacks.onError("Audio recording is not supported in this browser.")
    return null
  }

  let finalText = ""
  let mediaRecorder: MediaRecorder | null = null
  let mediaStream: MediaStream | null = null
  let audioChunks: Blob[] = []
  let shouldDiscardRecording = false

  const cleanup = () => {
    if (mediaRecorder) {
      mediaRecorder.ondataavailable = null
      mediaRecorder.onerror = null
      mediaRecorder.onstop = null
    }

    mediaRecorder = null
    audioChunks = []
    stopStream(mediaStream)
    mediaStream = null
  }

  return {
    start: async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        callbacks.onError("Microphone access is unavailable in this browser context.")
        return
      }

      if (mediaRecorder?.state === "recording") {
        return
      }

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorder = new MediaRecorderClass(mediaStream)
        audioChunks = []
        shouldDiscardRecording = false
        finalText = callbacks.getSeedText?.().trim() ?? finalText

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data)
          }
        }

        mediaRecorder.onerror = () => {
          callbacks.onError("Recording failed. Please try again.")
        }

        mediaRecorder.onstop = async () => {
          const currentChunks = audioChunks
          const mimeType = mediaRecorder?.mimeType || currentChunks[0]?.type || "audio/webm"

          cleanup()

          if (shouldDiscardRecording) {
            callbacks.onEnd()
            return
          }

          if (!currentChunks.length) {
            callbacks.onError("No audio was captured. Please try again.")
            callbacks.onEnd()
            return
          }

          try {
            const recordedAudio = new Blob(currentChunks, { type: mimeType })
            const transcript = getTranscriptText(await transcribeAudio(recordedAudio)).trim()

            finalText = `${finalText} ${transcript}`.trim()
            callbacks.onResult({
              finalText,
              interimText: ""
            })
          } catch (error) {
            callbacks.onError(toFriendlyError(error))
          } finally {
            callbacks.onEnd()
          }
        }

        mediaRecorder.start()
        callbacks.onStart()
      } catch (error) {
        cleanup()
        callbacks.onError(toFriendlyError(error))
      }
    },
    stop: () => {
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        return
      }

      mediaRecorder.stop()
    },
    abort: () => {
      shouldDiscardRecording = true

      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        cleanup()
        return
      }

      mediaRecorder.stop()
    },
    reset: (seedText = "") => {
      finalText = seedText.trim()
    }
  }
}
