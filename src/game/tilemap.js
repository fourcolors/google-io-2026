// ==========================================================================
// GemmaQuest Procedural Infinite Terrain and Biome System
// ==========================================================================

const SEED = 8888;

// Pseudo-random 2D Noise
function pseudoNoise2D(x, y, seed = SEED) {
  const sinVal = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return sinVal - Math.floor(sinVal);
}

// Bilinear smooth noise interpolation
function smoothNoise2D(x, y, seed = SEED) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const u = xf * xf * (3.0 - 2.0 * xf);
  const v = yf * yf * (3.0 - 2.0 * yf);

  const n00 = pseudoNoise2D(xi, yi, seed);
  const n10 = pseudoNoise2D(xi + 1, yi, seed);
  const n01 = pseudoNoise2D(xi, yi + 1, seed);
  const n11 = pseudoNoise2D(xi + 1, yi + 1, seed);

  const n0 = n00 * (1 - u) + n10 * u;
  const n1 = n01 * (1 - u) + n11 * u;

  return n0 * (1 - v) + n1 * v;
}

// Fractional Brownian Motion (FBm) for rich landscape details
export function fBmNoise2D(x, y, octaves = 3, seed = SEED) {
  let value = 0.0;
  let amplitude = 0.5;
  let frequency = 0.05; // Zoom scale for biomes
  let maxAmp = 0.0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise2D(x * frequency, y * frequency, seed);
    maxAmp += amplitude;
    amplitude *= 0.5;
    frequency *= 2.2;
  }
  return value / maxAmp;
}

// Available Biomes in the Realm
export const BIOMES = {
  DEEP_OCEAN: {
    id: 'deep_ocean',
    name: 'Abyssal Deep',
    color: '#080c25',
    walkable: false,
    lore: 'The dark water stretches endlessly, humming with the sound of cold tides.'
  },
  OCEAN: {
    id: 'ocean',
    name: 'Teal Coast',
    color: '#0e1f40',
    walkable: false,
    lore: 'Sunlight catches on the shallow blue tides. Cool sea mist rolls inland.'
  },
  BEACH: {
    id: 'beach',
    name: 'Gilded Shallows',
    color: '#3d3420',
    walkable: true,
    lore: 'Soft, sparkled sand crunches underfoot, wet from the nearby ocean tides.'
  },
  GRASSLAND: {
    id: 'grassland',
    name: 'Verdant Steppes',
    color: '#122e1b',
    walkable: true,
    lore: 'An endless field of emerald green grass blowing softly in the summer breeze.'
  },
  FOREST: {
    id: 'forest',
    name: 'Whispering Woods',
    color: '#0b1f13',
    walkable: true,
    lore: 'Tall, ancient pine trees block out the sun, whispering long-forgotten secrets.'
  },
  DESERT: {
    id: 'desert',
    name: 'Shimmering Sands',
    color: '#473d1f',
    walkable: true,
    lore: 'A scorched wasteland of gold dunes. Heat ripples dance across the horizon.'
  },
  RUINS: {
    id: 'ruins',
    name: 'Forgotten Spires',
    color: '#2b2633',
    walkable: true,
    lore: 'Crumbling basalt pillars rise from the soil, glowing with strange neon runes.'
  }
};

// Map noise values to biomes
export function getTileAt(x, y) {
  // Height map fBm
  const height = fBmNoise2D(x, y, 4, SEED);
  // Moisture map fBm (different seed)
  const moisture = fBmNoise2D(x + 500, y + 500, 3, SEED + 123);

  // Biome distribution logic
  if (height < 0.28) return BIOMES.DEEP_OCEAN;
  if (height < 0.38) return BIOMES.OCEAN;
  if (height < 0.44) return BIOMES.BEACH;

  // Ruins (rare basalt structures on dry mountains or high fields)
  if (height > 0.82 && moisture < 0.35) return BIOMES.RUINS;

  // Dry vs wet biomes
  if (moisture < 0.32) {
    return BIOMES.DESERT;
  } else if (moisture > 0.68) {
    return BIOMES.FOREST;
  } else {
    // Normal elevation fields
    return height > 0.65 ? BIOMES.FOREST : BIOMES.GRASSLAND;
  }
}

// Procedural NPC List
const NPC_NAMES = ['Eldrin', 'Lyra', 'Kaelen', 'Thorin', 'Zephyr', 'Seraphina', 'Valen', 'Gideon', 'Aria', 'Sylas'];
const NPC_TITLES = ['Alchemist', 'Hermit', 'Lost Knight', 'Chronomancer', 'Rune Smith', 'Old Seer', 'Spiritualist', 'Spellweaver'];
const NPC_BACKSTORIES = [
  'Seeking an ancient relic hidden within the ruins of the realm.',
  'Exiled from the floating citadel, researching local ecosystem energy.',
  'Guarding a mystical gateway that only opens under a cyan moon.',
  'Trapped in a time-loop and studying how movements affect spatial reality.',
  'Collecting glowing embers and stardust to forge a sword of light.'
];

// Check if an NPC is located at a coordinate
// NPCs are procedurally distributed across grasslands and beaches
export function getNPCAt(x, y) {
  // Ensure NPCs aren't spawned at the origin spawn zone
  if (Math.abs(x) < 3 && Math.abs(y) < 3) return null;

  const tile = getTileAt(x, y);
  if (!tile.walkable || tile.id === BIOMES.RUINS.id) return null;

  // Guarantees an NPC spawn right next to the player's starting position (-5,0) for seamless demo-day play
  const isDemoNpc = (x === -4 && y === 0);

  // Hash check for NPC spawning (roughly ~1.5% chance per grid cell)
  const spawnHash = pseudoNoise2D(x, y, SEED + 999);
  if (spawnHash > 0.985 || isDemoNpc) {
    // Determine details via coord hash
    const nameIndex = Math.floor(pseudoNoise2D(x, y, SEED + 1) * NPC_NAMES.length);
    const titleIndex = Math.floor(pseudoNoise2D(x, y, SEED + 2) * NPC_TITLES.length);
    const storyIndex = Math.floor(pseudoNoise2D(x, y, SEED + 3) * NPC_BACKSTORIES.length);
    
    // Choose sprite skin color (0-3)
    const skinColor = Math.floor(pseudoNoise2D(x, y, SEED + 4) * 4);

    return {
      name: NPC_NAMES[nameIndex],
      title: NPC_TITLES[titleIndex],
      backstory: NPC_BACKSTORIES[storyIndex],
      skinColor,
      gridX: x,
      gridY: y,
      tileType: tile.name
    };
  }
  return null;
}
