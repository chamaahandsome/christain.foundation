// The initial doctrinal map content (concept §4), separated from the seed
// runner so tests can validate it against the map rules in lib/map.ts.

import { QuestionTier } from "@prisma/client";

export interface SeedPosition {
  slug: string;
  name: string;
  summary: string;
}

export interface SeedQuestion {
  slug: string;
  title: string;
  tier: QuestionTier;
  topic: string;
  framing: string;
  positions: SeedPosition[];
}

export const TOPICS = [
  { slug: "the-gospel", name: "The Gospel" },
  { slug: "scripture", name: "Scripture" },
  { slug: "the-church", name: "The Church" },
  { slug: "christian-life", name: "The Christian Life" },
  { slug: "last-things", name: "Last Things" },
  { slug: "origins", name: "Origins" },
];

export const QUESTIONS: SeedQuestion[] = [
  // ---------- the spine ----------
  {
    slug: "who-is-jesus",
    title: "Who is Jesus?",
    tier: QuestionTier.SPINE,
    topic: "the-gospel",
    framing:
      "Jesus of Nazareth is God the Son — true God and true man, one person. This is not one view among several; it is the confession on which the church stands or falls, affirmed at Nicaea and held by all faithful Christians everywhere. There is certainty here.",
    positions: [
      {
        slug: "the-historic-confession",
        name: "The historic confession",
        summary:
          "True God from true God, begotten not made, of one being with the Father; incarnate, crucified, bodily risen.",
      },
    ],
  },
  {
    slug: "what-is-the-gospel",
    title: "What is the gospel?",
    tier: QuestionTier.SPINE,
    topic: "the-gospel",
    framing:
      "The gospel is news, not advice: Christ died for our sins according to the Scriptures, was buried, and was raised on the third day. Salvation is by grace alone, through faith alone, in Christ alone. Nothing here is up for negotiation.",
    positions: [
      {
        slug: "the-apostolic-gospel",
        name: "The apostolic gospel",
        summary:
          "The announcement of 1 Corinthians 15:3–4, received by faith, not earned by works.",
      },
    ],
  },
  {
    slug: "did-jesus-rise",
    title: "Did Jesus really rise from the dead?",
    tier: QuestionTier.SPINE,
    topic: "the-gospel",
    framing:
      "The bodily resurrection is the hinge of the faith — if Christ is not raised, our faith is futile (1 Cor 15:17). The historical case is strong and the church's answer is unqualified: He is risen.",
    positions: [
      {
        slug: "bodily-risen",
        name: "Bodily risen",
        summary:
          "The tomb was empty, the witnesses were transformed, and the resurrection is a historical event, not a metaphor.",
      },
    ],
  },
  {
    slug: "can-i-trust-the-bible",
    title: "Can I trust the Bible?",
    tier: QuestionTier.SPINE,
    topic: "scripture",
    framing:
      "Scripture is God's word, authoritative in all it teaches — the final authority in matters of faith and practice. The manuscripts are the best-attested texts of antiquity, and the church receives them with confidence.",
    positions: [
      {
        slug: "gods-word-written",
        name: "God's word written",
        summary:
          "Inspired, trustworthy, and sufficient — the rule by which all teaching, including everything on this platform, is measured.",
      },
    ],
  },
  // ---------- the map (disputed) ----------
  {
    slug: "baptism",
    title: "Who should be baptized — and when?",
    tier: QuestionTier.DISPUTED,
    topic: "the-church",
    framing:
      "Faithful Christians have disagreed for centuries about whether baptism belongs to believers upon profession of faith or also to the children of believers. What is at stake is the meaning of the sign — not the gospel itself. No one is saved or lost over this question.",
    positions: [
      {
        slug: "credobaptism",
        name: "Believer's baptism",
        summary:
          "Baptism follows personal profession of faith; the sign belongs to disciples.",
      },
      {
        slug: "paedobaptism",
        name: "Infant baptism",
        summary:
          "The children of believers receive the covenant sign, as circumcision was given to Israel's children.",
      },
    ],
  },
  {
    slug: "end-times",
    title: "How do the last things unfold?",
    tier: QuestionTier.DISPUTED,
    topic: "last-things",
    framing:
      "All Christians confess that Christ will return bodily to judge the living and the dead. The dispute is over the order and nature of the events surrounding His return — the millennium of Revelation 20 in particular. Hold your chart loosely; hold the blessed hope firmly.",
    positions: [
      {
        slug: "premillennialism",
        name: "Premillennialism",
        summary:
          "Christ returns before a future thousand-year reign on earth.",
      },
      {
        slug: "amillennialism",
        name: "Amillennialism",
        summary:
          "The millennium is Christ's present reign; He returns at its consummation.",
      },
      {
        slug: "postmillennialism",
        name: "Postmillennialism",
        summary:
          "The gospel advances until Christ returns to a substantially discipled world.",
      },
    ],
  },
  {
    slug: "spiritual-gifts",
    title: "Do the miraculous gifts continue today?",
    tier: QuestionTier.DISPUTED,
    topic: "christian-life",
    framing:
      "Has God withdrawn the sign gifts — tongues, prophecy, healing — or do they continue in the church today? Serious, Scripture-loving believers land on both sides. What is at stake is expectation and practice, not salvation.",
    positions: [
      {
        slug: "cessationism",
        name: "Cessationism",
        summary:
          "The sign gifts attended the apostolic foundation and have ceased.",
      },
      {
        slug: "continuationism",
        name: "Continuationism",
        summary:
          "The gifts continue and are to be exercised in order and tested by Scripture.",
      },
    ],
  },
  {
    slug: "church-government",
    title: "How should the church be governed?",
    tier: QuestionTier.DISPUTED,
    topic: "the-church",
    framing:
      "Bishops, elders, or the congregation? Each polity claims biblical warrant, and each has served Christ's church for centuries. What is at stake is order and accountability — not whether a church is true.",
    positions: [
      {
        slug: "episcopal",
        name: "Episcopal",
        summary: "Oversight by bishops in historic succession of office.",
      },
      {
        slug: "presbyterian",
        name: "Presbyterian",
        summary: "Governance by councils of elders across congregations.",
      },
      {
        slug: "congregational",
        name: "Congregational",
        summary: "Authority resting with the local gathered congregation.",
      },
    ],
  },
  {
    slug: "women-in-ministry",
    title: "What roles do women hold in the church's ministry?",
    tier: QuestionTier.DISPUTED,
    topic: "the-church",
    framing:
      "Believers who hold Scripture as final authority read its teaching on office and ministry differently. The debate is real and ongoing; both sides here affirm the full dignity of women as image-bearers and co-heirs.",
    positions: [
      {
        slug: "complementarian",
        name: "Complementarian",
        summary:
          "Men and women are equal in worth with distinct callings; the teaching office is reserved to qualified men.",
      },
      {
        slug: "egalitarian",
        name: "Egalitarian",
        summary:
          "All offices are open to those gifted and called, without distinction of sex.",
      },
    ],
  },
  {
    slug: "sovereignty-and-freedom",
    title: "How do God's sovereignty and human freedom meet in salvation?",
    tier: QuestionTier.DISPUTED,
    topic: "the-gospel",
    framing:
      "Calvinist and Arminian believers alike confess salvation by grace alone through faith alone. The dispute is over how divine election and human response relate — a centuries-old family argument among people who preach the same gospel.",
    positions: [
      {
        slug: "reformed",
        name: "Reformed (Calvinist)",
        summary:
          "God unconditionally elects and effectually calls; grace cannot finally be resisted by those given to the Son.",
      },
      {
        slug: "arminian",
        name: "Arminian",
        summary:
          "God's saving grace enables a genuinely free response; election is according to foreknowledge.",
      },
    ],
  },
  {
    slug: "origins",
    title: "How did God create — and how long did it take?",
    tier: QuestionTier.DISPUTED,
    topic: "origins",
    framing:
      "That God created all things from nothing is spine, not map. How and over what timescale He did so is explicitly non-essential: no one is saved or lost over the age of the earth. CF hosts serious voices on every side and funds rigorous research without endorsing conclusions — the gate is methodology, not agreement.",
    positions: [
      {
        slug: "young-earth",
        name: "Young-earth creation",
        summary:
          "Creation in six ordinary days, thousands of years ago; the flood shapes the geological record.",
      },
      {
        slug: "old-earth",
        name: "Old-earth creation",
        summary:
          "An ancient universe with God's special creative acts in history; the days are ages or a framework.",
      },
      {
        slug: "intelligent-design",
        name: "Intelligent design",
        summary:
          "Empirical signatures of design in nature, argued without committing to a timescale.",
      },
      {
        slug: "evolutionary-creation",
        name: "Evolutionary creation",
        summary:
          "God's providential use of evolutionary processes as the means of His creating.",
      },
    ],
  },
];

export const START_HERE_STEPS = [
  {
    title: "Who is Jesus?",
    description: "Start with the person at the center of everything.",
  },
  {
    title: "What is the gospel?",
    description: "The news itself — what God has done, and what it means for you.",
  },
  {
    title: "The resurrection",
    description: "Why the empty tomb changes everything, and how we know.",
  },
  {
    title: "Can I trust the Bible?",
    description: "Where Scripture came from and why it holds final authority.",
  },
  {
    title: "What now? Prayer, church, and walking with God",
    description: "First steps: talking to God, finding a church, growing.",
  },
];

