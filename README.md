# Codeify

Codeify is an AI-powered code reviewer with a React frontend and an Express backend.

## Judge-demo recommendation

For a low-latency public demo from a live link:

- deploy the frontend on GitHub Pages
- deploy the backend on Render
- use `Gemini` on the deployed backend
- use `gemini-2.5-flash-lite` as primary model
- use `gemini-2.5-flash` as backup model
- use a paid Render web service to avoid cold starts

This repository is now optimized for:

- fast review responses
- fast fix responses
- lower error rates through retries, model fallback, and response caching

## Fast backend setup

Recommended deployed backend environment:

```env
AI_PROVIDER=gemini
AI_FALLBACK_PROVIDER=
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-2.5-flash
REQUEST_TIMEOUT_MS=20000
REVIEW_MAX_OUTPUT_TOKENS=500
FIX_MAX_OUTPUT_TOKENS=1800
AI_CACHE_TTL_MS=300000
MAX_CODE_CHARS=12000
PORT=3001
```

Render service settings:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

Use a paid Render instance for the demo. Free instances can sleep and wake slowly.

## GitHub Pages frontend

Before deploying the frontend:

```powershell
cd Codeify
$env:VITE_API_BASE_URL="https://your-render-backend.onrender.com"
npm install
npm run deploy
```

The frontend keeps the GitHub Pages base path and sends API calls to the hosted backend.

## Local development

Frontend:

```powershell
cd Codeify
npm install
npm run dev
```

Backend:

```powershell
cd Codeify\server
npm install
npm start
```

For local Ollama use, set:

```env
AI_PROVIDER=ollama
AI_FALLBACK_PROVIDER=
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:0.5b
```

## Why this is faster now

- review prompts are shorter
- fix prompts are shorter
- response sizes are capped
- Gemini requests retry across models and keys
- identical requests are cached briefly
- GitHub multi-file review now runs with limited concurrency

## Health check

After deploying the backend, verify:

```text
https://your-render-backend.onrender.com/health
```

You want:

- `status: "ready"`
- Gemini configured with both fast and fallback models
