/* DhiRise · Founding Circle Challenge settings. Read by js/api.js and the challenge screens.
   endsAt is empty: the challenge has no end date for now (spec 0008). To set one, put an ISO date with an offset here, e.g. "2026-10-30T23:59:00+05:30", and set CHALLENGE_ENDS_AT to the same value on the Convex deployment. prize.image is a web copy of assets/challenge/prize.png; if it fails, prize.imageFallback (a gold gift-box SVG). */
window.DHI_CHALLENGE = {
  name: "DhiRise Founding Circle Challenge",
  endsAt: "",
  prize: {
    amount: "up to ₹5,000",                            /* the one place the JS screens read the amount; src/lib/prize.ts must match (tests/prize.test.js) */
    title: "Gift hamper worth up to ₹5,000",
    items: ["Shoes", "Headphones", "Apparel"],
    image: "assets/challenge/prize.webp",              /* 800 px web copy of prize.png */
    imageFallback: "assets/challenge/prize.svg"
  },
  minFeedbackChars: 30,
  leaderboardSize: 50,
  milestones: [1, 5, 10, 25],
  maxInviteShows: 2
};
