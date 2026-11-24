export type Challenge = {
  slug: string;
  name: string;
  category: string;
  points: number;
  width: number;
  height: number;
  image: string;
  thumb: string;
  brief: string;
};

export const challenges: Challenge[] = [
  {
    slug: "basalt-reach",
    name: "Basalt Reach",
    category: "GEOINT",
    points: 100,
    width: 4096,
    height: 2048,
    image: "/panoramas/basalt-reach.jpg",
    thumb: "/panoramas/basalt-reach-thumb.jpg",
    brief:
      "Volcanic shore. Dark rock, moss in the cracks, open water on the horizon. Walk the sphere, then pin the location on the CTF map.",
  },
];

export function getChallenge(slug: string) {
  return challenges.find((challenge) => challenge.slug === slug);
}

export function getCategories() {
  return [...new Set(challenges.map((challenge) => challenge.category))];
}
