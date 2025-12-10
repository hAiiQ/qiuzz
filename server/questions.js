export const TIMER_SECONDS = 30;
export const MAX_PLAYERS = 4;

const round1Values = [100, 200, 300, 400, 500];
const round2Values = [200, 400, 600, 800, 1000];

const roundDefinitions = [
  {
    id: "round1",
    title: "Runde 1",
    values: round1Values,
    categories: [
      {
        id: "marvel",
        title: "Rund um Marvel",
        questions: [
          { value: 100, prompt: "Wie heißt Spider-Man mit richtigem Namen?", answer: "Peter Parker" },
          { value: 200, prompt: "Wie heißt der Hammer von Thor?", answer: "Mjölnir" },
          { value: 300, prompt: "Wie heißt Captain Americas Schildmaterial?", answer: "Vibranium" },
          { value: 400, prompt: "Welches Doppelleben führt Luna Snow?", answer: "Sie ist K-Pop-Sängerin" },
          { value: 500, prompt: "Was für ein Gott ist Loki?", answer: "Gott des Schabernacks" }
        ]
      },
      {
        id: "teamups",
        title: "Team-Ups",
        questions: [
          { value: 100, prompt: "Wer von den 3 ist am wichtigsten für das Team-Up? Loki, Mantis oder Groot", answer: "Mantis" },
          { value: 200, prompt: "Mit wem hat Cloak & Dagger ein Team-Up?", answer: "Moon Knight & Blade" },
          { value: 300, prompt: "Welches Team-Up wurde in Season 3 permanent gebannt?", answer: "Human Torch & Storm" },
          { value: 400, prompt: "Welches Team-Up war in Season 1 das beste, um Gegner zu flanken und zu 1-Shotten?", answer: "Venom, Spider-Man" },
          { value: 500, prompt: "4 Charaktere bilden ein gemeinsames Team-Up. Welche 4 sind es?", answer: "Human Torch, Mister Fantastic, Invisible Woman, The Thing" }
        ]
      },
      {
        id: "mechanics",
        title: "Game Mechanics",
        questions: [
          { value: 100, prompt: "Wie viele Spieler hat ein Team?", answer: "6 Spieler" },
          { value: 200, prompt: "Ab wie vielen Spielern wird der Payload am schnellsten bewegt?", answer: "Ab 3 Spielern" },
          { value: 300, prompt: "Kann man in den Gegnerischen Spawn/Safezone rein?", answer: "Ja, durch eine Gegnerische Ult von Jeff" },
          { value: 400, prompt: "Wie hoch ist der Timer bei der Charakterauswahl?", answer: "30 Sekunden" },
          { value: 500, prompt: "Wie lange dauert es zum respawnen nach einem Tod?", answer: "10 Sekunden" }
        ]
      },
      {
        id: "voicelines",
        title: "Voice-Lines",
        questions: [
          { value: 100, prompt: "Luna Snow: “I am ready to ...!”", answer: "Luna Snow: “I am ready to put on a show”" },
          { value: 200, prompt: "Thor: “Behold, the God of ...!”", answer: "Thor: “Behold, the God of Thunder!”" },
          { value: 300, prompt: "Moon Knight: “The ... haunts ...!”", answer: "Moon Knight: “The moon haunts you!”" },
          { value: 400, prompt: "Squirrel Girl: “My friends ...!”", answer: "Squirrel Girl: “My friends are here!”" },
          { value: 500, prompt: "Magik: “Behold: ...!”", answer: "Magik: “Behold: Darkchild!”" }
        ]
      },
      {
        id: "locations",
        title: "Wo ist das?",
        questions: [
          {
            value: 100,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Halle von Djalia",
            image: "/assets/images/Runde1_100.png"
          },
          {
            value: 200,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Spinneninsel Tokyo 2099",
            image: "/assets/images/Runde1_200.png"
          },
          {
            value: 300,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Yggsgard",
            image: "/assets/images/Runde1_300.png"
          },
          {
            value: 400,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Midtown",
            image: "/assets/images/Runde1_400.png"
          },
          {
            value: 500,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Central Park",
            image: "/assets/images/Runde1_500.png"
          }
        ]
      }
    ]
  },
  {
    id: "round2",
    title: "Runde 2",
    values: round2Values,
    categories: [
      {
        id: "marvel",
        title: "Rund um Marvel",
        questions: [
          { value: 200, prompt: "Wie heißt Iron Man mit richtigem Namen?", answer: "Tony Stark" },
          { value: 400, prompt: "Wer verwandelt sich wenn er sauer wird?", answer: "Bruce Benner" },
          { value: 600, prompt: "Wie heißt Tony Starks AI System?", answer: "Jarvis" },
          { value: 800, prompt: "Wie heißt die jüngere Tochter von Thanos?", answer: "Nebula" },
          { value: 1000, prompt: "Wie heißt das Raumschiff von den Guardians of the Galaxy?", answer: "Die Milano" }
        ]
      },
      {
        id: "teamups",
        title: "Team-Ups",
        questions: [
          { value: 200, prompt: "Mit wem hat Thor in Season 4 ein neues Team-Up bekommen?", answer: "Angela" },
          { value: 400, prompt: "Was bringt das neue Team-Up für Black Panther mit Hulk & Namor?", answer: "Er bekommt einen Gamma-Schild von Hulk, wenn er wenig Leben hat" },
          { value: 600, prompt: "Was bringt das neue Team-Up für Star-Lord mit Rocket Raccoon & Peni Parker?", answer: "Er bekommt einen Teleport" },
          { value: 800, prompt: "Bei welchem Team-Up war es nicht schlimm, wenn man 1x gestorben ist?", answer: "Adam Warlock, Mantis & Star-Lord" },
          { value: 1000, prompt: "Welches alte Team-Up war von anfang an OP, wurde aber direkt danach generft?", answer: "Hulk, Strange & Iron-Man" }
        ]
      },
      {
        id: "mechanics",
        title: "Game Mechanics",
        questions: [
          { value: 200, prompt: "Was ist ein ausgeglichendes Team?", answer: "2 Tank - 2 DPS - 2 Supports" },
          { value: 400, prompt: "Auf wie viel % wird die Ultimate zurückgesetzt, wenn man 100% hat und den Charakter wechselt?", answer: "50%" },
          { value: 600, prompt: "Nenne mir 5 Dive Charaktere", answer: "Black Panther, Hulk, Captain America, Iron Fist, Jeff, Magik, Mantis, Psylock, Rocket Raccon, Spiderman, Star-Lord, The Thing, Thor, Ultron, Venom, Wolverine" },
          { value: 800, prompt: "Womit kann man einen Punkt mit dem gesamten Team in letzter Sekunde gewinnen?", answer: "Mit einem Doctor Strange Portal" },
          { value: 1000, prompt: "Wie hoch ist der Cooldown von Doctor Strange's Portal?", answer: "180 Sekunden" }
        ]
      },
      {
        id: "voicelines",
        title: "Voice-Lines",
        questions: [
          { value: 200, prompt: "Loki: “Your ... are mine!”", answer: "Loki: “Your powers are mine!”" },
          { value: 400, prompt: "Black Widow: “Plasma ...!”", answer: "Black Widow: “Plasma Burst!”" },
          { value: 600, prompt: "Phoenix: “You are ...!”", answer: "Phoenix: “You are nothing!”" },
          { value: 800, prompt: "Mantis: “We are ...!”", answer: "Mantis: “We are undefeatable!”" },
          { value: 1000, prompt: "Blade: “A thousand ...!”", answer: "Blade: “A thousand cuts!”" }
        ]
      },
      {
        id: "locations",
        title: "Wo ist das?",
        questions: [
          {
            value: 200,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Arakko",
            image: "/assets/images/Runde2_200.png"
          },
          {
            value: 400,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Gala Krakoa",
            image: "/assets/images/Runde2_400.png"
          },
          {
            value: 600,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Hydrabase",
            image: "/assets/images/Runde2_600.png"
          },
          {
            value: 800,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Birnin T'Challa",
            image: "/assets/images/Runde2_800.png"
          },
          {
            value: 1000,
            prompt: "Welcher Ort ist auf dem Bild zu sehen?",
            answer: "Klyntar",
            image: "/assets/images/Runde2_1000.png"
          }
        ]
      }
    ]
  }
];

function decorateRound(round) {
  return {
    id: round.id,
    title: round.title,
    values: round.values,
    categories: round.categories.map((category) => ({
      id: category.id,
      title: category.title,
      questions: category.questions.map((question) => ({
        id: `${category.id}-${round.id}-${question.value}`,
        value: question.value,
        prompt: question.prompt,
        answer: question.answer,
        image: question.image || null
      }))
    }))
  };
}

export const rounds = roundDefinitions.map(decorateRound);
