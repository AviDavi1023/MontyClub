'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface Club {
  name: string
  category: string
  description: string
  meetingFrequency: string
}

const CLUB_PUZZLES: Club[] = [
  {
    name: "Debate Club",
    category: "Academic & Competition",
    description: "Sharpen your argumentation skills and compete in tournaments",
    meetingFrequency: "Weekly"
  },
  {
    name: "Robotics Club",
    category: "STEM",
    description: "Build, program, and compete with robots",
    meetingFrequency: "Twice a week"
  },
  {
    name: "Drama Club",
    category: "Arts & Performance",
    description: "Act, direct, and produce theatrical performances",
    meetingFrequency: "Daily during production"
  },
  {
    name: "Chess Club",
    category: "Games & Recreation",
    description: "Master strategy and compete in chess tournaments",
    meetingFrequency: "Weekly"
  },
  {
    name: "Environmental Club",
    category: "Service & Advocacy",
    description: "Promote sustainability and organize eco-friendly initiatives",
    meetingFrequency: "Biweekly"
  },
  {
    name: "Coding Club",
    category: "STEM",
    description: "Learn programming languages and build software projects",
    meetingFrequency: "Weekly"
  },
]

export default function ClublePage() {
  const [currentClub, setCurrentClub] = useState<Club | null>(null)
  const [currentHint, setCurrentHint] = useState(0)
  const [guess, setGuess] = useState('')
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing')
  const [score, setScore] = useState(0)
  const [attempts, setAttempts] = useState<string[]>([])
  const [shake, setShake] = useState(false)

  useEffect(() => {
    // Pick a random club on load
    const randomClub = CLUB_PUZZLES[Math.floor(Math.random() * CLUB_PUZZLES.length)]
    setCurrentClub(randomClub)
  }, [])

  const hints = currentClub ? [
    `📅 Meeting Frequency: ${currentClub.meetingFrequency}`,
    `🏷️ Category: ${currentClub.category}`,
    `📝 Description: ${currentClub.description}`,
    `🎯 First Letter: ${currentClub.name[0]}`,
    `💡 Contains "${currentClub.name.split(' ')[0].substring(0, 3)}..."`,
  ] : []

  const handleGuess = () => {
    if (!currentClub || !guess.trim()) return

    const normalizedGuess = guess.trim().toLowerCase()
    const normalizedAnswer = currentClub.name.toLowerCase()

    setAttempts([...attempts, guess.trim()])

    if (normalizedGuess === normalizedAnswer) {
      setGameState('won')
      const points = Math.max(100 - (currentHint * 15) - (attempts.length * 10), 10)
      setScore(score + points)
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 500)

      if (currentHint < hints.length - 1) {
        setCurrentHint(currentHint + 1)
      } else {
        setGameState('lost')
      }
    }

    setGuess('')
  }

  const nextClub = () => {
    const availableClubs = CLUB_PUZZLES.filter(c => c.name !== currentClub?.name)
    const randomClub = availableClubs[Math.floor(Math.random() * availableClubs.length)]
    setCurrentClub(randomClub)
    setCurrentHint(0)
    setGuess('')
    setGameState('playing')
    setAttempts([])
  }

  const restartGame = () => {
    const randomClub = CLUB_PUZZLES[Math.floor(Math.random() * CLUB_PUZZLES.length)]
    setCurrentClub(randomClub)
    setCurrentHint(0)
    setGuess('')
    setGameState('playing')
    setAttempts([])
    setScore(0)
  }

  if (!currentClub) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
      <div className="text-white text-2xl">Loading...</div>
    </div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-8 max-w-2xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            🎭 CLUBLE
          </h1>
          <p className="text-gray-600 text-sm">
            Guess the club based on hints! Fewer hints = more points
          </p>
          <div className="mt-3 flex justify-center gap-4 text-sm">
            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">
              🏆 Score: {score}
            </span>
            <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full font-semibold">
              💡 Hint {currentHint + 1}/{hints.length}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {gameState === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Hints */}
              <div className="space-y-3 mb-6">
                {hints.slice(0, currentHint + 1).map((hint, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200"
                  >
                    <p className="text-gray-800 font-medium">{hint}</p>
                  </motion.div>
                ))}
              </div>

              {/* Previous Attempts */}
              {attempts.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Previous guesses:</p>
                  <div className="flex flex-wrap gap-2">
                    {attempts.map((attempt, i) => (
                      <span
                        key={i}
                        className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm line-through"
                      >
                        {attempt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <motion.div
                animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                  placeholder="Type your guess..."
                  className="w-full px-6 py-4 text-lg border-2 border-purple-300 rounded-xl focus:ring-4 focus:ring-purple-200 focus:border-purple-500 outline-none transition-all"
                  autoFocus
                />
              </motion.div>

              <button
                onClick={handleGuess}
                disabled={!guess.trim()}
                className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Guess
              </button>
            </motion.div>
          )}

          {gameState === 'won' && (
            <motion.div
              key="won"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: 3, duration: 0.5 }}
                className="text-8xl mb-4"
              >
                🎉
              </motion.div>
              <h2 className="text-4xl font-bold text-green-600 mb-2">Correct!</h2>
              <p className="text-2xl text-gray-700 mb-4">
                It was <span className="font-bold text-purple-600">{currentClub.name}</span>!
              </p>
              <p className="text-gray-600 mb-8">
                You earned {Math.max(100 - (currentHint * 15) - (attempts.length * 10), 10)} points!
              </p>
              <button
                onClick={nextClub}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all"
              >
                Next Club 🎯
              </button>
            </motion.div>
          )}

          {gameState === 'lost' && (
            <motion.div
              key="lost"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12"
            >
              <div className="text-8xl mb-4">😅</div>
              <h2 className="text-4xl font-bold text-orange-600 mb-2">Nice Try!</h2>
              <p className="text-2xl text-gray-700 mb-8">
                The answer was <span className="font-bold text-purple-600">{currentClub.name}</span>
              </p>
              <button
                onClick={nextClub}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all"
              >
                Try Another 🎯
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Actions */}
        <div className="mt-8 pt-6 border-t-2 border-gray-200 flex justify-between items-center">
          <Link
            href="/"
            className="text-gray-600 hover:text-purple-600 font-medium transition-colors"
          >
            ← Back to Clubs
          </Link>
          <button
            onClick={restartGame}
            className="text-gray-600 hover:text-pink-600 font-medium transition-colors"
          >
            🔄 Restart Game
          </button>
        </div>
      </motion.div>
    </div>
  )
}
