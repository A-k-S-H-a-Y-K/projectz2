// Held-out test set: questions about the same memories as dataset.ts that no setting was
// tuned on. Every cutoff, rule and model choice was fixed before these were run, and they
// are run once, with npm run eval:test and npm run eval:answers:test. Results go to
// results-test.md and answers-test.md.
//
// Two groups, reported separately:
// - blind: written by a person who didn't build the search and never saw the tuning
//   questions, in their own casual style. Some happen to ask the same fact as a tuning
//   question; those are marked and left out of the headline numbers.
// - informed: written by the developer side, knowing how search works but avoiding the
//   tuning questions and the blind ones.
import type { EvalQuestion } from './dataset.js';

export interface TestQuestion extends EvalQuestion {
  source: 'blind' | 'informed';
  // Asks the same fact as a tuning question, so it isn't truly unseen
  overlapsTuning?: true;
}

const blind = (
  question: string,
  expected: string[],
  kind: EvalQuestion['kind'],
  overlapsTuning?: true
): TestQuestion => ({ question, expected, kind, source: 'blind', overlapsTuning });

const informed = (
  question: string,
  expected: string[],
  kind: EvalQuestion['kind']
): TestQuestion => ({ question, expected, kind, source: 'informed' });

export const testQuestions: TestQuestion[] = [
  // --- Blind (32) ---
  blind('when is my pixel getting delivered', ['phone'], 'paraphrase'),
  blind('how much do i have to pay rahul for the reunion', ['reunion'], 'paraphrase'),
  blind("what time is the muhurtham on meera's wedding day", ['wedding-plan'], 'long-detail'),
  blind('whats my seat no on the train back from mysuru', ['wedding-plan'], 'long-detail'),
  blind('how much do i still owe the dance teacher', ['wedding-plan'], 'long-detail', true),
  blind("who's going to get the jadai flowers in the morning", ['wedding-plan'], 'long-detail'),
  blind('is there a lift at the mantapa for ajji', ['wedding-plan'], 'long-detail'),
  blind('amazon interview date??', ['interview'], 'paraphrase'),
  blind('who has my spare keys', ['flat-move'], 'long-detail', true),
  blind('act shifting ticket no', ['flat-move'], 'long-detail'),
  blind('how much is rao cutting from my old deposit', ['flat-move'], 'long-detail', true),
  blind('passport appointment kahan hai', ['passport'], 'paraphrase'),
  blind('whats my 5k time right now', ['running'], 'paraphrase'),
  blind('how many weeks of the vit d capsule', ['doctor-visit'], 'paraphrase'),
  blind('which day is legs', ['gym-routine'], 'paraphrase'),
  blind('cake came out flat last time why', ['cake-recipe'], 'long-detail', true),
  blind("can i make amma's cake without an oven", ['cake-recipe'], 'long-detail', true),
  blind('premier inn booking ref', ['europe-trip'], 'long-detail'),
  blind('how much was jungfraujoch with the pass', ['europe-trip'], 'long-detail'),
  blind('how much budget is left for europe', ['europe-trip'], 'long-detail'),
  blind('dad bp tablet name', ['dad-medicine'], 'paraphrase'),
  blind('that fish curry place in goa what was it called', ['goa-trip'], 'paraphrase'),
  blind('till when is the laptop warranty', ['laptop'], 'paraphrase'),
  blind('whats my car insurance policy number', [], 'close-call', true),
  blind('when is my next dentist appointment', [], 'unanswerable'),
  blind('how much did the goa trip cost', [], 'close-call'),
  blind('which gym did i join', [], 'close-call'),
  blind("what's my salary at zentrix", [], 'close-call'),
  blind("how much was meera's reception lehenga", [], 'close-call'),
  blind("deepa's phone number?", [], 'close-call'),
  blind("arjun's pnr for the shatabdi", [], 'close-call'),
  blind('whats the flight number for the goa trip', [], 'close-call'),

  // --- Informed (70) ---
  // Worded differently from the memory
  informed('Where did we stay on the Goa trip?', ['goa-trip'], 'paraphrase'),
  informed('Where did I see snow last December?', ['manali-trip'], 'paraphrase'),
  informed('How much do I want to bench by the end of the year?', ['gym-routine'], 'paraphrase'),
  informed('Which day do I train back at the gym?', ['gym-routine'], 'paraphrase'),
  informed('Which park do I go running in?', ['running'], 'paraphrase'),
  informed('What was my vitamin D level?', ['doctor-visit'], 'paraphrase'),
  informed('How fast is my home broadband?', ['wifi'], 'paraphrase'),
  informed('Which laptop do I own?', ['laptop'], 'paraphrase'),
  informed('Which mutual fund am I investing in every month?', ['sip'], 'paraphrase'),
  informed('What hobby does my mom enjoy?', ['mom-birthday'], 'paraphrase'),
  informed('How long do I cook the biryani on dum?', ['biryani'], 'paraphrase'),
  informed('How long should I blend the cold coffee?', ['cold-coffee'], 'paraphrase'),
  informed('What programming language am I using at work?', ['internship'], 'paraphrase'),
  informed('Which book did I finish recently?', ['book'], 'paraphrase'),
  informed('Which Indian film is on my watchlist?', ['movies'], 'paraphrase'),
  informed("At what mileage is my bike's next service?", ['bike-service'], 'paraphrase'),
  informed('When do I need to go to the passport office?', ['passport'], 'paraphrase'),
  informed('Which song am I practising on guitar?', ['guitar'], 'paraphrase'),
  informed('Where is the college reunion happening?', ['reunion'], 'paraphrase'),
  informed('What time do I try to be asleep by?', ['sleep'], 'paraphrase'),
  informed('How much have I set aside for food each month?', ['budget'], 'paraphrase'),
  informed('Where did I order my new phone from?', ['phone'], 'paraphrase'),

  // Exact names and codes
  informed('TA-77310452', ['europe-trip'], 'exact'),
  informed('4721938650', ['wedding-plan'], 'exact'),
  informed('Lakeview Residency', ['flat-move'], 'exact'),
  informed('Parag Parikh', ['sip'], 'exact'),
  informed('Agarwal Packers', ['flat-move'], 'exact'),
  informed('Cubbon Park', ['running'], 'exact'),

  // Answered by more than one memory
  informed('How much rent do I pay?', ['rent', 'flat-move'], 'multi'),
  informed('What recipes have I saved?', ['biryani', 'cold-coffee', 'cake-recipe'], 'multi'),
  informed('What am I doing with my cousin Arjun?', ['europe-trip', 'wedding-plan'], 'multi'),
  informed('What do my notes say about my internet connection?', ['wifi', 'flat-move'], 'multi'),

  // Single details inside the long memories
  informed('Where am I staying in Paris?', ['europe-trip'], 'long-detail'),
  informed('How much did the Swiss Travel Pass cost?', ['europe-trip'], 'long-detail'),
  informed('What time does my flight back from London leave?', ['europe-trip'], 'long-detail'),
  informed('How much cash am I carrying for the Europe trip?', ['europe-trip'], 'long-detail'),
  informed('How many nights are we spending in Lucerne?', ['europe-trip'], 'long-detail'),
  informed("How many people does Amma's chocolate cake serve?", ['cake-recipe'], 'long-detail'),
  informed('How much cream goes into the ganache?', ['cake-recipe'], 'long-detail'),
  informed('Why do I use an oven thermometer for the cake?', ['cake-recipe'], 'long-detail'),
  informed('Can I freeze the cake layers?', ['cake-recipe'], 'long-detail'),
  informed('Who owns my new flat?', ['flat-move'], 'long-detail'),
  informed("What is the facility manager's intercom number?", ['flat-move'], 'long-detail'),
  informed('Where do I transfer my gas connection?', ['flat-move'], 'long-detail'),
  informed('Which days will I cycle to the office?', ['flat-move'], 'long-detail'),
  informed("When is Meera's pre-wedding photoshoot?", ['wedding-plan'], 'long-detail'),
  informed("How much is the priest's dakshina?", ['wedding-plan'], 'long-detail'),
  informed('Until what time can the DJ play at the sangeet?', ['wedding-plan'], 'long-detail'),
  informed('Who is our contact at the Royal Orchid front office?', ['wedding-plan'], 'long-detail'),
  informed('How much is still due for the kalyana mantapa?', ['wedding-plan'], 'long-detail'),

  // Not in any memory
  informed('What is my PAN card number?', [], 'unanswerable'),
  informed('Which school did I study in?', [], 'unanswerable'),
  informed('How tall am I?', [], 'unanswerable'),
  informed('Which IPL team do I support?', [], 'unanswerable'),
  informed('How many siblings do I have?', [], 'unanswerable'),
  informed("What's my shoe size?", [], 'unanswerable'),
  informed("What's my credit card limit?", [], 'unanswerable'),
  informed('When did I last get a haircut?', [], 'unanswerable'),

  // Close to a memory, but asking for something it doesn't contain
  informed('What is my Aadhaar number?', [], 'close-call'),
  informed("When is Karthik's birthday?", [], 'close-call'),
  informed("What is Mr. Rao's phone number?", [], 'close-call'),
  informed('How much did the hotel in Manali cost?', [], 'close-call'),
  informed("What is Priya's email address?", [], 'close-call'),
  informed('What did the doctor say about my cholesterol?', [], 'close-call'),
  informed('What is the flight number from Zurich back to India?', [], 'close-call'),
  informed('How much did the Pixel 9 cost?', [], 'close-call'),
  informed('When is my bike insurance due for renewal?', [], 'close-call'),
  informed("What is Kavya's address?", [], 'close-call'),
  informed('What time is my Amazon interview?', [], 'close-call'),
  informed('Which Netflix plan do I have?', [], 'close-call'),
];
