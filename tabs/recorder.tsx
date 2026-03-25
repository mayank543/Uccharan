import { useEffect, useRef, useState } from "react";

import "~/style.css";

import { Toggle } from "~/components/toggle";
import {
  clearDraft,
  loadAutoModeEnabled,
  saveAutoModeEnabled,
  saveDraft,
  savePendingPost,
} from "~/lib/storage";
import {
  createSpeechController,
  isSpeechRecognitionSupported,
} from "~/lib/speech";
import { buildTwitterIntentUrl } from "~/lib/twitter";

const RecorderPage = () => {
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [autoModeEnabled, setAutoModeEnabled] = useState(true);
  const speechControllerRef =
    useRef<ReturnType<typeof createSpeechController>>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const livePreview =
    `${transcript}${interimText ? ` ${interimText}` : ""}`.trim();

  const postToX = async (rawText: string) => {
    const text = rawText.trim();

    if (!text) {
      setError("No transcript captured yet.");
      return;
    }

    setIsPosting(true);

    await savePendingPost({
      text,
      createdAt: Date.now(),
    });

    setTranscript("");
    transcriptRef.current = "";
    setInterimText("");
    speechControllerRef.current?.reset();
    await clearDraft();

    const url = `${buildTwitterIntentUrl(text)}#uccharan-auto-post`;

    chrome.runtime.sendMessage(
      { type: "OPEN_TWITTER_INTENT", url },
      (response) => {
        setIsPosting(false);

        if (chrome.runtime.lastError) {
          setError(
            chrome.runtime.lastError.message ?? "Failed to open Twitter.",
          );
          return;
        }

        if (!response?.ok) {
          setError(response?.error ?? "Failed to open Twitter.");
          return;
        }
        window.close();
      },
    );
  };

  const startListening = () => {
    if (!speechControllerRef.current) {
      setError("Speech recognition is unavailable right now.");
      return;
    }

    setError("");
    transcriptRef.current = "";
    setTranscript("");
    setInterimText("");
    speechControllerRef.current?.reset();
    void clearDraft();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is unavailable in this browser context.");
      return;
    }

    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        speechControllerRef.current?.start();
      })
      .catch(() => {
        setError(
          "Microphone access was denied. Allow mic access for this extension in Chrome settings.",
        );
      });
  };

  useEffect(() => {
    void loadAutoModeEnabled().then((enabled) => {
      setAutoModeEnabled(enabled);
    });

    document.documentElement.style.background = "#eef4f8";
    document.body.style.background = "#eef4f8";
    document.body.style.minWidth = "620px";
    document.body.style.margin = "0";

    const supported = isSpeechRecognitionSupported();
    setIsSupported(supported);

    if (!supported) {
      setError(
        "Web Speech API is unavailable in this browser. Use Chrome for the best result.",
      );
      return;
    }

    speechControllerRef.current = createSpeechController({
      onStart: () => {
        setError("");
        setIsListening(true);
      },
      onResult: ({ finalText, interimText: interim }) => {
        setTranscript(finalText);
        setInterimText(interim);
      },
      onEnd: () => {
        setIsListening(false);
        setInterimText("");
        void postToX(`${transcriptRef.current}`.trim());
      },
      onError: (message) => {
        setError(message);
        setIsListening(false);
      },
      getSeedText: () => "",
    });

    startListening();

    return () => {
      speechControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    void saveDraft(transcript);
  }, [transcript]);

  const handleStop = () => {
    speechControllerRef.current?.stop();
  };

  const handleAutoModeChange = (enabled: boolean) => {
    setAutoModeEnabled(enabled);
    void saveAutoModeEnabled(enabled);

    chrome.runtime.sendMessage({ type: "SET_AUTO_MODE", enabled }, () => {
      if (chrome.runtime.lastError) {
        setError(
          chrome.runtime.lastError.message ?? "Failed to update auto mode.",
        );
        return;
      }

      if (!enabled) {
        window.close();
      }
    });
  };

  return (
    <main className="w-[620px] bg-[#eef4f8] p-3 text-ink">
      <section className="rounded-[24px] border border-white/70 bg-white/95 p-3 shadow-2xl backdrop-blur">
        <div className="min-h-[250px] px-3 py-3 text-[16px] leading-8 text-slate-800">
          {livePreview || "Start speaking..."}
        </div>

        <div className="mt-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-3 text-slate-600">
            <span className="text-[12px] font-semibold tracking-[0.2em] text-brand">
              UCCHARAN
            </span>
            <span className="text-sm text-slate-500">
              {isListening
                ? "Listening..."
                : isPosting
                  ? "Posting..."
                  : "Ready"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              aria-label="Stop listening and post"
              className="flex h-9 items-center justify-center gap-1 rounded-full bg-accent px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isSupported || !isListening || isPosting}
              onClick={handleStop}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 5v10"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                />
                <path
                  d="M8 11l4 4 4-4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                />
              </svg>
              <span>Stop</span>
            </button>

            <Toggle
              ariaLabel="Toggle auto mode"
              checked={autoModeEnabled}
              onChange={handleAutoModeChange}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-3 px-1 text-sm font-medium text-red-600">{error}</p>
        ) : null}
      </section>
    </main>
  );
};

export default RecorderPage;
