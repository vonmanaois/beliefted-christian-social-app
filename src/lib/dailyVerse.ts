export type DailyVerse = {
  reference: string;
  text: string;
  prompt?: string;
};

const DAILY_VERSES: DailyVerse[] = [
  {
    reference: "Psalm 46:1",
    text: "God is our refuge and strength, an ever-present help in trouble.",
    prompt: "Where do you need His strength today?",
  },
  {
    reference: "Philippians 4:6-7",
    text:
      "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
    prompt: "What can you hand over in prayer right now?",
  },
  {
    reference: "Isaiah 41:10",
    text: "Do not fear, for I am with you; do not be dismayed, for I am your God.",
    prompt: "What fear do you want to surrender today?",
  },
  {
    reference: "Matthew 11:28",
    text: "Come to me, all you who are weary and burdened, and I will give you rest.",
    prompt: "Where do you need rest?",
  },
  {
    reference: "Romans 12:12",
    text: "Be joyful in hope, patient in affliction, faithful in prayer.",
    prompt: "What is one way you can be faithful in prayer today?",
  },
  {
    reference: "2 Corinthians 5:7",
    text: "For we live by faith, not by sight.",
    prompt: "Where is God asking you to trust Him?",
  },
  {
    reference: "Joshua 1:9",
    text: "Be strong and courageous. Do not be afraid; do not be discouraged.",
    prompt: "What step of courage is in front of you?",
  },
];

const START_DATE = new Date("2024-01-01T00:00:00.000Z");

export function getDailyVerse(date = new Date()): DailyVerse {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSinceStart = Math.floor((date.getTime() - START_DATE.getTime()) / msPerDay);
  const index = ((daysSinceStart % DAILY_VERSES.length) + DAILY_VERSES.length) % DAILY_VERSES.length;
  return DAILY_VERSES[index] ?? DAILY_VERSES[0];
}
