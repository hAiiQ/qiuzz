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
        id: "songs",
        title: "Songs & Lyrics",
        questions: [
          { value: 100, prompt: "Welche Band schrieb den Song 'Tage wie diese'?", answer: "Die Toten Hosen" },
          { value: 200, prompt: "Welche Saengerin landete 2013 mit 'Atemlos durch die Nacht' einen Nummer-1-Hit?", answer: "Helene Fischer" },
          { value: 300, prompt: "Welcher DJ wurde mit dem Track 'Animals' beruehmt?", answer: "Martin Garrix" },
          { value: 400, prompt: "Welcher Rapper veroefentlichte 2009 das Album 'Stadtaffe'?", answer: "Peter Fox" },
          { value: 500, prompt: "Wie heißt das Album, auf dem Die Fantastischen Vier 1992 'Die da!?!' herausbrachten?", answer: "4 gewinnt" }
        ]
      },
      {
        id: "question",
        title: "Was ist die Frage",
        questions: [
          { value: 100, prompt: "Wie heißt die Hauptstadt von Bayern?", answer: "Muenchen" },
          { value: 200, prompt: "Welches chemische Element traegt das Symbol O?", answer: "Sauerstoff" },
          { value: 300, prompt: "Wie viele Bundeslaender hat Deutschland?", answer: "Sechzehn" },
          { value: 400, prompt: "Wie lautet der Name der laengsten deutschen Autobahn?", answer: "A7" },
          { value: 500, prompt: "Wie beginnt Artikel 1 des Grundgesetzes?", answer: "Die Wuerde des Menschen ist unantastbar" }
        ]
      },
      {
        id: "general",
        title: "Allgemein",
        questions: [
          { value: 100, prompt: "Welches Gewuerz faerbt Currymischungen gelb?", answer: "Kurkuma" },
          { value: 200, prompt: "Welcher deutsche Fluss fliesst durch Dresden und Hamburg?", answer: "Elbe" },
          { value: 300, prompt: "Welcher italienische Kuenstler malte 'Das Abendmahl'?", answer: "Leonardo da Vinci" },
          { value: 400, prompt: "Welcher Physiker formulierte die Relativitaetstheorie?", answer: "Albert Einstein" },
          { value: 500, prompt: "Welcher Philosoph schrieb 'Kritik der reinen Vernunft'?", answer: "Immanuel Kant" }
        ]
      },
      {
        id: "numbers",
        title: "Zahlen",
        questions: [
          { value: 100, prompt: "Wie viele Ecken hat ein gleichseitiges Dreieck?", answer: "Drei" },
          { value: 200, prompt: "Wieviel ist 11 + 22 + 33?", answer: "66" },
          { value: 300, prompt: "Wie viele Grad besitzt ein Vollkreis?", answer: "360" },
          { value: 400, prompt: "Wie viele Tage hat ein Schaltjahr?", answer: "366" },
          { value: 500, prompt: "Welche Primzahl liegt direkt vor 100?", answer: "97" }
        ]
      },
      {
        id: "flags",
        title: "Flaggen",
        questions: [
          { value: 100, prompt: "Welche Farben hat die Flagge Deutschlands von oben nach unten?", answer: "Schwarz Rot Gold" },
          { value: 200, prompt: "Welches Land fuehrt ein rotes Ahornblatt auf weissem Grund?", answer: "Kanada" },
          { value: 300, prompt: "Welche Flagge zeigt ein blaues Kreuz auf weissem Grund?", answer: "Finnland" },
          { value: 400, prompt: "Welches Land hat ein weisses Kreuz auf rotem Grund als Flagge?", answer: "Schweiz" },
          { value: 500, prompt: "Welche Flagge zeigt einen goldenen Stern auf rotem Grund mit gruener und gelber Umrandung?", answer: "Kamerun" }
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
        id: "songs",
        title: "Songs & Lyrics",
        questions: [
          { value: 200, prompt: "Welche Saengerin gewann 2011 Grammys mit 'Rolling in the Deep'?", answer: "Adele" },
          { value: 400, prompt: "Welche Berliner Band veroefentlichte 2000 den Song 'Wie es geht'?", answer: "Die Aerzte" },
          { value: 600, prompt: "Wer komponierte die Oper 'Der Freischuetz'?", answer: "Carl Maria von Weber" },
          { value: 800, prompt: "Welches Elektro-Duo veroefentlichte 1978 'Die Mensch-Maschine'?", answer: "Kraftwerk" },
          { value: 1000, prompt: "Welcher Gitarrist nahm 1984 das Minimal-Album 'E2-E4' auf?", answer: "Manuel Goettsching" }
        ]
      },
      {
        id: "question",
        title: "Was ist die Frage",
        questions: [
          { value: 200, prompt: "Wie heißt die Hauptstadt von Portugal?", answer: "Lissabon" },
          { value: 400, prompt: "Wie heißt das Parlament der Schweiz?", answer: "Bundesversammlung" },
          { value: 600, prompt: "Welche deutsche Universitaet wurde 1386 gegruendet?", answer: "Heidelberg" },
          { value: 800, prompt: "Wie heißt der Prozess, bei dem Pflanzen CO2 in Zucker umwandeln?", answer: "Photosynthese" },
          { value: 1000, prompt: "Welcher Vertrag legte 1919 die Nachkriegsordnung Europas fest?", answer: "Vertrag von Versailles" }
        ]
      },
      {
        id: "general",
        title: "Allgemein",
        questions: [
          { value: 200, prompt: "Welcher Hersteller baut das Modell Golf?", answer: "Volkswagen" },
          { value: 400, prompt: "Welche Wissenschaftlerin entdeckte Radium zusammen mit ihrem Ehemann?", answer: "Marie Curie" },
          { value: 600, prompt: "Welcher Autor schrieb 'Der Steppenwolf'?", answer: "Hermann Hesse" },
          { value: 800, prompt: "Wie heißt das deutsche Zentrum fuer Luft- und Raumfahrt?", answer: "DLR" },
          { value: 1000, prompt: "Welche Stadt war 1648 Ort der Schlussverhandlungen des Westfaelischen Friedens?", answer: "Muenster" }
        ]
      },
      {
        id: "numbers",
        title: "Zahlen",
        questions: [
          { value: 200, prompt: "Wie viele Sekunden hat eine Stunde?", answer: "3600" },
          { value: 400, prompt: "Wie lautet die Quadratwurzel aus 256?", answer: "16" },
          { value: 600, prompt: "Wie viele Nullen hat eine deutsche Billion?", answer: "12" },
          { value: 800, prompt: "Wie lautet 17 hoch 3?", answer: "4913" },
          { value: 1000, prompt: "Welche Summe ergibt 1 + 2 + ... + 20?", answer: "210" }
        ]
      },
      {
        id: "flags",
        title: "Flaggen",
        questions: [
          { value: 200, prompt: "Welche Farben hat die Flagge Frankreichs von links nach rechts?", answer: "Blau Weiss Rot" },
          { value: 400, prompt: "Welches Land zeigt einen roten Kreis auf gruener Flaeche?", answer: "Bangladesch" },
          { value: 600, prompt: "Welches Land fuehrt einen weissen Zedernbaum auf rotem und weissem Grund?", answer: "Libanon" },
          { value: 800, prompt: "Welches Land nutzt gruen-weiss-schwarze Streifen mit rotem Dreieck und weissem Stern?", answer: "Jordanien" },
          { value: 1000, prompt: "Welches Land zeigt einen schwarzen Doppeladler auf rotem Grund?", answer: "Albanien" }
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
        answer: question.answer
      }))
    }))
  };
}

export const rounds = roundDefinitions.map(decorateRound);
