export interface TarotCard {
  id: number
  name: string
  arcana: 'major' | 'minor'
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles'
  keywords: string[]
  image: string
  meaning: {
    upright: string
    reversed: string
  }
}

export const majorArcana: TarotCard[] = [
  {
    id: 0,
    name: "The Fool",
    arcana: "major",
    keywords: ["beginnings", "innocence", "spontaneity", "free spirit"],
    image: "https://upload.wikimedia.org/wikipedia/commons/9/90/RWS_Tarot_00_Fool.jpg",
    meaning: {
      upright: "New beginnings, innocence, adventure, free spirit",
      reversed: "Recklessness, risk-taking, holding back"
    }
  },
  {
    id: 1,
    name: "The Magician",
    arcana: "major",
    keywords: ["manifestation", "resourcefulness", "power", "inspired action"],
    image: "https://upload.wikimedia.org/wikipedia/commons/d/de/RWS_Tarot_01_Magician.jpg",
    meaning: {
      upright: "Manifestation, resourcefulness, power, inspired action",
      reversed: "Manipulation, poor planning, untapped talents"
    }
  },
  {
    id: 2,
    name: "The High Priestess",
    arcana: "major",
    keywords: ["intuition", "mystery", "inner voice", "subconscious"],
    image: "https://upload.wikimedia.org/wikipedia/commons/8/88/RWS_Tarot_02_High_Priestess.jpg",
    meaning: {
      upright: "Intuition, sacred knowledge, divine feminine, the subconscious mind",
      reversed: "Secrets, disconnection from intuition, withdrawal"
    }
  },
  {
    id: 3,
    name: "The Empress",
    arcana: "major",
    keywords: ["femininity", "beauty", "nature", "abundance"],
    image: "https://upload.wikimedia.org/wikipedia/commons/d/d2/RWS_Tarot_03_Empress.jpg",
    meaning: {
      upright: "Femininity, beauty, nature, nurturing, abundance",
      reversed: "Creative block, dependence on others"
    }
  },
  {
    id: 4,
    name: "The Emperor",
    arcana: "major",
    keywords: ["authority", "structure", "control", "fatherhood"],
    image: "https://upload.wikimedia.org/wikipedia/commons/c/c3/RWS_Tarot_04_Emperor.jpg",
    meaning: {
      upright: "Authority, establishment, structure, a father figure",
      reversed: "Domination, excessive control, rigidity"
    }
  },
  {
    id: 5,
    name: "The Hierophant",
    arcana: "major",
    keywords: ["tradition", "conformity", "morality", "ethics"],
    image: "https://upload.wikimedia.org/wikipedia/commons/8/8d/RWS_Tarot_05_Hierophant.jpg",
    meaning: {
      upright: "Spiritual wisdom, tradition, conformity, morality",
      reversed: "Personal beliefs, freedom, challenging the status quo"
    }
  },
  {
    id: 6,
    name: "The Lovers",
    arcana: "major",
    keywords: ["love", "harmony", "relationships", "choices"],
    image: "https://upload.wikimedia.org/wikipedia/commons/3/3a/TheLovers.jpg",
    meaning: {
      upright: "Love, harmony, relationships, values alignment, choices",
      reversed: "Self-love, disharmony, imbalance, misalignment of values"
    }
  },
  {
    id: 7,
    name: "The Chariot",
    arcana: "major",
    keywords: ["control", "willpower", "success", "determination"],
    image: "https://upload.wikimedia.org/wikipedia/commons/9/9b/RWS_Tarot_07_Chariot.jpg",
    meaning: {
      upright: "Control, willpower, success, action, determination",
      reversed: "Self-discipline, opposition, lack of direction"
    }
  },
  {
    id: 8,
    name: "Strength",
    arcana: "major",
    keywords: ["strength", "courage", "patience", "influence"],
    image: "https://upload.wikimedia.org/wikipedia/commons/f/f5/RWS_Tarot_08_Strength.jpg",
    meaning: {
      upright: "Inner strength, bravery, compassion, focus",
      reversed: "Self-doubt, weakness, insecurity"
    }
  },
  {
    id: 9,
    name: "The Hermit",
    arcana: "major",
    keywords: ["soul-searching", "introspection", "inner guidance", "solitude"],
    image: "https://upload.wikimedia.org/wikipedia/commons/4/4d/RWS_Tarot_09_Hermit.jpg",
    meaning: {
      upright: "Soul-searching, introspection, being alone, inner guidance",
      reversed: "Isolation, loneliness, withdrawal"
    }
  },
  {
    id: 10,
    name: "Wheel of Fortune",
    arcana: "major",
    keywords: ["change", "cycles", "fate", "destiny"],
    image: "https://upload.wikimedia.org/wikipedia/commons/3/3c/RWS_Tarot_10_Wheel_of_Fortune.jpg",
    meaning: {
      upright: "Good luck, karma, life cycles, destiny, turning point",
      reversed: "Bad luck, resistance to change, breaking cycles"
    }
  },
  {
    id: 11,
    name: "Justice",
    arcana: "major",
    keywords: ["justice", "fairness", "truth", "law"],
    image: "https://upload.wikimedia.org/wikipedia/commons/e/e0/RWS_Tarot_11_Justice.jpg",
    meaning: {
      upright: "Justice, fairness, truth, cause and effect, law",
      reversed: "Unfairness, lack of accountability, dishonesty"
    }
  },
  {
    id: 12,
    name: "The Hanged Man",
    arcana: "major",
    keywords: ["pause", "surrender", "letting go", "new perspectives"],
    image: "https://upload.wikimedia.org/wikipedia/commons/2/2b/RWS_Tarot_12_Hanged_Man.jpg",
    meaning: {
      upright: "Pause, surrender, letting go, new perspectives",
      reversed: "Delays, resistance, stalling, indecision"
    }
  },
  {
    id: 13,
    name: "Death",
    arcana: "major",
    keywords: ["endings", "change", "transformation", "transition"],
    image: "https://upload.wikimedia.org/wikipedia/commons/d/d7/RWS_Tarot_13_Death.jpg",
    meaning: {
      upright: "Endings, change, transformation, transition",
      reversed: "Resistance to change, personal transformation, inner purging"
    }
  },
  {
    id: 14,
    name: "Temperance",
    arcana: "major",
    keywords: ["balance", "moderation", "patience", "purpose"],
    image: "https://upload.wikimedia.org/wikipedia/commons/f/f8/RWS_Tarot_14_Temperance.jpg",
    meaning: {
      upright: "Balance, moderation, patience, purpose",
      reversed: "Imbalance, excess, self-healing, re-alignment"
    }
  },
  {
    id: 15,
    name: "The Devil",
    arcana: "major",
    keywords: ["shadow self", "attachment", "addiction", "restriction"],
    image: "https://upload.wikimedia.org/wikipedia/commons/5/55/RWS_Tarot_15_Devil.jpg",
    meaning: {
      upright: "Shadow self, attachment, addiction, restriction, sexuality",
      reversed: "Releasing limiting beliefs, exploring dark thoughts, detachment"
    }
  },
  {
    id: 16,
    name: "The Tower",
    arcana: "major",
    keywords: ["sudden change", "upheaval", "chaos", "revelation"],
    image: "https://upload.wikimedia.org/wikipedia/commons/5/53/RWS_Tarot_16_Tower.jpg",
    meaning: {
      upright: "Sudden change, upheaval, chaos, revelation, awakening",
      reversed: "Personal transformation, fear of change, averting disaster"
    }
  },
  {
    id: 17,
    name: "The Star",
    arcana: "major",
    keywords: ["hope", "faith", "purpose", "renewal"],
    image: "https://upload.wikimedia.org/wikipedia/commons/d/db/RWS_Tarot_17_Star.jpg",
    meaning: {
      upright: "Hope, faith, purpose, renewal, spirituality",
      reversed: "Lack of faith, despair, self-trust, disconnection"
    }
  },
  {
    id: 18,
    name: "The Moon",
    arcana: "major",
    keywords: ["illusion", "fear", "anxiety", "subconscious"],
    image: "https://upload.wikimedia.org/wikipedia/commons/7/7f/RWS_Tarot_18_Moon.jpg",
    meaning: {
      upright: "Illusion, fear, anxiety, subconscious, intuition",
      reversed: "Release of fear, repressed emotion, inner confusion"
    }
  },
  {
    id: 19,
    name: "The Sun",
    arcana: "major",
    keywords: ["positivity", "fun", "warmth", "success"],
    image: "https://upload.wikimedia.org/wikipedia/commons/1/17/RWS_Tarot_19_Sun.jpg",
    meaning: {
      upright: "Positivity, fun, warmth, success, vitality",
      reversed: "Inner child, feeling down, overly optimistic"
    }
  },
  {
    id: 20,
    name: "Judgement",
    arcana: "major",
    keywords: ["judgement", "rebirth", "inner calling", "absolution"],
    image: "https://upload.wikimedia.org/wikipedia/commons/d/dd/RWS_Tarot_20_Judgement.jpg",
    meaning: {
      upright: "Judgement, rebirth, inner calling, absolution",
      reversed: "Self-doubt, inner critic, ignoring the call"
    }
  },
  {
    id: 21,
    name: "The World",
    arcana: "major",
    keywords: ["completion", "integration", "accomplishment", "travel"],
    image: "https://upload.wikimedia.org/wikipedia/commons/f/ff/RWS_Tarot_21_World.jpg",
    meaning: {
      upright: "Completion, integration, accomplishment, travel",
      reversed: "Seeking personal closure, short-cuts, delays"
    }
  }
]

export function getRandomCards(count: number = 3): TarotCard[] {
  const shuffled = [...majorArcana].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function getCardById(id: number): TarotCard | undefined {
  return majorArcana.find(card => card.id === id)
}
