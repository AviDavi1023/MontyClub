'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

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
        
        // Secret achievement after 10 spins
        if (spins + 1 >= 10 && !showSecret) {
          setShowSecret(true);
        }
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
            🎰 Club Generator 3000 🎰
          </h1>
          <p className="text-white/90 text-lg">
            Discover clubs that definitely don&apos;t exist... yet
          </p>
          <div className="mt-2 text-white/70 text-sm">
            Spins: {spins} {spins >= 10 && '🏆'}
          </div>
        </motion.div>

        {/* Slot Machine */}
        <motion.div 
          className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20 mb-8"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* Club Name Display */}
          <div className="bg-gray-900/50 rounded-xl p-6 mb-6 min-h-[200px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${club.prefix}-${club.activity}-${club.suffix}`}
                initial={{ rotateX: 90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                exit={{ rotateX: -90, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
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
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Spin Button */}
          <motion.button
            onClick={generateClub}
            disabled={spinning}
            className={`w-full py-4 rounded-xl font-bold text-xl transition-all ${
              spinning 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 shadow-lg hover:shadow-xl'
            } text-gray-900`}
            whileHover={!spinning ? { scale: 1.05 } : {}}
            whileTap={!spinning ? { scale: 0.95 } : {}}
          >
            {spinning ? '🎲 SPINNING... 🎲' : '🎰 GENERATE CLUB 🎰'}
          </motion.button>
        </motion.div>

        {/* Secret Achievement */}
        <AnimatePresence>
          {showSecret && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-yellow-400/20 backdrop-blur-md rounded-xl p-6 mb-8 border-2 border-yellow-400"
            >
              <h3 className="text-2xl font-bold text-yellow-300 mb-2 text-center">
                🏆 Achievement Unlocked! 🏆
              </h3>
              <p className="text-white text-center">
                &quot;Club Enthusiast&quot; - You&apos;ve generated 10 clubs!
              </p>
              <p className="text-white/70 text-sm text-center mt-2">
                Maybe it&apos;s time to check out some <Link href="/" className="underline hover:text-yellow-300">real clubs</Link>? 😄
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.div 
          className="text-center text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="mb-2">
            This is totally a real feature and not an easter egg 👀
          </p>
          <Link 
            href="/" 
            className="text-white hover:text-yellow-300 underline transition-colors"
          >
            ← Back to actual clubs
          </Link>
        </motion.div>

        {/* Hint */}
        <motion.div
          className="mt-8 text-center text-white/50 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p>psst... try spinning 10 times 🤫</p>
        </motion.div>
      </div>
    </div>
  );
}
