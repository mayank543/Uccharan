import "~/style.css";

import { useEffect, useRef, useState } from "react";

import { Toggle } from "~/components/toggle";
import {
  clearDraft,
  loadAutoModeEnabled,
  loadDraft,
  saveAutoModeEnabled,
  saveDraft,
  savePendingPost,
} from "~/lib/storage";
import {
  connectPuter,
  createSpeechController,
  isSpeechRecognitionSupported,
  restorePuterSession,
} from "~/lib/speech";
import {
  buildTwitterIntentUrl,
  getTweetLength,
  isTweetTooLong,
  MAX_TWEET_LENGTH,
} from "~/lib/twitter";

const Popup = () => {
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);
  const [isPuterConnected, setIsPuterConnected] = useState(false);
  const [puterUsername, setPuterUsername] = useState("");
  const speechControllerRef =
    useRef<ReturnType<typeof createSpeechController>>(null);
  const transcriptRef = useRef("");
  const livePreviewRef = useRef("");
  const autoPostOnStopRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const postToX = async (rawText: string) => {
    const text = rawText.trim();

    if (!text) {
      setError("Add some text before opening Twitter.");
      return;
    }

    if (isTweetTooLong(text)) {
      setError("This draft is over the tweet limit. Trim it before posting.");
      return;
    }

    await savePendingPost({
      text,
      createdAt: Date.now(),
    });

    setTranscript("");
    transcriptRef.current = "";
    setInterimText("");
    livePreviewRef.current = "";
    speechControllerRef.current?.reset();
    await clearDraft();

    const url = `${buildTwitterIntentUrl(text)}#uccharan-auto-post`;

    chrome.runtime.sendMessage(
      { type: "OPEN_TWITTER_INTENT", url },
      (response) => {
        if (chrome.runtime.lastError) {
          setError(
            chrome.runtime.lastError.message ?? "Failed to open Twitter.",
          );
          return;
        }

        if (!response?.ok) {
          setError(response?.error ?? "Failed to open Twitter.");
        }
      },
    );
  };

  const requestMicAndStart = () => {
    if (!speechControllerRef.current) {
      setError("Speech transcription is unavailable right now.");
      return;
    }

    setError("");
    void speechControllerRef.current.start();
  };

  useEffect(() => {
    const initialize = async () => {
      const supported = isSpeechRecognitionSupported();
      setIsSupported(supported);

      const [draft, autoMode, puterSession] = await Promise.all([
        loadDraft(),
        loadAutoModeEnabled(),
        restorePuterSession(),
      ]);
      setTranscript(draft);
      setAutoModeEnabled(autoMode);
      setIsPuterConnected(Boolean(puterSession));
      setPuterUsername(puterSession?.username ?? "");

      if (!supported) {
        setError("Audio recording is unavailable in this browser context.");
        return;
      }

      speechControllerRef.current = createSpeechController({
        onStart: () => {
          setError("");
          setIsListening(true);
          setIsTranscribing(false);
        },
        onResult: ({ finalText, interimText: interim }) => {
          transcriptRef.current = finalText;
          setTranscript(finalText);
          setInterimText(interim);
        },
        onEnd: () => {
          setIsListening(false);
          setIsTranscribing(false);
          setInterimText("");

          if (autoPostOnStopRef.current) {
            autoPostOnStopRef.current = false;
            void postToX(transcriptRef.current);
          }
        },
        onError: (message) => {
          setError(message);
          setIsListening(false);
          setIsTranscribing(false);
          autoPostOnStopRef.current = false;
        },
        getSeedText: () => transcriptRef.current,
      });
    };

    void initialize();

    return () => {
      speechControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    void saveDraft(transcript);
  }, [transcript]);

  const livePreview =
    `${transcript}${interimText ? ` ${interimText}` : ""}`.trim();
  const characterCount = getTweetLength(livePreview);
  const tooLong = isTweetTooLong(livePreview);

  useEffect(() => {
    livePreviewRef.current = livePreview;
  }, [livePreview]);

  const handleToggleListening = () => {
    if (isListening) {
      autoPostOnStopRef.current = autoModeEnabled;
      setIsTranscribing(true);
      speechControllerRef.current?.stop();
      return;
    }

    requestMicAndStart();
  };

  const handleTranscriptChange = (value: string) => {
    transcriptRef.current = value;
    setTranscript(value);
    setInterimText("");
    speechControllerRef.current?.reset(value);
  };

  const handleClear = async () => {
    transcriptRef.current = "";
    livePreviewRef.current = "";
    setTranscript("");
    setInterimText("");
    setError("");
    autoPostOnStopRef.current = false;
    speechControllerRef.current?.reset();
    await clearDraft();
  };

  const handleAutoModeChange = (enabled: boolean) => {
    setAutoModeEnabled(enabled);
    void saveAutoModeEnabled(enabled);
    chrome.runtime.sendMessage({ type: "SET_AUTO_MODE", enabled }, () => {
      if (chrome.runtime.lastError) {
        setError(
          chrome.runtime.lastError.message ?? "Failed to update auto mode.",
        );
      }
    });
  };

  const handlePostToX = async () => {
    await postToX(livePreview);
  };

  const handleConnectPuter = async () => {
    setIsConnecting(true);
    setError("");

    try {
      const session = await connectPuter();
      setIsPuterConnected(true);
      setPuterUsername(session.username ?? "");
    } catch (connectionError) {
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Failed to connect Puter.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <main className="bg-transparent p-3 text-ink">
      <section className="rounded-[24px] border border-white/70 bg-white/90 p-3 shadow-card backdrop-blur">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
              Uccharan
            </p>
            <h1 className="mt-1 text-xl font-bold leading-tight">Speak your tweet</h1>
            <p className="mt-1 text-xs text-slate-600">
              Record, clean up the text, then post to X.
            </p>
          </div>
          <div className="rounded-full bg-mist px-3 py-1 text-xs font-medium text-slate-600">
            {isListening
              ? "Listening"
              : isTranscribing
                ? "Transcribing"
                : "Ready"}
          </div>
        </div>

        <label className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-slate-800">Auto Mode</p>
            <p className="text-xs text-slate-500">
              Compact recorder posts after transcription.
            </p>
          </div>
          <Toggle
            ariaLabel="Toggle auto mode"
            checked={autoModeEnabled}
            onChange={handleAutoModeChange}
          />
        </label>

        <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-slate-800">Puter</p>
            <p className="text-xs text-slate-500">
              {isPuterConnected
                ? `Connected${puterUsername ? ` as ${puterUsername}` : ""}`
                : "Connect once so recording can transcribe without asking each time."}
            </p>
          </div>
          <button
            className={`rounded-full px-3 py-2 text-xs font-semibold text-white transition ${
              isPuterConnected
                ? "bg-slate-500 hover:bg-slate-600"
                : "bg-brand hover:bg-teal-700"
            }`}
            disabled={isConnecting}
            onClick={() => void handleConnectPuter()}
          >
            {isConnecting
              ? "Connecting..."
              : isPuterConnected
                ? "Reconnect"
                : "Connect Puter"}
          </button>
        </div>

        <button
          className={`w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition ${
            isListening
              ? "bg-accent hover:bg-orange-500"
              : "bg-brand hover:bg-teal-700"
          } ${!isSupported ? "cursor-not-allowed opacity-50" : ""}`}
          disabled={!isSupported || isTranscribing || !isPuterConnected}
          onClick={handleToggleListening}
        >
          {isListening
            ? "Stop Recording"
            : isTranscribing
              ? "Transcribing..."
              : "Start Recording"}
        </button>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="text-xs font-medium text-slate-700"
              htmlFor="tweet-text"
            >
              Transcript
            </label>
            <span
              className={`text-xs font-semibold ${tooLong ? "text-red-600" : "text-slate-500"}`}
            >
              {characterCount}/{MAX_TWEET_LENGTH}
            </span>
          </div>

          <textarea
            id="tweet-text"
            className="min-h-24 w-full resize-none border-0 bg-transparent text-xs leading-5 text-slate-800 outline-none placeholder:text-slate-400"
            onChange={(event) => handleTranscriptChange(event.target.value)}
            placeholder="Your transcript will appear after recording stops..."
            value={livePreview}
          />
        </div>

        {error ? (
          <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
        ) : null}

        {tooLong ? (
          <p className="mt-2 text-xs text-amber-700">
            This draft is over the tweet limit. Trim it before posting.
          </p>
        ) : null}

        <div className="mt-3 flex gap-2">
          <button
            className={`rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 ${
              autoModeEnabled ? "w-full" : "flex-1"
            }`}
            onClick={() => void handleClear()}
          >
            Clear
          </button>
          {autoModeEnabled ? null : (
            <button
              className="flex-1 rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              disabled={tooLong}
              onClick={() => void handlePostToX()}
            >
              Post to X
            </button>
          )}
        </div>
      </section>
    </main>
  );
};

export default Popup;
