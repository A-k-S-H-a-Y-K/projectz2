// Fixed dataset for evaluating retrieval. Memories are referenced by key, so questions
// stay readable and the dataset doesn't depend on database ids.
//
// Some memories are deliberately similar (two trips, two fitness notes, two family health
// notes) to make ranking harder, and some contain exact names or codes that embeddings
// tend to handle poorly. All names, numbers and codes are made up.

export interface EvalMemory {
  key: string;
  title: string;
  content: string;
  tags: string[];
}

export interface EvalQuestion {
  question: string;
  // Keys of memories that answer the question; empty means no memory does
  expected: string[];
  // What the question tests, for reading the results
  kind: 'paraphrase' | 'exact' | 'multi' | 'unanswerable';
}

export const memories: EvalMemory[] = [
  {
    key: 'goa-trip',
    title: 'Trip to Goa',
    content:
      'Went to Goa in March 2026 with college friends. Stayed near Baga beach, tried scuba diving at Grande Island and loved the fish curry at a small shack called Brittos.',
    tags: ['travel', 'friends'],
  },
  {
    key: 'manali-trip',
    title: 'Manali trip',
    content:
      'Family trip to Manali in December 2025. Saw snow at Solang Valley. Paragliding got cancelled because of strong winds. Stayed at Hotel Snow Peak.',
    tags: ['travel', 'family'],
  },
  {
    key: 'gym-routine',
    title: 'Gym routine',
    content:
      'Started going to the gym in September. Monday chest and triceps, Wednesday back and biceps, Friday legs. Trying to bench press 60 kg by December.',
    tags: ['health', 'fitness'],
  },
  {
    key: 'running',
    title: 'Running progress',
    content:
      'Running laps at Cubbon Park three mornings a week. Current 5 km time is 31 minutes. Aiming to finish the TCS World 10K in May under 60 minutes.',
    tags: ['health', 'fitness'],
  },
  {
    key: 'doctor-visit',
    title: 'Doctor visit',
    content:
      'Dr. Mehta said my vitamin D is low at 18 ng/mL. Prescribed a 60,000 IU capsule once a week for 8 weeks, then a retest.',
    tags: ['health'],
  },
  {
    key: 'wifi',
    title: 'Home internet',
    content:
      'Internet provider is ACT Fibernet, account number ACT-4471982. Plan is 150 Mbps. The router password is saved in the password manager.',
    tags: ['home'],
  },
  {
    key: 'laptop',
    title: 'Laptop warranty',
    content:
      'Bought a Dell XPS 15 in January 2025. Service tag 7GH2KQ3. Warranty is valid until January 2027 and covers accidental damage.',
    tags: ['devices'],
  },
  {
    key: 'rent',
    title: 'Rent',
    content: 'Rent is 18,000 rupees a month, paid to the landlord Mr. Rao by UPI on the 5th.',
    tags: ['money', 'home'],
  },
  {
    key: 'sip',
    title: 'Investments',
    content:
      'Started a 5,000 rupee monthly SIP in the Parag Parikh Flexi Cap mutual fund in June 2025. It is deducted on the 10th.',
    tags: ['money'],
  },
  {
    key: 'mom-birthday',
    title: "Mom's birthday",
    content:
      "Mom's birthday is on 14 August. She loves gardening, so I'm planning to gift her a set of terracotta planters.",
    tags: ['family'],
  },
  {
    key: 'dad-medicine',
    title: "Dad's medicine",
    content:
      'Dad takes Telma 40 for blood pressure every morning after breakfast. A 30-day strip is refilled from Apollo Pharmacy.',
    tags: ['family', 'health'],
  },
  {
    key: 'biryani',
    title: 'Chicken biryani recipe',
    content:
      'Marinate the chicken in curd, ginger garlic paste and biryani masala for 2 hours. Par-boil basmati rice, layer it with the chicken and cook on dum for 25 minutes.',
    tags: ['recipes'],
  },
  {
    key: 'cold-coffee',
    title: 'Cold coffee recipe',
    content:
      'Blend 2 teaspoons of instant coffee, 2 teaspoons of sugar, a glass of cold milk and ice for 30 seconds.',
    tags: ['recipes'],
  },
  {
    key: 'internship',
    title: 'Internship',
    content:
      'Internship at Zentrix Labs building a REST API in Go. My mentor is Priya. Daily standup is at 10:30.',
    tags: ['work'],
  },
  {
    key: 'interview',
    title: 'Interview prep',
    content:
      'Software engineering interview at Amazon on 12 November. Focus on graphs and dynamic programming and finish the LeetCode 75 list.',
    tags: ['work', 'career'],
  },
  {
    key: 'book',
    title: 'Atomic Habits notes',
    content:
      'Finished reading Atomic Habits. Key ideas: get 1% better every day, stack a new habit onto an existing one, and make good habits easy.',
    tags: ['books'],
  },
  {
    key: 'movies',
    title: 'Movies to watch',
    content: 'Watchlist: rewatch Interstellar, Dune Part Two, 12th Fail and Oppenheimer.',
    tags: ['entertainment'],
  },
  {
    key: 'bike-service',
    title: 'Bike service',
    content:
      'Royal Enfield Classic 350 is due for service at 10,000 km. Last oil change was on 2 September at Speedway Motors.',
    tags: ['vehicle'],
  },
  {
    key: 'passport',
    title: 'Passport renewal',
    content:
      'Applied for passport renewal. File number BN2071654321. Appointment at the Koramangala Passport Seva Kendra on 3 November.',
    tags: ['documents'],
  },
  {
    key: 'guitar',
    title: 'Learning guitar',
    content:
      'Learning the chords G, C, D and Em. Practising Wonderwall for 20 minutes every day.',
    tags: ['hobbies'],
  },
  {
    key: 'plants',
    title: 'Balcony plants',
    content:
      'Balcony has a money plant, tulsi and aloe vera. Water the tulsi every day and the aloe vera once a week.',
    tags: ['home', 'hobbies'],
  },
  {
    key: 'reunion',
    title: 'College reunion',
    content:
      'College reunion planned for 20 December at the RV College canteen. Rahul is organising it and collecting 500 rupees per person.',
    tags: ['friends'],
  },
  {
    key: 'sleep',
    title: 'Sleep habits',
    content:
      'Trying to be asleep by 11 pm. Stopping caffeine after 4 pm has made it much easier to fall asleep.',
    tags: ['health'],
  },
  {
    key: 'budget',
    title: 'Monthly budget',
    content:
      'Monthly budget: food 8,000 rupees, travel 3,000 rupees and subscriptions 1,200 rupees for Netflix and Spotify.',
    tags: ['money'],
  },
  {
    key: 'phone',
    title: 'New phone order',
    content:
      'Ordered a Pixel 9 from Flipkart. Order ID OD4312987766. Delivery expected on 28 October.',
    tags: ['devices'],
  },
];

export const questions: EvalQuestion[] = [
  // Worded differently from the memory, so matching relies on meaning
  { question: 'Where did I try scuba diving?', expected: ['goa-trip'], kind: 'paraphrase' },
  { question: "Why didn't I get to go paragliding?", expected: ['manali-trip'], kind: 'paraphrase' },
  { question: "What's my target time for the 10K race?", expected: ['running'], kind: 'paraphrase' },
  { question: 'What supplement did the doctor prescribe?', expected: ['doctor-visit'], kind: 'paraphrase' },
  { question: "Where do I get my father's tablets from?", expected: ['dad-medicine'], kind: 'paraphrase' },
  { question: 'What gift am I planning for my mother?', expected: ['mom-birthday'], kind: 'paraphrase' },
  { question: 'How long should the chicken marinate?', expected: ['biryani'], kind: 'paraphrase' },
  { question: 'Who is guiding me at my internship?', expected: ['internship'], kind: 'paraphrase' },
  { question: 'What should I study for my upcoming coding interview?', expected: ['interview'], kind: 'paraphrase' },
  { question: 'How often should I water my plants?', expected: ['plants'], kind: 'paraphrase' },
  { question: 'What helped me sleep better?', expected: ['sleep'], kind: 'paraphrase' },
  { question: 'How much do I spend on streaming services each month?', expected: ['budget'], kind: 'paraphrase' },

  // Exact names and codes
  { question: 'ACT-4471982', expected: ['wifi'], kind: 'exact' },
  { question: 'BN2071654321', expected: ['passport'], kind: 'exact' },
  { question: 'Speedway Motors', expected: ['bike-service'], kind: 'exact' },
  { question: 'OD4312987766', expected: ['phone'], kind: 'exact' },
  { question: 'Telma 40', expected: ['dad-medicine'], kind: 'exact' },
  { question: 'When is the 7GH2KQ3 warranty valid until?', expected: ['laptop'], kind: 'exact' },

  // More than one memory is relevant
  { question: 'What fitness goals do I have?', expected: ['gym-routine', 'running'], kind: 'multi' },
  { question: 'What trips have I been on?', expected: ['goa-trip', 'manali-trip'], kind: 'multi' },

  // Nothing in the memories answers these
  { question: 'What is my blood group?', expected: [], kind: 'unanswerable' },
  { question: 'When is my wedding anniversary?', expected: [], kind: 'unanswerable' },
  { question: 'Which company insures my car?', expected: [], kind: 'unanswerable' },
  { question: "What's my favourite programming language?", expected: [], kind: 'unanswerable' },
];
