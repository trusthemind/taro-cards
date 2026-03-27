#!/usr/bin/env node
// Run: node scripts/download-cards.mjs
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'public', 'cards')

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

const CARDS = [
  // Major Arcana
  { id: 'major-0',  file: 'RWS_Tarot_00_Fool.jpg' },
  { id: 'major-1',  file: 'RWS_Tarot_01_Magician.jpg' },
  { id: 'major-2',  file: 'RWS_Tarot_02_High_Priestess.jpg' },
  { id: 'major-3',  file: 'RWS_Tarot_03_Empress.jpg' },
  { id: 'major-4',  file: 'RWS_Tarot_04_Emperor.jpg' },
  { id: 'major-5',  file: 'RWS_Tarot_05_Hierophant.jpg' },
  { id: 'major-6',  file: 'TheLovers.jpg' },
  { id: 'major-7',  file: 'RWS_Tarot_07_Chariot.jpg' },
  { id: 'major-8',  file: 'RWS_Tarot_08_Strength.jpg' },
  { id: 'major-9',  file: 'RWS_Tarot_09_Hermit.jpg' },
  { id: 'major-10', file: 'RWS_Tarot_10_Wheel_of_Fortune.jpg' },
  { id: 'major-11', file: 'RWS_Tarot_11_Justice.jpg' },
  { id: 'major-12', file: 'RWS_Tarot_12_Hanged_Man.jpg' },
  { id: 'major-13', file: 'RWS_Tarot_13_Death.jpg' },
  { id: 'major-14', file: 'RWS_Tarot_14_Temperance.jpg' },
  { id: 'major-15', file: 'RWS_Tarot_15_Devil.jpg' },
  { id: 'major-16', file: 'RWS_Tarot_16_Tower.jpg' },
  { id: 'major-17', file: 'RWS_Tarot_17_Star.jpg' },
  { id: 'major-18', file: 'RWS_Tarot_18_Moon.jpg' },
  { id: 'major-19', file: 'RWS_Tarot_19_Sun.jpg' },
  { id: 'major-20', file: 'RWS_Tarot_20_Judgement.jpg' },
  { id: 'major-21', file: 'RWS_Tarot_21_World.jpg' },
  // Minor Arcana - Wands
  { id: 'wands-1',  file: 'Wands01.jpg' },
  { id: 'wands-2',  file: 'Wands02.jpg' },
  { id: 'wands-3',  file: 'Wands03.jpg' },
  { id: 'wands-4',  file: 'Wands04.jpg' },
  { id: 'wands-5',  file: 'Wands05.jpg' },
  { id: 'wands-6',  file: 'Wands06.jpg' },
  { id: 'wands-7',  file: 'Wands07.jpg' },
  { id: 'wands-8',  file: 'Wands08.jpg' },
  { id: 'wands-9',  file: 'RWS1909 - Wands 09.jpeg' },
  { id: 'wands-10', file: 'Wands10.jpg' },
  { id: 'wands-11', file: 'Wands11.jpg' },
  { id: 'wands-12', file: 'Wands12.jpg' },
  { id: 'wands-13', file: 'Wands13.jpg' },
  { id: 'wands-14', file: 'Wands14.jpg' },
  // Minor Arcana - Cups
  { id: 'cups-1',  file: 'Cups01.jpg' },
  { id: 'cups-2',  file: 'Cups02.jpg' },
  { id: 'cups-3',  file: 'Cups03.jpg' },
  { id: 'cups-4',  file: 'Cups04.jpg' },
  { id: 'cups-5',  file: 'Cups05.jpg' },
  { id: 'cups-6',  file: 'Cups06.jpg' },
  { id: 'cups-7',  file: 'Cups07.jpg' },
  { id: 'cups-8',  file: 'Cups08.jpg' },
  { id: 'cups-9',  file: 'Cups09.jpg' },
  { id: 'cups-10', file: 'Cups10.jpg' },
  { id: 'cups-11', file: 'Cups11.jpg' },
  { id: 'cups-12', file: 'Cups12.jpg' },
  { id: 'cups-13', file: 'Cups13.jpg' },
  { id: 'cups-14', file: 'Cups14.jpg' },
  // Minor Arcana - Swords
  { id: 'swords-1',  file: 'Swords01.jpg' },
  { id: 'swords-2',  file: 'Swords02.jpg' },
  { id: 'swords-3',  file: 'Swords03.jpg' },
  { id: 'swords-4',  file: 'Swords04.jpg' },
  { id: 'swords-5',  file: 'Swords05.jpg' },
  { id: 'swords-6',  file: 'Swords06.jpg' },
  { id: 'swords-7',  file: 'Swords07.jpg' },
  { id: 'swords-8',  file: 'Swords08.jpg' },
  { id: 'swords-9',  file: 'Swords09.jpg' },
  { id: 'swords-10', file: 'Swords10.jpg' },
  { id: 'swords-11', file: 'Swords11.jpg' },
  { id: 'swords-12', file: 'Swords12.jpg' },
  { id: 'swords-13', file: 'Swords13.jpg' },
  { id: 'swords-14', file: 'Swords14.jpg' },
  // Minor Arcana - Pentacles
  { id: 'pents-1',  file: 'Pents01.jpg' },
  { id: 'pents-2',  file: 'Pents02.jpg' },
  { id: 'pents-3',  file: 'Pents03.jpg' },
  { id: 'pents-4',  file: 'Pents04.jpg' },
  { id: 'pents-5',  file: 'Pents05.jpg' },
  { id: 'pents-6',  file: 'Pents06.jpg' },
  { id: 'pents-7',  file: 'Pents07.jpg' },
  { id: 'pents-8',  file: 'Pents08.jpg' },
  { id: 'pents-9',  file: 'Pents09.jpg' },
  { id: 'pents-10', file: 'Pents10.jpg' },
  { id: 'pents-11', file: 'Pents11.jpg' },
  { id: 'pents-12', file: 'Pents12.jpg' },
  { id: 'pents-13', file: 'Pents13.jpg' },
  { id: 'pents-14', file: 'Pents14.jpg' },
]

async function getDirectUrl(filename) {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json`
  try {
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'TarotApp/1.0 (educational project; nodejs)' },
    })
    const data = await res.json()
    const pages = data?.query?.pages
    if (!pages) return null
    const page = Object.values(pages)[0]
    return page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url ?? null
  } catch {
    return null
  }
}

async function downloadImage(id, filename) {
  const outputPath = join(OUTPUT_DIR, `${id}.jpg`)

  if (existsSync(outputPath)) {
    console.log(`⏭  Skipping ${id} (already exists)`)
    return true
  }

  try {
    // Get direct CDN URL via API
    const directUrl = await getDirectUrl(filename)
    if (!directUrl) throw new Error('No URL from API')

    const res = await fetch(directUrl, {
      headers: { 'User-Agent': 'TarotApp/1.0 (educational project; nodejs)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    writeFileSync(outputPath, buffer)
    console.log(`✅ Downloaded ${id} (${buffer.length} bytes)`)
    return true
  } catch (err) {
    console.error(`❌ Failed ${id}: ${err.message}`)
    return false
  }
}

async function main() {
  console.log(`📂 Output: ${OUTPUT_DIR}`)
  console.log(`🃏 Downloading ${CARDS.length} tarot cards...\n`)

  // Download sequentially with delay to avoid rate limiting
  let ok = 0, fail = 0
  for (let i = 0; i < CARDS.length; i++) {
    const card = CARDS[i]
    const outputPath = join(OUTPUT_DIR, `${card.id}.jpg`)
    const alreadyExists = existsSync(outputPath)
    const success = await downloadImage(card.id, card.file)
    if (success) ok++; else fail++
    // 5s delay only when actually downloading (not skipping)
    if (!alreadyExists && i < CARDS.length - 1) await new Promise(r => setTimeout(r, 5000))
  }

  console.log(`\n🎴 Done! ${ok} downloaded, ${fail} failed`)
}

main().catch(console.error)
