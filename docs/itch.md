# itch.io page

## Settings

- **Title:** Racerlearning
- **Tagline:** You never drive. You train the AI that does.
- **Kind of project:** HTML (upload `racerlearning-itch.zip`, tick "This file will be played in the browser")
- **Embed:** 1280×720, fullscreen button, mobile friendly
- **Pricing:** No payment required, donations off
- **Genre:** Racing
- **Tags:** ai, machine-learning, neural-network, racing, simulation, neon, browser, educational
- **Cover:** 630×500, screenshots from `docs/screenshots/`

## Build the zip

```sh
npm run build
cd dist && zip -r ../racerlearning-itch.zip . && cd ..
```

## Description

A neon Tokyo street racer where you don't touch the wheel. Instead you decide what your AI racer gets rewarded for (progress, speed, drifting, crashing, jerky steering) and watch 40 cars evolve in real time through neuroevolution.

When your racer is ready, put it up against the base model KAMI-01 on freshly generated tracks it has never seen.

- Tune six reward sliders and watch the cars learn (or find hilarious loopholes)
- Generate tracks in four environments
- Race up to four AI racers
- Repaint your car with liveries and accent colours
- Share your trained racer with a link or code and challenge friends
- Export/import your trained models as JSON

Each car sees the road through 7 distance rays and is driven by a tiny neural network (11 → 16 → 2). No ML library, just TypeScript and Canvas.

Found a bug or have an idea? Leave a comment or open an issue on [GitHub](https://github.com/Zapeman02/Racerlearning/issues).
