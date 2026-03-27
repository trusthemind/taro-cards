'use client'

import { useState, useEffect } from 'react'
import { getRandomCards, TarotCard as TarotCardType } from '@/lib/tarot-data'
import { CardSpread } from './card-spread'
import { TarotChat } from './tarot-chat'
import { Button } from '@/components/ui/button'

export function TarotReading() {
  const [cards, setCards] = useState<TarotCardType[]>([])
  const [revealedCards, setRevealedCards] = useState<number[]>([])
  const [readingStarted, setReadingStarted] = useState(false)
  const [isShuffling, setIsShuffling] = useState(false)

  const handleStartReading = () => {
    setIsShuffling(true)
    // Shuffle animation
    setTimeout(() => {
      setCards(getRandomCards(3))
      setRevealedCards([])
      setReadingStarted(true)
      setIsShuffling(false)
    }, 1500)
  }

  const handleCardReveal = (index: number) => {
    if (!revealedCards.includes(index)) {
      setRevealedCards([...revealedCards, index])
    }
  }

  const handleNewReading = () => {
    setReadingStarted(false)
    setCards([])
    setRevealedCards([])
  }

  const allCardsRevealed = revealedCards.length === cards.length && cards.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="text-center pt-8 md:pt-12 pb-6 md:pb-8 px-4">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-primary/30 mb-4">
            <svg
              className="w-6 h-6 md:w-8 md:h-8 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
        </div>
        <h1 className="font-sans text-3xl md:text-5xl font-bold text-foreground mb-2 md:mb-3 tracking-tight">
          Mystic <span className="text-primary">Tarot</span>
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-md mx-auto leading-relaxed">
          Discover your path through the ancient wisdom of the cards
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pb-12">
        {!readingStarted ? (
          <div className="flex flex-col items-center gap-8 mt-8 md:mt-12">
            {/* Decorative Cards Preview */}
            <div className="relative w-48 h-64 md:w-56 md:h-72">
              <div 
                className={`absolute inset-0 bg-gradient-to-br from-secondary via-card to-secondary rounded-xl border-2 border-primary/30 shadow-lg shadow-primary/10 transform -rotate-12 transition-transform duration-500 ${isShuffling ? 'animate-shuffle-1' : ''}`}
              />
              <div 
                className={`absolute inset-0 bg-gradient-to-br from-secondary via-card to-secondary rounded-xl border-2 border-primary/30 shadow-lg shadow-primary/10 transform rotate-0 transition-transform duration-500 ${isShuffling ? 'animate-shuffle-2' : ''}`}
              />
              <div 
                className={`absolute inset-0 bg-gradient-to-br from-secondary via-card to-secondary rounded-xl border-2 border-primary/30 shadow-lg shadow-primary/10 transform rotate-12 transition-transform duration-500 ${isShuffling ? 'animate-shuffle-3' : ''}`}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <svg
                    className="w-16 h-16 md:w-20 md:h-20 text-primary/50"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1" />
                    <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="1" />
                    <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="1" />
                    <path d="M50 5 L50 95" stroke="currentColor" strokeWidth="1" />
                    <path d="M5 50 L95 50" stroke="currentColor" strokeWidth="1" />
                    <circle cx="50" cy="50" r="8" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <p className="text-muted-foreground text-sm md:text-base">
                Three-card spread: Past, Present, Future
              </p>
              <Button
                onClick={handleStartReading}
                disabled={isShuffling}
                size="lg"
                className="px-8 py-6 text-base md:text-lg font-sans"
              >
                {isShuffling ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Shuffling...
                  </>
                ) : (
                  'Draw Your Cards'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl space-y-8">
            <CardSpread
              cards={cards}
              revealedCards={revealedCards}
              onCardReveal={handleCardReveal}
            />

            {allCardsRevealed && (
              <div className="animate-fade-in">
                <TarotChat cards={cards} isActive={allCardsRevealed} />
              </div>
            )}

            <div className="flex justify-center pt-4">
              <Button
                onClick={handleNewReading}
                variant="outline"
                className="border-primary/30 hover:border-primary/50"
              >
                Start New Reading
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 px-4 border-t border-border/50">
        <p className="text-xs md:text-sm text-muted-foreground">
          AI-powered readings using the Rider-Waite-Smith tarot deck
        </p>
      </footer>
    </div>
  )
}
