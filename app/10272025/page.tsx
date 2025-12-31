'use client';

import { useState } from 'react';
import Link from 'next/link';

const PREFIXES = [
  'Extreme', 'Underwater', 'Philosophical', 'Competitive', 'Silent',
  'Interpretive', 'Medieval', 'Quantum', 'Underground', 'Virtual',
  'Paranormal', 'Artisanal', 'Synchronized', 'Invisible', 'Time-Traveling',
  'Hyperactive', 'Miniature', 'Posthumous', 'Interdimensional', 'Psychic',
  'Nocturnal', 'Steampunk', 'Cyberpunk', 'Existential', 'Abstract',
  'Holographic', 'Microscopic', 'Telepathic', 'Robotic', 'Organic',
  'Subatomic', 'Cosmic', 'Reversed', 'Backwards', 'Sideways'
];

const ACTIVITIES = [
  'Knitting', 'Debate', 'Chess', 'Cooking', 'Photography',
  'Bird Watching', 'Poetry', 'Yoga', 'Gaming', 'Gardening',
  'Juggling', 'Origami', 'Karaoke', 'Stargazing', 'Meditation',
  'Napping', 'Procrastinating', 'Overthinking', 'Doodling', 'Humming',
  'Staring', 'Pacing', 'Collecting', 'Sorting', 'Rearranging',
  'Whispering', 'Dancing', 'Spinning', 'Floating', 'Contemplating',
  'Scribbling', 'Pondering', 'Wandering', 'Tinkering', 'Philosophizing'
];

const SUFFIXES = [
  'Society', 'League', 'Coalition', 'Enthusiasts', 'Alliance',
  'Brotherhood', 'Collective', 'Federation', 'Guild', 'Assembly',
  'Council', 'Syndicate', 'Order', 'Circle', 'Dynasty',
  'Consortium', 'Institute', 'Academy', 'Committee', 'Association',
  'Confederation', 'Union', 'Cooperative', 'Symposium', 'Caucus',
  'Movement', 'Cabal', 'Network', 'Foundation', 'Initiative',
  'Task Force', 'Think Tank', 'Collaborative', 'Conglomerate', 'Congregation'
];

const MEETING_TIMES = [
  'Every full moon', 'Tuesdays at 3:33 AM', 'When Mercury is in retrograde',
  'Every leap year', 'During solar eclipses', 'First snow of winter',
  'Only on prime-numbered days', 'When nobody expects it', 
  'Thursdays (but which Thursday?)', 'In an alternate timeline',
  'Between 2 and 3 AM (in the void)', 'On days ending in Y',
  'Whenever we remember', 'Only on blue moons', 'During commercial breaks',
  'When the WiFi goes down', 'At the stroke of midnight (±2 hours)',
  'Every other millennium', 'When pigs fly (we\'re still waiting)',
  'In the past (missed it)', 'Fridays at 4:20 PM', 'Never and always',
  'When the stars align (literally)', 'During awkward silences',
  'At undefined intervals', 'Sporadically at best', 'Eventually',
  'When the spirit moves us', 'In a parallel universe', 'Constantly (in theory)'
];

const DESCRIPTIONS = [
  'No experience necessary, existential dread provided',
  'Beginners welcome, reality optional',
  'Where legends are born and immediately forgotten',
  'Join us in questioning everything',
  'Side effects may include enlightenment',
  'Free snacks (snacks may be theoretical)',
  'We meet, we exist, we disperse',
  'Absolutely no idea what we\'re doing',
  'Your parents warned you about us',
  'Featured in zero publications',
  'Experts at being amateur',
  'Procrastination is our superpower',
  'We\'re not weird, we\'re limited edition',
  'Chaos coordinators since whenever',
  'Making things up as we go since day one',
  'Totally legitimate and not suspicious',
  'Trust us, we\'re professionals (citation needed)',
  'Results may vary (they will)',
  'Warning: May cause spontaneous confusion',
  'Side effects include: confusion, wonder, and snacks',
  'Now with 30% more chaos',
  'Scientifically unproven since forever',
  'We put the \'fun\' in \'dysfunctional\'',
  'Probably not a cult (probably)',
  'Achievement: Showed up',
  'Where mediocrity meets ambition',
  'Expectations: low. Vibes: immaculate',
  'Living proof that anything is possible (kind of)',
  'Certified by absolutely no one',
  'Your mom thinks we\'re cool'
];

export default function EasterEggGame() {
  const [spinning, setSpinning] = useState(false);
  const [club, setClub] = useState({
    prefix: PREFIXES[0],
    activity: ACTIVITIES[0],
    suffix: SUFFIXES[0],
    time: MEETING_TIMES[0],
    description: DESCRIPTIONS[0]
  });
  const [spins, setSpins] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [key, setKey] = useState(0);

  const generateClub = () => {
    setSpinning(true);
    setSpins(s => s + 1);
    
    let iterations = 0;
    const interval = setInterval(() => {
      setClub({
        prefix: PREFIXES[Math.floor(Math.random() * PREFIXES.length)],
        activity: ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)],
        suffix: SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)],
        time: MEETING_TIMES[Math.floor(Math.random() * MEETING_TIMES.length)],
        description: DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)]
      });
      
      iterations++;
      if (iterations > 20) {
        clearInterval(interval);
        setSpinning(false);
        setKey(k => k + 1);
        
        // Secret achievement after 10 spins
        if (spins + 1 >= 10 && !showSecret) {
          setShowSecret(true);
        }
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes flip {
          from {
            transform: rotateX(-90deg);
            opacity: 0;
          }
          to {
            transform: rotateX(0);
            opacity: 1;
          }
        }
        @keyframes rainbow {
          0% { border-color: #60a5fa; }
          25% { border-color: #a78bfa; }
          50% { border-color: #f472b6; }
          75% { border-color: #fb923c; }
          100% { border-color: #60a5fa; }
        }
        .animate-slide-down {
          animation: slideDown 0.4s ease-out;
        }
        .animate-scale-in {
          animation: scaleIn 0.3s ease-out 0.1s both;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out 0.3s both;
        }
        .animate-fade-in-late {
          animation: fadeIn 0.3s ease-out 0.6s both;
        }
        .animate-slide-up {
          animation: slideUp 0.4s ease-out both;
        }
        .animate-flip {
          animation: flip 0.3s ease-out both;
        }
        .animate-rainbow {
          animation: rainbow 3s linear infinite;
        }
      `}</style>
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        {/* Header - Similar to main site */}
        <div className="mb-6 sm:mb-8 animate-slide-down">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
            <span>🎰</span>
            <span>Club Generator 3000</span>
            <span>🎰</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center">
            Discover clubs that definitely don&apos;t exist... yet
          </p>
          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm">
              <span>Spins: {spins}</span>
              {spins >= 10 && <span className="text-lg">🏆</span>}
            </span>
          </div>
        </div>

        {/* Slot Machine - Styled like club cards but with flair */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-primary-200 dark:border-primary-800 p-6 sm:p-8 mb-6 animate-scale-in transition-colors">
          {/* Club Name Display */}
          <div className="bg-gradient-to-br from-primary-50 to-accent-blue/10 dark:from-gray-700 dark:to-primary-900/30 rounded-lg p-6 mb-6 min-h-[220px] flex flex-col justify-center border-2 animate-rainbow">
            <div key={key} className="text-center animate-flip">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                {club.prefix} {club.activity} {club.suffix}
              </h2>
              <div className="space-y-3">
                <p className="text-primary-700 dark:text-primary-300 text-lg font-medium">
                  📅 {club.time}
                </p>
                <p className="text-gray-600 dark:text-gray-400 italic text-sm sm:text-base">
                  &quot;{club.description}&quot;
                </p>
              </div>
            </div>
          </div>

          {/* Spin Button */}
          <button
            onClick={generateClub}
            disabled={spinning}
            className={`w-full py-3 sm:py-4 rounded-lg font-bold text-lg sm:text-xl transition-all transform ${
              spinning 
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-gray-700 dark:text-gray-300' 
                : 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95'
            }`}
          >
            {spinning ? '🎲 SPINNING... 🎲' : '🎰 GENERATE CLUB 🎰'}
          </button>
        </div>

        {/* Secret Achievement */}
        {showSecret && (
          <div className="bg-accent-orange/10 dark:bg-accent-orange/20 border-2 border-accent-orange rounded-lg p-6 mb-6 animate-slide-up">
            <h3 className="text-2xl font-bold text-accent-orange mb-2 text-center">
              🏆 Achievement Unlocked! 🏆
            </h3>
            <p className="text-gray-900 dark:text-white text-center font-medium">
              &quot;Club Enthusiast&quot; - You&apos;ve generated 10 clubs!
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm text-center mt-2">
              Maybe it&apos;s time to check out some <Link href="/" className="text-primary-600 dark:text-primary-400 underline hover:text-primary-700 dark:hover:text-primary-300">real clubs</Link>? 😄
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-600 dark:text-gray-400 animate-fade-in">
          <p className="mb-3 text-sm">
            This is totally a real feature and not an easter egg 👀
          </p>
          <Link 
            href="/" 
            className="inline-block text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline transition-colors"
          >
            ← Back to Carlmont Club Catalog
          </Link>
        </div>

        {/* Hint */}
        <div className="mt-6 text-center text-gray-400 dark:text-gray-600 text-xs animate-fade-in-late">
          <p>psst... try spinning 10 times 🤫</p>
        </div>
      </div>
    </div>
  );
}
