BountyNet web

This frontend is the current circuit-break replacement for the older `clients/web` app.

Stack:
- React 19
- Vite 7
- Carbon React
- Express SSR runtime

Useful commands:

```bash
npm install
npm run dev
npm run build
npm run preview
```

Environment:
- `BOUNTYNET_GATEWAY_URL` defaults to `https://gateway.stare.network`
- `ANTHROPIC_API_KEY` is optional for the insights helper

This app now lives at `clients/web` inside the main BountyNet repo. Any older references to external `new-web` or `../BountyNet` paths were removed during cutover.
