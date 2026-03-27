'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { TarotCard as TarotCardType } from '@/lib/tarot-data'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TarotChatProps {
  cards: TarotCardType[]
  isActive: boolean
}

export function TarotChat({ cards, isActive }: TarotChatProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ 
      api: '/api/tarot',
      body: { cards }
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Auto-start reading when chat becomes active
  useEffect(() => {
    if (isActive && !hasInitialized.current && messages.length === 0) {
      hasInitialized.current = true
      sendMessage({ text: 'Please give me a reading based on these cards.' })
    }
  }, [isActive, messages.length, sendMessage])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  if (!isActive) return null

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 md:mt-12">
      <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border bg-secondary/30">
          <h3 className="font-sans text-base md:text-lg font-semibold text-primary">
            Your Reading
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Ask questions about your cards
          </p>
        </div>

        {/* Messages */}
        <div className="h-64 md:h-80 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 md:px-4 py-2 md:py-3 text-sm md:text-base",
                  message.role === 'user'
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-foreground"
                )}
              >
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return (
                      <p key={index} className="whitespace-pre-wrap leading-relaxed">
                        {part.text}
                      </p>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          ))}
          
          {isLoading && messages.length === 0 && (
            <div className="flex justify-start">
              <div className="bg-secondary/50 rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 md:p-4 border-t border-border bg-secondary/20">
          <div className="flex gap-2 md:gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your reading..."
              disabled={isLoading}
              className="flex-1 bg-input rounded-lg px-3 md:px-4 py-2 md:py-3 text-sm md:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 md:px-6"
            >
              {isLoading ? (
                <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
