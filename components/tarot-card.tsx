'use client'

import { useState } from 'react'
import { TarotCard as TarotCardType } from '@/lib/tarot-data'
import { cn } from '@/lib/utils'

interface TarotCardProps {
  card: TarotCardType
  isRevealed?: boolean
  isSelected?: boolean
  onClick?: () => void
  delay?: number
}

export function TarotCard({ 
  card, 
  isRevealed = false, 
  isSelected = false,
  onClick,
  delay = 0 
}: TarotCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const handleClick = () => {
    if (!isRevealed) {
      setIsFlipped(true)
      setTimeout(() => {
        onClick?.()
      }, 300)
    }
  }

  return (
    <div
      className={cn(
        "relative w-40 h-64 md:w-48 md:h-80 cursor-pointer perspective-1000 transition-all duration-500",
        isSelected && "scale-105 z-10",
        !isRevealed && "hover:scale-105 hover:-translate-y-2"
      )}
      style={{ animationDelay: `${delay}ms` }}
      onClick={handleClick}
    >
      <div
        className={cn(
          "relative w-full h-full transition-transform duration-700 transform-style-preserve-3d",
          (isFlipped || isRevealed) && "rotate-y-180"
        )}
      >
        {/* Card Back */}
        <div className="absolute inset-0 backface-hidden rounded-xl overflow-hidden border-2 border-primary/50 shadow-lg shadow-primary/20">
          <div className="w-full h-full bg-gradient-to-br from-secondary via-card to-secondary flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Decorative pattern */}
              <div className="absolute inset-4 border border-primary/30 rounded-lg" />
              <div className="absolute inset-6 border border-primary/20 rounded-lg" />
              <div className="absolute inset-8 border border-primary/10 rounded-lg" />
              
              {/* Center symbol */}
              <div className="relative z-10 text-primary">
                <svg
                  className="w-16 h-16 md:w-20 md:h-20"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="1" />
                  <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="1" />
                  <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="1" />
                  <path d="M50 5 L50 95" stroke="currentColor" strokeWidth="1" />
                  <path d="M5 50 L95 50" stroke="currentColor" strokeWidth="1" />
                  <path d="M18 18 L82 82" stroke="currentColor" strokeWidth="1" />
                  <path d="M82 18 L18 82" stroke="currentColor" strokeWidth="1" />
                  <circle cx="50" cy="50" r="8" fill="currentColor" />
                </svg>
              </div>
              
              {/* Corner decorations */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t border-l border-primary/40" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t border-r border-primary/40" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-primary/40" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-primary/40" />
            </div>
          </div>
        </div>

        {/* Card Front */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl overflow-hidden border-2 border-primary/50 shadow-lg shadow-primary/20 bg-card">
          <div className="relative w-full h-full flex flex-col">
            {/* Card Image */}
            <div className="relative flex-1 overflow-hidden bg-muted">
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <img
                src={card.image}
                alt={card.name}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
                crossOrigin="anonymous"
              />
            </div>
            
            {/* Card Name */}
            <div className="p-2 md:p-3 text-center bg-gradient-to-t from-card via-card to-transparent">
              <h3 className="font-sans text-sm md:text-base font-semibold text-primary truncate">
                {card.name}
              </h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
