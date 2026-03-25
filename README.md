# Uccharan

Voice-to-tweet Chrome extension MVP built with Plasmo, React, Tailwind, and Puter.js transcription.

## Features

- Start and stop voice recording from the popup
- View and edit the transcript
- Persist the draft with extension storage
- Open a background tab with a prefilled Twitter/X intent composer

## Motivation

I built this for personal use. The goal is to capture and post a thought the moment it comes to mind without opening X first, getting pulled into the feed, and getting distracted.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the extension in development mode:

   ```bash
   npm run dev
   ```

3. Open Chrome and go to `chrome://extensions`.

4. Turn on `Developer mode`.

5. Click `Load unpacked`.

6. Select the generated development build folder:

   ```text
   build/chrome-mv3-dev
   ```

7. Pin the extension if you want quick access from the toolbar.

8. Open the extension popup and click `Connect Puter` once.

9. Complete the Puter sign-in flow so transcription can be reused in later sessions.

10. Start recording from the popup and review the transcript before posting.

## Build for production

```bash
npm run build
```

The production build output is generated in:

```text
build/chrome-mv3-prod
```

## Notes

- This MVP records audio in the extension, then transcribes it with `puter.ai.speech2txt()` after recording stops.
- Puter is connected once from the popup, and the session is then restored from extension storage.
- It opens a prefilled compose flow on X instead of posting directly through the API.
- HAVE FUN....
