# Stock Return Lab

Offline-capable stock return screener and scenario analyzer.

## Local run

```bash
npm start
```

Open `http://127.0.0.1:3187`.

## Render deployment

This repo includes `render.yaml`, so Render can create the web service automatically.

Optional environment variable:

- `FMP_API_KEY` — enables the broader Financial Modeling Prep universe. Without it, the app falls back to bundled/provider-free sources.
