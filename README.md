# OSINT Challenges

SentinalsPrime GEOINT board. Open a capture, walk the equirectangular sphere in [Pannellum](https://github.com/mpetroff/pannellum), then pin the location on the CTF map. This site does not score or store answers.

## Board

Challenges live in `src/lib/challenges.ts`. Drop a 2:1 equirectangular JPEG in `public/panoramas/` and add a row:

```ts
{
  slug: "basalt-reach",
  name: "Basalt Reach",
  category: "GEOINT",
  points: 100,
  width: 4096,
  height: 2048,
  image: "/panoramas/basalt-reach.jpg",
  thumb: "/panoramas/basalt-reach-thumb.jpg",
  brief: "What the player should look for.",
}
```

## Deploy

Import this repo on Vercel. Framework preset is detected from `vercel.json` (Nitro / Vercel). No database and no sign-in.
