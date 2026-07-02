const QUOTES = [
  // ── REAL ─────────────────────────────────────────────────────
  {
    text: "I could stand in the middle of Fifth Avenue and shoot somebody and I wouldn't lose any voters, okay?",
    real: true,
    source: "Campaign rally, Sioux Center, Iowa — January 23, 2016"
  },
  {
    text: "Grab 'em by the pussy. You can do anything.",
    real: true,
    source: "Access Hollywood tape recorded in 2005, published October 7, 2016"
  },
  {
    text: "The concept of global warming was created by and for the Chinese in order to make U.S. manufacturing non-competitive.",
    real: true,
    source: "@realDonaldTrump on Twitter — November 6, 2012"
  },
  {
    text: "My fingers are long and beautiful, as, it has been well documented, are various other parts of my body.",
    real: true,
    source: "New York Post interview — April 2011"
  },
  {
    text: "I've never seen a thin person drinking Diet Coke.",
    real: true,
    source: "@realDonaldTrump on Twitter — October 14, 2012"
  },
  {
    text: "They say the noise from windmills causes cancer.",
    real: true,
    source: "Address to NRCC members, Washington D.C. — April 2, 2019"
  },
  {
    text: "I'm speaking with myself, number one, because I have a very good brain and I've said a lot of things.",
    real: true,
    source: "MSNBC's Morning Joe, on who he consults on foreign policy — March 16, 2016"
  },
  {
    text: "I know words. I have the best words.",
    real: true,
    source: "Campaign rally, Myrtle Beach, South Carolina — December 2015"
  },
  {
    text: "The beauty of me is that I'm very rich.",
    real: true,
    source: "Good Morning America — March 17, 2011"
  },
  {
    text: "I've said if Ivanka weren't my daughter, perhaps I'd be dating her.",
    real: true,
    source: "The View — March 6, 2006"
  },
  {
    text: "Nobody knows more about taxes than me, maybe in the history of the world.",
    real: true,
    source: "Press conference, Trump Tower — May 2016"
  },
  {
    text: "I alone can fix it.",
    real: true,
    source: "Republican National Convention speech, Cleveland — July 21, 2016"
  },
  {
    text: "Sorry losers and haters, but my IQ is one of the highest — and you all know it! Please don't feel so stupid or insecure; it's not your fault.",
    real: true,
    source: "@realDonaldTrump on Twitter — May 8, 2013"
  },
  {
    text: "I think I am actually humble. I think I'm much more humble than you would understand.",
    real: true,
    source: "CBS 60 Minutes interview — July 2015"
  },
  {
    text: "You know, it really doesn't matter what the media write as long as you've got a young and beautiful piece of ass.",
    real: true,
    source: "Esquire magazine interview — 1991"
  },
  {
    text: "I have a great relationship with the Blacks. I've always had a great relationship with the Blacks.",
    real: true,
    source: "Interview with WNYW's Fred Dicker, NBC — April 2011"
  },
  {
    text: "I am the least racist person there is anywhere in the world.",
    real: true,
    source: "Presidential debate against Joe Biden — September 29, 2020"
  },
  {
    text: "I know more about ISIS than the generals do. Believe me.",
    real: true,
    source: "Campaign rally, Fort Dodge, Iowa — November 2015"
  },
  {
    text: "When Mexico sends its people, they're not sending their best. They're bringing drugs. They're bringing crime. They're rapists.",
    real: true,
    source: "Presidential campaign announcement, Trump Tower — June 16, 2015"
  },
  {
    text: "We will have so much winning if I get elected that you may get bored with winning.",
    real: true,
    source: "Campaign rally, New Hampshire — February 2016"
  },
  {
    text: "Robert Pattinson should not take back Kristen Stewart. She cheated on him like a dog & will do it again — just watch. He can do much better!",
    real: true,
    source: "@realDonaldTrump on Twitter — October 17, 2012"
  },
  {
    text: "I'm like a smart person.",
    real: true,
    source: "Interview with NBC News — January 2017"
  },
  {
    text: "An 'extremely credible source' has called my office and told me that @BarackObama's birth certificate is a fraud.",
    real: true,
    source: "@realDonaldTrump on Twitter — August 6, 2012"
  },
  {
    text: "All of the women on 'The Apprentice' flirted with me — consciously or unconsciously. That's to be expected.",
    real: true,
    source: "Trump: How to Get Rich, 2004"
  },
  {
    text: "I will build a great, great wall on our southern border, and I will have Mexico pay for that wall. Mark my words.",
    real: true,
    source: "Presidential campaign announcement, Trump Tower — June 16, 2015"
  },
  {
    text: "My Twitter has become so powerful that I can actually make my enemies tell the truth.",
    real: true,
    source: "@realDonaldTrump on Twitter — October 17, 2012"
  },
  {
    text: "I've always said, 'If you need Viagra, you're with the wrong girl.'",
    real: true,
    source: "Various interviews and campaign appearances — cited in multiple outlets, 2015–2016"
  },
  {
    text: "Nobody knows more about debt than me. I love debt. I love playing with it.",
    real: true,
    source: "CNN interview — May 2016"
  },

  // ── FAKE ─────────────────────────────────────────────────────
  {
    text: "I have never lost at chess. Not once in my life. Because I don't play chess — chess is for losers.",
    real: false
  },
  {
    text: "Sharks are actually a bigger threat to this country than terrorism. I've been saying this for years. Nobody listens.",
    real: false
  },
  {
    text: "I invented social media. Facebook, Twitter, all of it. My concept. Zuckerberg will tell you, if you ask him nicely.",
    real: false
  },
  {
    text: "My hair is completely natural. It just grows this way because I'm in perfect health. The best health.",
    real: false
  },
  {
    text: "I've read every book ever written. Every single one. Nobody reads more than me. Not even close.",
    real: false
  },
  {
    text: "The moon landing was a beautiful achievement, but I would have done it better and $2 billion under budget.",
    real: false
  },
  {
    text: "Coffee is for weak people. I drink only Diet Coke and it makes me ten times sharper than any coffee drinker.",
    real: false
  },
  {
    text: "I could cure cancer if I focused on it. I absolutely could. I just have more important things happening right now.",
    real: false
  },
  {
    text: "The Great Wall of China is a fantastic wall, but mine would have been taller. Much, much taller.",
    real: false
  },
  {
    text: "Nobody understands electricity better than me. Really, it's incredible. The best electricity, frankly.",
    real: false
  },
  {
    text: "My ancestors were Viking kings. Very powerful people. Very tough. I get my strength from them.",
    real: false
  },
  {
    text: "I don't need glasses. My eyesight is better than 20/20. Doctors have told me they've never seen anything like it.",
    real: false
  },
  {
    text: "Albert Einstein was a smart man. But in some areas — certain areas — I understand physics better than he did.",
    real: false
  },
  {
    text: "The pyramids were built by very talented real estate developers. Tremendous vision. I have a lot of respect for that.",
    real: false
  },
  {
    text: "I sleep three hours a night. Standing up. That's where all my energy comes from. Nobody talks about that.",
    real: false
  },
  {
    text: "Nobody knows more about wine than me — and I don't even drink. That's how smart I am about it.",
    real: false
  },
  {
    text: "Dolphins are very overrated animals. I've seen them up close. Not as impressive as people say. Sharks are smarter.",
    real: false
  },
  {
    text: "I could run a marathon tomorrow if I wanted to. And I'd win. World record pace. I just have other priorities.",
    real: false
  },
  {
    text: "Dogs are actually very disloyal animals. Very. I've had dogs. They always let you down in the end.",
    real: false
  },
  {
    text: "I've been to every country in the world. Every single one. I know these places better than their own leaders do.",
    real: false
  },
  {
    text: "The Eiffel Tower is a nice tower. But it's not as tall as Trump Tower. People never talk about that.",
    real: false
  },
  {
    text: "I arm-wrestled a Navy SEAL once. I won. He was very gracious about it. Asked me not to talk about it.",
    real: false
  },
  {
    text: "Penguins are extremely disloyal. I've watched the documentaries. They'll turn on you in a second.",
    real: false
  },
  {
    text: "I once held my breath underwater for six minutes. The Secret Service was very impressed. Very.",
    real: false
  },
  {
    text: "I invented the taco bowl. The one we make at Trump Tower Grill is the best in the world. Mexico knows it.",
    real: false
  },
  {
    text: "I've never paid for a meal in my life. People always want to pay for me. It's just something that happens.",
    real: false
  },
  {
    text: "I could speak twelve languages fluently if I wanted to. I choose not to. One language, done perfectly, is enough.",
    real: false
  },
];

// ── State ────────────────────────────────────────────────────
let currentQuote = null;

// ── DOM ──────────────────────────────────────────────────────
const quoteCard    = document.getElementById('quoteCard');
const quoteText    = document.getElementById('quoteText');
const choiceRow    = document.getElementById('choiceRow');
const resultArea   = document.getElementById('resultArea');
const verdictEl    = document.getElementById('verdict');
const revealTagEl  = document.getElementById('revealTag');
const sourceEl     = document.getElementById('source');

function nextQuote() {
  currentQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  quoteText.textContent = currentQuote.text;
  quoteCard.className = 'quote-card';
  choiceRow.classList.remove('hidden');
  resultArea.classList.add('hidden');
}

function guess(userSaysReal) {
  const correct = userSaysReal === currentQuote.real;

  quoteCard.classList.add(currentQuote.real ? 'real' : 'fake');
  choiceRow.classList.add('hidden');

  verdictEl.textContent  = correct ? '✓ Correct!' : '✗ Wrong!';
  verdictEl.className    = 'verdict ' + (correct ? 'correct' : 'wrong');
  revealTagEl.textContent = 'This was ' + (currentQuote.real ? 'REAL.' : 'MADE UP.');
  revealTagEl.className   = 'reveal-tag ' + (currentQuote.real ? 'real' : 'fake');

  if (currentQuote.real && currentQuote.source) {
    sourceEl.textContent = currentQuote.source;
    sourceEl.classList.remove('hidden');
  } else {
    sourceEl.classList.add('hidden');
  }

  resultArea.classList.remove('hidden');
}

// Wire controls via addEventListener (CSP-safe, unlike inline onclick).
document.getElementById('realBtn').addEventListener('click', () => guess(true));
document.getElementById('fakeBtn').addEventListener('click', () => guess(false));
document.getElementById('nextBtn').addEventListener('click', nextQuote);

nextQuote();
