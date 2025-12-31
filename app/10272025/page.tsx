'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function EasterEggGame() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const colors = [
    { id: 0, name: 'Red', bg: 'bg-red-500', active: 'bg-red-300', dark: 'bg-red-700' },
    { id: 1, name: 'Blue', bg: 'bg-blue-500', active: 'bg-blue-300', dark: 'bg-blue-700' },
    { id: 2, name: 'Green', bg: 'bg-green-500', active: 'bg-green-300', dark: 'bg-green-700' },
    { id: 3, name: 'Yellow', bg: 'bg-yellow-500', active: 'bg-yellow-300', dark: 'bg-yellow-700' },
  ];

  useEffect(() => {
    const stored = localStorage.getItem('monty-memory-high-score');
    if (stored) setHighScore(parseInt(stored));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('monty-memory-high-score', score.toString());
    }
  }, [score, highScore]);

  const playSound = (frequency: number) => {
    if (typeof window === 'undefined') return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const frequencies = [329.63, 261.63, 392.00, 440.00]; // E4, C4, G4, A4

  const flashButton = async (buttonId: number) => {
    setActiveButton(buttonId);
    playSound(frequencies[buttonId]);
    await new Promise(resolve => setTimeout(resolve, 400));
    setActiveButton(null);
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  const playSequence = async (seq: number[]) => {
    setIsPlaying(true);
    setMessage('Watch the meeting schedule...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    for (const buttonId of seq) {
      await flashButton(buttonId);
    }
    
    setIsPlaying(false);
    setMessage('Your turn!');
  };

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setPlayerSequence([]);
    const firstMove = Math.floor(Math.random() * 4);
    const newSequence = [firstMove];
    setSequence(newSequence);
    playSequence(newSequence);
  };

  const handleButtonClick = async (buttonId: number) => {
    if (isPlaying || gameOver) return;

    await flashButton(buttonId);

    const newPlayerSequence = [...playerSequence, buttonId];
    setPlayerSequence(newPlayerSequence);

    // Check if the move is correct
    if (newPlayerSequence[newPlayerSequence.length - 1] !== sequence[newPlayerSequence.length - 1]) {
      setGameOver(true);
      setMessage('Oops! You missed a meeting!');
      playSound(100); // Error sound
      return;
    }

    // Check if player completed the sequence
    if (newPlayerSequence.length === sequence.length) {
      const newScore = score + 1;
      setScore(newScore);
      setMessage(`Perfect! Semester ${newScore + 1}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add new move to sequence
      const nextMove = Math.floor(Math.random() * 4);
      const newSequence = [...sequence, nextMove];
      setSequence(newSequence);
      setPlayerSequence([]);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      playSequence(newSequence);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 drop-shadow-lg">
            � Club President Training
          </h1>
          <p className="text-purple-200 text-lg">
            Every great club leader needs a sharp memory! Can you pass the test?
          </p>
        </div>

        {/* Score Display */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <div className="text-purple-200 text-sm uppercase tracking-wide">Score</div>
              <div className="text-4xl font-bold text-white">{score}</div>
            </div>
            <div className="h-12 w-px bg-white/20"></div>
            <div className="text-center flex-1">
              <div className="text-purple-200 text-sm uppercase tracking-wide">High Score</div>
              <div className="text-4xl font-bold text-yellow-300">{highScore}</div>
            </div>
          </div>
        </div>

        {/* Game Status Message */}
        {gameStarted && (
          <div className="text-center mb-6">
            <p className={`text-xl font-semibold ${gameOver ? 'text-red-300' : 'text-green-300'}`}>
              {message}
            </p>
          </div>
        )}

        {/* Game Board */}
        {!gameStarted ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 text-center border border-white/20">
            <div className="mb-6">
              <p className="text-white text-lg mb-4">
                Watch the meeting sequence, then repeat it!
              </p>
              <p className="text-purple-200">
                Each semester gets busier. How many club events can you remember?
              </p>
            </div>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xl font-bold rounded-xl hover:from-pink-600 hover:to-purple-600 transform hover:scale-105 transition-all shadow-lg"
            >
              Start Game
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {colors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => handleButtonClick(color.id)}
                  disabled={isPlaying || gameOver}
                  className={`
                    aspect-square rounded-2xl transition-all transform
                    ${activeButton === color.id ? color.active : color.bg}
                    ${isPlaying || gameOver ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl cursor-pointer active:scale-95'}
                    shadow-xl border-4 border-white/20
                  `}
                  aria-label={color.name}
                />
              ))}
            </div>

            {gameOver && (
              <div className="text-center space-y-4">
                <button
                  onClick={startGame}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all shadow-lg"
                >
                  Play Again
                </button>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="text-purple-300 hover:text-white transition-colors underline"
          >
            ← Back to MontyClub
          </Link>
        </div>
      </div>
    </div>
  );
}
