'use client';

import { useState } from 'react';
import Link from 'next/link';

const PREFIXES = [
  'Extreme', 'Underwater', 'Philosophical', 'Competitive', 'Silent',
  'Interpretive', 'Medieval', 'Quantum', 'Underground', 'Virtual',
  'Paranormal', 'Artisanal', 'Synchronized', 'Invisible', 'Time-Traveling'
];

const ACTIVITIES = [
  'Knitting', 'Debate', 'Chess', 'Cooking', 'Photography',
  'Bird Watching', 'Poetry', 'Yoga', 'Gaming', 'Gardening',
  'Juggling', 'Origami', 'Karaoke', 'Stargazing', 'Meditation'
];

const SUFFIXES = [
  'Society', 'League', 'Coalition', 'Enthusiasts', 'Alliance',
  'Brotherhood', 'Collective', 'Federation', 'Guild', 'Assembly',
  'Council', 'Syndicate', 'Order', 'Circle', 'Dynasty'
];

const MEETING_TIMES = [
  'Every full moon', 'Tuesdays at 3:33 AM', 'When Mercury is in retrograde',
  'Every leap year', 'During solar eclipses', 'First snow of winter',
  'Only on prime-numbered days', 'When nobody expects it', 
  'Thursdays (but which Thursday?)', 'In an alternate timeline'
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
  'Featured in zero publications'
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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 p-8">
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
            transform: scale(0.8);
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
        .animate-slide-down {
          animation: slideDown 0.6s ease-out;
        }
        .animate-scale-in {
          animation: scaleIn 0.6s ease-out 0.2s both;
        }
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out 0.5s both;
        }
        .animate-fade-in-late {
          animation: fadeIn 0.6s ease-out 1s both;
        }
        .animate-slide-up {
          animation: slideUp 0.6s ease-out both;
        }
        .animate-flip {
          animation: flip 0.3s ease-out both;
        }
      `}</style>
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-down">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
            🎰 Club Generator 3000 🎰
          </h1>
          <p className="text-white/90 text-lg">
            Discover clubs that definitely don&apos;t exist... yet
          </p>
          <div className="mt-2 text-white/70 text-sm">
            Spins: {spins} {spins >= 10 && '🏆'}
          </div>
        </div>

        {/* Slot Machine */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20 mb-8 animate-scale-in">
          {/* Club Name Display */}
          <div className="bg-gray-900/50 rounded-xl p-6 mb-6 min-h-[200px] flex flex-col justify-center">
            <div key={key} className="text-center animate-flip">
              <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
                {club.prefix} {club.activity} {club.suffix}
              </h2>
              <div className="space-y-2">
                <p className="text-yellow-300 text-lg">
                  📅 {club.time}
                </p>
                <p className="text-white/80 italic">
                  &quot;{club.description}&quot;
                </p>
              </div>
            </div>
          </div>

          {/* Spin Button */}
          <button
            onClick={generateClub}
            disabled={spinning}
            className={`w-full py-4 rounded-xl font-bold text-xl transition-all transform ${
              spinning 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
            } text-gray-900`}
          >
            {spinning ? '🎲 SPINNING... 🎲' : '🎰 GENERATE CLUB 🎰'}
          </button>
        </div>

        {/* Secret Achievement */}
        {showSecret && (
          <div className="bg-yellow-400/20 backdrop-blur-md rounded-xl p-6 mb-8 border-2 border-yellow-400 animate-slide-up">
            <h3 className="text-2xl font-bold text-yellow-300 mb-2 text-center">
              🏆 Achievement Unlocked! 🏆
            </h3>
            <p className="text-white text-center">
              &quot;Club Enthusiast&quot; - You&apos;ve generated 10 clubs!
            </p>
            <p className="text-white/70 text-sm text-center mt-2">
              Maybe it&apos;s time to check out some <Link href="/" className="underline hover:text-yellow-300">real clubs</Link>? 😄
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-white/70 animate-fade-in">
          <p className="mb-2">
            This is totally a real feature and not an easter egg 👀
          </p>
          <Link 
            href="/" 
            className="text-white hover:text-yellow-300 underline transition-colors"
          >
            ← Back to actual clubs
          </Link>
        </div>

        {/* Hint */}
        <div className="mt-8 text-center text-white/50 text-sm animate-fade-in-late">
          <p>psst... try spinning 10 times 🤫</p>
        </div>
      </div>
    </div>
  );
}
