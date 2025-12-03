export const TIMER_SECONDS = 30;
export const MAX_PLAYERS = 4;

const round1Values = [100, 200, 300, 400, 500];
const round2Values = [200, 400, 600, 800, 1000];

function buildQuestions(prefix, prompts, values) {
  return values.map((value, index) => ({
    id: `${prefix}-${value}`,
    value,
    prompt: prompts[index % prompts.length].prompt,
    answer: prompts[index % prompts.length].answer
  }));
}

const samplePrompts = {
  songs: [
    { prompt: "Welcher Künstler singt 'Shape of You'?", answer: "Ed Sheeran" },
    { prompt: "Wie heißt das Debütalbum von Billie Eilish?", answer: "When We All Fall Asleep" }
  ],
  question: [
    { prompt: "Welche Stadt wird Stadt der Liebe genannt?", answer: "Paris" },
    { prompt: "Wie viele Kontinente gibt es?", answer: "Sieben" }
  ],
  general: [
    { prompt: "Welches Tier ist das größte Landraubtier?", answer: "Eisbär" },
    { prompt: "Aus welchem Material besteht Glas hauptsächlich?", answer: "Sand" }
  ],
  numbers: [
    { prompt: "Wie viele Minuten hat ein Tag?", answer: "1440" },
    { prompt: "Wie viele Spieler stehen im Fußball pro Team auf dem Platz?", answer: "Elf" }
  ],
  flags: [
    { prompt: "Welche Flagge zeigt einen roten Kreis auf weißem Grund?", answer: "Japan" },
    { prompt: "Welche Farben hat die Flagge Italiens?", answer: "Grün Weiß Rot" }
  ]
};

function createCategory(id, title, promptKey, values) {
  return {
    id,
    title,
    questions: buildQuestions(`${id}-${values[0] === 100 ? "r1" : "r2"}`, samplePrompts[promptKey], values)
  };
}

export const rounds = [
  {
    id: "round1",
    title: "Runde 1",
    values: round1Values,
    categories: [
      createCategory("songs", "Songs & Lyrics", "songs", round1Values),
      createCategory("question", "Was ist die Frage", "question", round1Values),
      createCategory("general", "Allgemein", "general", round1Values),
      createCategory("numbers", "Zahlen", "numbers", round1Values),
      createCategory("flags", "Flaggen", "flags", round1Values)
    ]
  },
  {
    id: "round2",
    title: "Runde 2",
    values: round2Values,
    categories: [
      createCategory("songs", "Songs & Lyrics", "songs", round2Values),
      createCategory("question", "Was ist die Frage", "question", round2Values),
      createCategory("general", "Allgemein", "general", round2Values),
      createCategory("numbers", "Zahlen", "numbers", round2Values),
      createCategory("flags", "Flaggen", "flags", round2Values)
    ]
  }
];
