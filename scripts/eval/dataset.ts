// Fixed dataset for evaluating retrieval. Memories are referenced by key, so questions
// stay readable and the dataset doesn't depend on database ids.
//
// Some memories are deliberately similar (two trips, two fitness notes, two family health
// notes) to make ranking harder, and some contain exact names or codes that embeddings
// tend to handle poorly. All names, numbers and codes are made up.

export interface EvalMemory {
  key: string;
  // When the note was written (YYYY-MM-DD), so dates in its text read as they would to a real user
  savedAt: string;
  title: string;
  content: string;
  tags: string[];
}

export interface EvalQuestion {
  question: string;
  // Keys of memories that answer the question; empty means no memory does
  expected: string[];
  // What the question tests, for reading the results
  kind: 'paraphrase' | 'exact' | 'multi' | 'long-detail' | 'unanswerable' | 'close-call';
}

export const memories: EvalMemory[] = [
  {
    key: 'goa-trip',
    savedAt: '2026-03-22',
    title: 'Trip to Goa',
    content:
      'Went to Goa in March 2026 with college friends. Stayed near Baga beach, tried scuba diving at Grande Island and loved the fish curry at a small shack called Brittos.',
    tags: ['travel', 'friends'],
  },
  {
    key: 'manali-trip',
    savedAt: '2025-12-30',
    title: 'Manali trip',
    content:
      'Family trip to Manali in December 2025. Saw snow at Solang Valley. Paragliding got cancelled because of strong winds. Stayed at Hotel Snow Peak.',
    tags: ['travel', 'family'],
  },
  {
    key: 'gym-routine',
    savedAt: '2026-09-14',
    title: 'Gym routine',
    content:
      'Started going to the gym in September. Monday chest and triceps, Wednesday back and biceps, Friday legs. Trying to bench press 60 kg by December.',
    tags: ['health', 'fitness'],
  },
  {
    key: 'running',
    savedAt: '2026-10-05',
    title: 'Running progress',
    content:
      'Running laps at Cubbon Park three mornings a week. Current 5 km time is 31 minutes. Aiming to finish the TCS World 10K in May under 60 minutes.',
    tags: ['health', 'fitness'],
  },
  {
    key: 'doctor-visit',
    savedAt: '2026-09-20',
    title: 'Doctor visit',
    content:
      'Dr. Mehta said my vitamin D is low at 18 ng/mL. Prescribed a 60,000 IU capsule once a week for 8 weeks, then a retest.',
    tags: ['health'],
  },
  {
    key: 'wifi',
    savedAt: '2025-11-08',
    title: 'Home internet',
    content:
      'Internet provider is ACT Fibernet, account number ACT-4471982. Plan is 150 Mbps. The router password is saved in the password manager.',
    tags: ['home'],
  },
  {
    key: 'laptop',
    savedAt: '2025-01-18',
    title: 'Laptop warranty',
    content:
      'Bought a Dell XPS 15 in January 2025. Service tag 7GH2KQ3. Warranty is valid until January 2027 and covers accidental damage.',
    tags: ['devices'],
  },
  {
    key: 'rent',
    savedAt: '2025-07-03',
    title: 'Rent',
    content: 'Rent is 18,000 rupees a month, paid to the landlord Mr. Rao by UPI on the 5th.',
    tags: ['money', 'home'],
  },
  {
    key: 'sip',
    savedAt: '2025-06-12',
    title: 'Investments',
    content:
      'Started a 5,000 rupee monthly SIP in the Parag Parikh Flexi Cap mutual fund in June 2025. It is deducted on the 10th.',
    tags: ['money'],
  },
  {
    key: 'mom-birthday',
    savedAt: '2026-08-02',
    title: "Mom's birthday",
    content:
      "Mom's birthday is on 14 August. She loves gardening, so I'm planning to gift her a set of terracotta planters.",
    tags: ['family'],
  },
  {
    key: 'dad-medicine',
    savedAt: '2026-05-16',
    title: "Dad's medicine",
    content:
      'Dad takes Telma 40 for blood pressure every morning after breakfast. A 30-day strip is refilled from Apollo Pharmacy.',
    tags: ['family', 'health'],
  },
  {
    key: 'biryani',
    savedAt: '2026-02-08',
    title: 'Chicken biryani recipe',
    content:
      'Marinate the chicken in curd, ginger garlic paste and biryani masala for 2 hours. Par-boil basmati rice, layer it with the chicken and cook on dum for 25 minutes.',
    tags: ['recipes'],
  },
  {
    key: 'cold-coffee',
    savedAt: '2026-04-25',
    title: 'Cold coffee recipe',
    content:
      'Blend 2 teaspoons of instant coffee, 2 teaspoons of sugar, a glass of cold milk and ice for 30 seconds.',
    tags: ['recipes'],
  },
  {
    key: 'internship',
    savedAt: '2026-07-01',
    title: 'Internship',
    content:
      'Internship at Zentrix Labs building a REST API in Go. My mentor is Priya. Daily standup is at 10:30.',
    tags: ['work'],
  },
  {
    key: 'interview',
    savedAt: '2026-10-19',
    title: 'Interview prep',
    content:
      'Software engineering interview at Amazon on 12 November. Focus on graphs and dynamic programming and finish the LeetCode 75 list.',
    tags: ['work', 'career'],
  },
  {
    key: 'book',
    savedAt: '2026-06-28',
    title: 'Atomic Habits notes',
    content:
      'Finished reading Atomic Habits. Key ideas: get 1% better every day, stack a new habit onto an existing one, and make good habits easy.',
    tags: ['books'],
  },
  {
    key: 'movies',
    savedAt: '2026-08-15',
    title: 'Movies to watch',
    content: 'Watchlist: rewatch Interstellar, Dune Part Two, 12th Fail and Oppenheimer.',
    tags: ['entertainment'],
  },
  {
    key: 'bike-service',
    savedAt: '2026-09-02',
    title: 'Bike service',
    content:
      'Royal Enfield Classic 350 is due for service at 10,000 km. Last oil change was on 2 September at Speedway Motors.',
    tags: ['vehicle'],
  },
  {
    key: 'passport',
    savedAt: '2026-10-12',
    title: 'Passport renewal',
    content:
      'Applied for passport renewal. File number BN2071654321. Appointment at the Koramangala Passport Seva Kendra on 3 November.',
    tags: ['documents'],
  },
  {
    key: 'guitar',
    savedAt: '2026-07-20',
    title: 'Learning guitar',
    content:
      'Learning the chords G, C, D and Em. Practising Wonderwall for 20 minutes every day.',
    tags: ['hobbies'],
  },
  {
    key: 'plants',
    savedAt: '2026-05-30',
    title: 'Balcony plants',
    content:
      'Balcony has a money plant, tulsi and aloe vera. Water the tulsi every day and the aloe vera once a week.',
    tags: ['home', 'hobbies'],
  },
  {
    key: 'reunion',
    savedAt: '2026-10-21',
    title: 'College reunion',
    content:
      'College reunion planned for 20 December at the RV College canteen. Rahul is organising it and collecting 500 rupees per person.',
    tags: ['friends'],
  },
  {
    key: 'sleep',
    savedAt: '2026-08-24',
    title: 'Sleep habits',
    content:
      'Trying to be asleep by 11 pm. Stopping caffeine after 4 pm has made it much easier to fall asleep.',
    tags: ['health'],
  },
  {
    key: 'budget',
    savedAt: '2026-10-01',
    title: 'Monthly budget',
    content:
      'Monthly budget: food 8,000 rupees, travel 3,000 rupees and subscriptions 1,200 rupees for Netflix and Spotify.',
    tags: ['money'],
  },
  {
    key: 'phone',
    savedAt: '2026-10-24',
    title: 'New phone order',
    content:
      'Ordered a Pixel 9 from Flipkart. Order ID OD4312987766. Delivery expected on 28 October.',
    tags: ['devices'],
  },

  // Long notes, where the answer is one detail among many. A whole note embedded as a single
  // vector can match a question about one of its details only weakly.
  {
    key: 'europe-trip',
    // Written after the visa came through, two months before the trip
    savedAt: '2026-04-10',
    title: 'Europe trip plan, June 2026',
    content:
      'Europe trip from 4 to 18 June 2026 with my cousin Arjun. Flying Air India AI 131 from Mumbai to London Heathrow on 4 June, departing at 01:55 and landing at 07:20; the return flight AI 130 leaves London on 18 June at 21:30, and the return ticket cost 62,400 rupees per person. In London we stay 3 nights at the Premier Inn Kings Cross for 118 pounds a night, booking reference PIK48291. On 7 June we take the 09:31 Eurostar to Paris, which cost 89 euros each, and stay 4 nights at an Airbnb in Montmartre for 96 euros a night. On 11 June we take the TGV to Zurich and use an 8-day Swiss Travel Pass that cost 389 Swiss francs. In Switzerland we spend 2 nights at the Balmers hostel in Interlaken at 54 francs a night, then 2 nights in Lucerne. The Jungfraujoch trip on 13 June costs 235 francs with the 25 percent pass discount. The Schengen visa appointment was at VFS Bengaluru on 18 March and the visa came through on 2 April. Travel insurance is a Tata AIG policy, number TA-77310452, which cost 4,200 rupees. I am carrying 600 euros and 300 pounds in cash, exchanged at 90.5 rupees per euro. The total budget is 3,20,000 rupees and I have spent 2,87,650 rupees so far, leaving 32,350 rupees.',
    tags: ['travel', 'family', 'planning'],
  },
  {
    key: 'cake-recipe',
    savedAt: '2026-09-06',
    title: "Amma's chocolate cake",
    content:
      "Amma has made this cake for every birthday since I was six, and she finally wrote it down for me when I moved to Bengaluru. It serves 10 to 12 people and fits one 9-inch round tin.\n\nIngredients: 2 cups (250 g) maida, 1 and three-quarter cups (350 g) sugar, three-quarter cup (75 g) unsweetened cocoa powder, 1 and a half teaspoons baking soda, 1 teaspoon baking powder, half a teaspoon of salt, 2 eggs, 1 cup (240 ml) milk, half a cup (120 ml) sunflower oil, 2 teaspoons vanilla essence and 1 cup (240 ml) hot coffee. The coffee doesn't make it taste of coffee; it deepens the chocolate flavour.\n\nMethod: Preheat the oven to 175 degrees Celsius for 15 minutes. Grease the tin with butter and line the bottom with butter paper. Sift the maida, cocoa, baking soda, baking powder and salt together twice so there are no lumps. In another bowl, whisk the eggs and sugar for 2 minutes until pale, then add the milk, oil and vanilla. Fold the wet mix into the dry mix in three parts with a spatula and don't overmix. Pour in the hot coffee last and stir gently. The batter will be very thin, almost like soup, and that is correct. Pour it into the tin and tap the tin twice on the counter to knock out air bubbles. Bake on the middle rack for 35 to 40 minutes, until a toothpick in the centre comes out with a few moist crumbs. Don't open the oven door in the first 25 minutes or the middle will sink. Let it cool in the tin for 10 minutes, then turn it out onto a wire rack and let it cool completely, about 2 hours, before frosting.\n\nGanache frosting: Heat 200 ml fresh cream until it just starts to bubble at the edges, pour it over 200 g chopped dark chocolate, leave it for 5 minutes, then stir until smooth. Add 1 tablespoon of butter for shine. Let it thicken at room temperature for about 30 minutes before spreading. For birthdays Amma sprinkles chopped roasted almonds on top.\n\nEgg-free version: For my friend Kavya, who doesn't eat eggs, replace the 2 eggs with half a cup (120 g) of thick curd and an extra half teaspoon of baking soda. It comes out slightly denser but just as moist.\n\nWithout an oven: Amma bakes it in a 5-litre pressure cooker. Spread a cup of salt on the bottom, put a stand on it, remove the gasket and the whistle, preheat for 10 minutes on medium heat, then bake on low heat for 45 to 50 minutes.\n\nStorage: The cake stays fresh for 2 days at room temperature in an airtight box, or 5 days in the fridge. Take it out 30 minutes before serving. Unfrosted layers wrapped in cling film can be frozen for up to a month.\n\nMistakes I've made: the first time I used cold coffee and the cake came out flat. The second time I baked it at 200 degrees and the top burnt while the middle stayed raw. My oven runs about 10 degrees hot, so I now use a cheap oven thermometer.",
    tags: ['recipe', 'family'],
  },
  {
    key: 'flat-move',
    savedAt: '2026-10-18',
    title: 'Flat move checklist',
    content:
      'Moving from the 1BHK in BTM Layout to a 2BHK in HSR Layout Sector 2, flat 304 at Lakeview Residency, on Sunday 1 November 2026. The new rent is 26,500 rupees a month plus 2,000 rupees maintenance, paid to the owner Mrs. Shalini Iyer by bank transfer on the 3rd. I paid a security deposit of 1,50,000 rupees on 12 October; the lease is for 11 months with a 6-month lock-in. Mr. Rao, the old landlord, holds my old deposit of 90,000 rupees and has promised to return it within 15 days of the handover, minus 4,500 rupees for repainting. Packers and movers: Agarwal Packers, booked on 14 October for 14,800 rupees including insurance for the TV and fridge, with pickup at 8 am. The truck needs gate permission at the new society, which the facility manager Suresh (intercom 2210) will arrange. Internet: the ACT Fibernet shifting request was raised on 16 October, ticket SR-889120, with a 500 rupee shifting charge and installation on 2 November between 10 am and 1 pm. Electricity: the BESCOM account stays in the owner\'s name; the meter read 18,452 units at handover. Gas: transferring the Indane connection needs the subscription voucher and a copy of the new rental agreement, at Vinayaka Gas Agency in HSR. Update the new address on Aadhaar, the HDFC bank account, the passport file, Amazon, Swiggy and the office HR portal. The new flat is 4 km from the office, so I plan to cycle there on Tuesdays and Thursdays. I got 3 sets of keys; the spare set is with my neighbour Deepa in flat 305.',
    tags: ['home', 'planning'],
  },
  {
    // About 7,000 characters, close to the 8,000 limit. Answers sit at the start, middle and
    // end, to show whether details far into a long note can still be found.
    key: 'wedding-plan',
    savedAt: '2026-10-20',
    title: "Meera's wedding planning notes",
    content:
      "Meera's wedding planning notes. My cousin Meera is marrying Karthik Raman on Sunday 13 December 2026 in Mysuru, and since I'm the cousin who lives closest, I've ended up coordinating half of it with Aunty Lakshmi. These notes have everything in one place so I stop scrolling through the family WhatsApp group.\n\nDates and events: the mehendi is on Friday 11 December from 4 pm at Aunty Lakshmi's house in Saraswathipuram. The sangeet is on Saturday 12 December from 7 pm at the Hotel Royal Orchid banquet hall. The muhurtham is on Sunday 13 December between 9:15 and 10:30 am at Sri Krishna Kalyana Mantapa near Chamundi Hill, and the reception is the same evening from 7 pm on the lawn at the Lalitha Mahal Palace Hotel. Expected guests: about 180 at the mehendi, 250 at the sangeet, 400 at the muhurtham and 550 at the reception.\n\nVenue details: the kalyana mantapa costs 1,20,000 rupees for two days including the dining hall and 12 rooms for the bride's family; an advance of 40,000 rupees was paid on 2 September and the rest is due on 1 December. The manager is Mr. Gopal, and the electricity backup is included. The palace lawn for the reception costs 2,75,000 rupees, which Karthik's family is paying. The parking at the palace fits 120 cars, so we've asked guests from Bengaluru to share cabs.\n\nCatering: Sri Annapoorna Caterers, run by Mr. Venkatesh, is doing every meal except the reception. Breakfast on the wedding day is 280 rupees a plate with idli, vada, kesari bath, pongal and filter coffee. The wedding lunch is a full banana-leaf meal at 650 rupees a plate with 24 items, including bisi bele bath, two payasams and Mysore pak. The sangeet dinner is a north Indian buffet at 850 rupees a plate with a live chaat counter. We confirmed 420 plates for lunch, with the final count due 5 days before. Mr. Venkatesh needs one gas cylinder for every 100 plates, which the mantapa supplies.\n\nDecoration and flowers: Mallige Decorators are doing the mantapa stage with jasmine and marigold for 85,000 rupees, and a simpler marigold and banana-leaf entrance at Aunty's house for the mehendi for 18,000 rupees. Meera wants no plastic flowers anywhere. The flower jadai for Meera's hair comes from a stall in Devaraja Market and has to be picked up at 6 am on the wedding day; Uncle Ravi has volunteered.\n\nPhotography: we booked Frames by Nikhil for all four events for 1,65,000 rupees, which covers two photographers, one videographer, a drone at the reception, and an edited album of 60 pages delivered within 8 weeks. The pre-wedding shoot at Karanji Lake is on 22 November at 6:30 am.\n\nClothes and jewellery: Meera's muhurtham saree is a Mysore silk from the KSIC showroom that cost 48,500 rupees, and her reception lehenga is being stitched by Rekha Tailors with a final fitting on 28 November. The jewellery is coming from the family locker in Bengaluru, and Aunty Lakshmi will carry it herself on the 10 December Shatabdi.\n\nMusic: the nadaswaram group from Nanjangud will play during the muhurtham for 35,000 rupees. For the sangeet, DJ Sid is booked from 8 pm to 11:30 pm for 30,000 rupees; the hotel doesn't allow loud music after 11:30.\n\nRooms for guests: we've blocked 25 rooms at the Hotel Royal Orchid from 11 to 14 December at 4,200 rupees a night including breakfast. The room list goes to the front office by 1 December, and the contact there is Ms. Farah.\n\nReturn gifts: every guest at the muhurtham gets a small brass kumkum box and a packet of Mysore pak, which Aunty ordered from Guru Sweets, 450 boxes at 160 rupees each. The mehendi guests get bangles instead.\n\nMehendi: the mehendi artist is Shabnam from Henna by Shabnam, who is bringing two helpers. Meera's bridal design covers both arms up to the elbow and the feet up to the ankle, and takes about 4 hours, so she starts at 11 am. The bridal design costs 21,000 rupees and guests' designs are 300 rupees per hand, paid by Aunty in cash on the day. Lunch for the mehendi is from Hotel Mylari, 60 parcels of their dosa with saagu, ordered for 1 pm.\n\nRituals on the wedding day: the kashi yatra starts at 7:30 am outside the mantapa, followed by the maale and the oonjal. Kanyadaanam is done by Uncle Ravi and Aunty Lakshmi. The priest is Shastri Subramanya from Chamarajapuram, whose dakshina is 25,000 rupees plus a silk veshti, and he has given a list of 40 items for the havan, including 5 kg of ghee, coconut, betel leaves and navadhanya, which Uncle Ravi is buying from the Agrahara market on 12 December.\n\nTransport: Karthik's baraat comes in a decorated vintage Ambassador that Karthik's friend arranged. We've hired two 20-seater Tempo Travellers from Sri Ganesh Travels for the three days at 4,500 rupees per vehicle per day, to move elderly relatives between the hotel, Aunty's house and the mantapa. The drivers' numbers are pinned in the family group. Guests landing at Bengaluru airport are on their own, but we've shared the KSRTC Flybus timings to Mysuru.\n\nBudget so far, bride's side: the mantapa 1,20,000, catering about 3,90,000, decoration 1,03,000, photography 1,65,000, music 65,000, guest rooms about 3,15,000, return gifts 72,000, transport 27,000 and the priest 25,000, which comes to roughly 12,82,000 rupees against a budget of 13,50,000. Clothes and jewellery are paid separately by Meera and Aunty. Uncle Ravi is keeping the receipts in a green folder, and the payment tracker is a shared Google Sheet called Meera Wedding Accounts.\n\nPeople to call: Aunty Lakshmi for anything about the rituals, Uncle Ravi for money and shopping, Karthik's sister Divya for anything on the groom's side, and Meera's best friend Nandini, who is the bridesmaid in charge of the bride's room and the emergency kit with safety pins, plasters, a phone charger and Meera's inhaler.\n\nMy own jobs: I'm coordinating the sangeet. The choreographer, Ananya from Step Up Studio, is teaching the cousins three dances over four Sunday sessions in November at her studio in Jayanagar. Her total fee is 24,000 rupees; I've paid 10,000 rupees, and the remaining 14,000 rupees is due after the last session on 29 November. I'm also in charge of the welcome boards and the seating plan for the sangeet, which needs to reach the hotel by 8 December.\n\nMy gift for Meera: a pair of gold jhumkas from Bhima Jewellers in Jayanagar that cost 62,000 rupees, already bought and kept in my cupboard, plus a framed print of the photo of the two of us at her graduation. Karthik gets a Titan watch from my parents.\n\nMy travel: I'm driving down from Bengaluru on 10 December with Arjun, leaving at 6 am to avoid the Maddur traffic. My return is by the Shatabdi Express from Mysuru on Monday 14 December at 2:15 pm, coach C3, seat 47, PNR 4721938650. I've taken leave from the office from 10 to 15 December.\n\nStill to do: confirm the final lunch count with Mr. Venkatesh by 8 December, print 60 welcome cards, collect the jadai flowers list from Meera, and remind everyone that the mantapa has no lift for elderly guests, so Ajji will need help with the stairs.",
    tags: ['family', 'planning'],
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
  {
    question: 'What trips have I been on?',
    expected: ['goa-trip', 'manali-trip', 'europe-trip'],
    kind: 'multi',
  },

  // One detail inside a long note
  { question: 'At what temperature should I bake the chocolate cake?', expected: ['cake-recipe'], kind: 'long-detail' },
  { question: 'What can I use instead of eggs in the cake?', expected: ['cake-recipe'], kind: 'long-detail' },
  { question: 'How long does the cake stay fresh in the fridge?', expected: ['cake-recipe'], kind: 'long-detail' },
  { question: 'How do I bake a cake without an oven?', expected: ['cake-recipe'], kind: 'long-detail' },
  { question: 'Why did my cake come out flat?', expected: ['cake-recipe'], kind: 'long-detail' },
  { question: 'Which hostel am I staying at in Interlaken?', expected: ['europe-trip'], kind: 'long-detail' },
  { question: 'How much did my travel insurance cost?', expected: ['europe-trip'], kind: 'long-detail' },
  { question: 'When did my Schengen visa come through?', expected: ['europe-trip'], kind: 'long-detail' },
  { question: 'What time does the Eurostar to Paris leave?', expected: ['europe-trip'], kind: 'long-detail' },
  { question: 'How much did the packers and movers charge?', expected: ['flat-move'], kind: 'long-detail' },
  { question: 'How much will I get back from my old deposit?', expected: ['flat-move'], kind: 'long-detail' },
  { question: 'When is the internet being installed at the new flat?', expected: ['flat-move'], kind: 'long-detail' },
  { question: 'Who has the spare keys to my new flat?', expected: ['flat-move'], kind: 'long-detail' },
  // In the 7,000-character wedding note: near the start, the middle, and past character 6,000
  { question: "Where is Meera's wedding reception?", expected: ['wedding-plan'], kind: 'long-detail' },
  { question: 'How much is the wedding lunch per plate?', expected: ['wedding-plan'], kind: 'long-detail' },
  { question: "Which photographer is covering Meera's wedding?", expected: ['wedding-plan'], kind: 'long-detail' },
  { question: 'How much do I still owe the sangeet choreographer?', expected: ['wedding-plan'], kind: 'long-detail' },
  { question: 'What am I gifting Meera for her wedding?', expected: ['wedding-plan'], kind: 'long-detail' },
  { question: 'When is my train back from Mysuru after the wedding?', expected: ['wedding-plan'], kind: 'long-detail' },

  // Nothing in the memories answers these
  { question: 'What is my blood group?', expected: [], kind: 'unanswerable' },
  { question: 'When is my wedding anniversary?', expected: [], kind: 'unanswerable' },
  { question: 'Which company insures my car?', expected: [], kind: 'unanswerable' },
  { question: "What's my favourite programming language?", expected: [], kind: 'unanswerable' },

  // Look like a saved memory but aren't answered by it (only Dad's medicine and Mom's birthday
  // are saved; Netflix and passwords appear in different notes)
  { question: 'What medicine does my mother take?', expected: [], kind: 'close-call' },
  { question: "When is my dad's birthday?", expected: [], kind: 'close-call' },
  { question: 'What is my Netflix password?', expected: [], kind: 'close-call' },
  { question: 'How much is my monthly phone bill?', expected: [], kind: 'close-call' },
  { question: "What is Arjun's phone number?", expected: [], kind: 'close-call' },
  { question: "When is Divya's wedding?", expected: [], kind: 'close-call' },
];
