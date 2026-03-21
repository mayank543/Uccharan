# Uccharan

Voice-to-tweet Chrome extension MVP built with Plasmo, React, Tailwind, and the Web Speech API.

## Features

- Start and stop speech recognition from the popup
- View and edit the transcript
- Persist the draft with extension storage
- Open a background tab with a prefilled Twitter/X intent composer

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start development:

   ```bash
   npm run dev
   ```

3. Load the generated extension build in Chrome.

## Notes

- This MVP uses the browser Web Speech API, which works best in Chrome.
- It opens a prefilled compose flow on X instead of posting directly through the API.
