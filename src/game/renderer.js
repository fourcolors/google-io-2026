// ==========================================================================
// GemmaQuest Canvas Renderer: Procedural Art, Particles, and Day-Night Cycle
// ==========================================================================

import { getTileAt, BIOMES } from './tilemap.js';

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Grid settings
    this.tileSize = 48; // Size of each tile in pixels
    
    // Day-Night Cycle (Time ranges from 0.0 to 1.0)
    this.timeOfDay = 0.25; // Start at morning/day
    this.timeScale = 0.0003; // Speed of cycle
    
    // Dynamic Particle System
    this.particles = [];
    this.maxParticles = 80;
    
    // Animations
    this.animTime = 0;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Disable smoothing to ensure crisp, retro pixel-art rendering
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.mozImageSmoothingEnabled = false;
    this.ctx.webkitImageSmoothingEnabled = false;
    this.ctx.msImageSmoothingEnabled = false;
  }

  // Draw the entire visible world
  render(camera, player, npcs) {
    this.animTime += 0.05;
    this.timeOfDay = (this.timeOfDay + this.timeScale) % 1.0;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    
    // Clear screen
    ctx.fillStyle = '#0a0813';
    ctx.fillRect(0, 0, cw, ch);

    // Calculate grid range visible to camera
    const scale = 1.0;
    const halfW = cw / 2;
    const halfH = ch / 2;
    
    const startX = Math.floor((camera.x - halfW) / this.tileSize) - 1;
    const endX = Math.ceil((camera.x + halfW) / this.tileSize) + 1;
    const startY = Math.floor((camera.y - halfH) / this.tileSize) - 1;
    const endY = Math.ceil((camera.y + halfH) / this.tileSize) + 1;

    // 1. Draw Terrain Tiles
    for (let gy = startY; gy <= endY; gy++) {
      for (let gx = startX; gx <= endX; gx++) {
        const tile = getTileAt(gx, gy);
        
        // Convert grid coords to screen pixels relative to camera
        const screenX = gx * this.tileSize - camera.x + halfW;
        const screenY = gy * this.tileSize - camera.y + halfH;
        
        this.drawProceduralTile(ctx, gx, gy, tile, screenX, screenY);
      }
    }

    // 2. Draw Procedural Props & Ruins
    for (let gy = startY; gy <= endY; gy++) {
      for (let gx = startX; gx <= endX; gx++) {
        const tile = getTileAt(gx, gy);
        const screenX = gx * this.tileSize - camera.x + halfW;
        const screenY = gy * this.tileSize - camera.y + halfH;
        
        this.drawProceduralProps(ctx, gx, gy, tile, screenX, screenY);
      }
    }

    // 3. Draw NPCs
    npcs.forEach(npc => {
      const screenX = npc.gridX * this.tileSize - camera.x + halfW;
      const screenY = npc.gridY * this.tileSize - camera.y + halfH;
      
      // Draw NPC if within screen bounds
      if (screenX > -this.tileSize && screenX < cw + this.tileSize &&
          screenY > -this.tileSize && screenY < ch + this.tileSize) {
        this.drawAnimatedCharacter(ctx, screenX, screenY, npc, npc.skinColor);
      }
    });

    // 4. Draw Player
    const playerScreenX = player.gridX * this.tileSize - camera.x + halfW;
    const playerScreenY = player.gridY * this.tileSize - camera.y + halfH;
    
    this.drawAnimatedCharacter(ctx, playerScreenX, playerScreenY, player, 0, true);

    // 5. Update and Draw Ambient Particles
    this.updateAndDrawParticles(ctx, camera, halfW, halfH);

    // 6. Draw Day-Night Cycle & Glowing Radial Lighting
    this.drawDayNightAndLighting(ctx, playerScreenX, playerScreenY, camera, halfW, halfH, startX, endX, startY, endY);
  }

  // Draw procedural pattern for tiles to avoid plain flat colors
  drawProceduralTile(ctx, gx, gy, tile, x, y) {
    ctx.fillStyle = tile.color;
    ctx.fillRect(x, y, this.tileSize, this.tileSize);

    // Add high-quality procedural pixel noise details per biome
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    
    // Deterministic offset based on coordinates
    const hash = Math.abs(Math.sin(gx * 32.12 + gy * 77.89) * 1000) % 1.0;
    
    if (tile.id === BIOMES.GRASSLAND.id) {
      // Grass strands
      if (hash > 0.6) {
        ctx.fillRect(x + 12, y + 16, 4, 8);
        ctx.fillRect(x + 16, y + 20, 4, 4);
      }
      if (hash > 0.8) {
        ctx.fillRect(x + 28, y + 28, 4, 8);
      }
    } 
    
    else if (tile.id === BIOMES.FOREST.id) {
      // Dark pine leaves
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(x + 8, y + 36, 32, 4);
    } 
    
    else if (tile.id === BIOMES.OCEAN.id || tile.id === BIOMES.DEEP_OCEAN.id) {
      // Animated ocean waves
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      const waveOffset = Math.sin(this.animTime + gx * 0.5) * 4;
      ctx.fillRect(x + 12 + waveOffset, y + 20, 16, 3);
      ctx.fillRect(x + 24 - waveOffset, y + 32, 12, 3);
    } 
    
    else if (tile.id === BIOMES.DESERT.id) {
      // Dunes
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(x + 4, y + 32, 40, 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x + 8, y + 28, 24, 4);
    }
  }

  // Draw procedural props like trees, rocks, ruins
  drawProceduralProps(ctx, gx, gy, tile, x, y) {
    const hash = Math.abs(Math.sin(gx * 81.33 + gy * 19.45) * 1000) % 1.0;

    // Grassland: Occasional Flowers
    if (tile.id === BIOMES.GRASSLAND.id && hash > 0.94) {
      ctx.fillStyle = hash > 0.97 ? varColor('--accent-pink') : varColor('--accent-gold');
      ctx.fillRect(x + 20, y + 20, 8, 8); // center
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 20, y + 16, 8, 4);
      ctx.fillRect(x + 20, y + 28, 8, 4);
      ctx.fillRect(x + 16, y + 20, 4, 8);
      ctx.fillRect(x + 28, y + 20, 4, 8);
    }

    // Forest: Pine Trees
    else if (tile.id === BIOMES.FOREST.id && hash > 0.7) {
      // Tree Trunk
      ctx.fillStyle = '#1e1105';
      ctx.fillRect(x + 20, y + 36, 8, 12);
      
      // Pine foliage (layered triangles)
      ctx.fillStyle = '#06130b';
      // Layer 1
      ctx.beginPath();
      ctx.moveTo(x + 24, y + 8);
      ctx.lineTo(x + 6, y + 28);
      ctx.lineTo(x + 42, y + 28);
      ctx.closePath();
      ctx.fill();
      
      // Layer 2
      ctx.fillStyle = '#0a1d11';
      ctx.beginPath();
      ctx.moveTo(x + 24, y + 16);
      ctx.lineTo(x + 10, y + 36);
      ctx.lineTo(x + 38, y + 36);
      ctx.closePath();
      ctx.fill();
    }

    // Ruins: Ancient Obelisks / Runes
    else if (tile.id === BIOMES.RUINS.id && hash > 0.8) {
      // Basalt Pillar
      ctx.fillStyle = '#13101a';
      ctx.fillRect(x + 12, y + 8, 24, 36);
      ctx.fillStyle = '#221b2b';
      ctx.fillRect(x + 16, y + 12, 16, 32);

      // Glowing Neon Rune (pulsing)
      const glow = Math.abs(Math.sin(this.animTime + hash * 10)) * 0.7 + 0.3;
      ctx.fillStyle = `rgba(0, 229, 255, ${glow})`;
      ctx.fillRect(x + 22, y + 18, 4, 12);
      ctx.fillRect(x + 18, y + 22, 12, 4);
    }
  }

  // Draw Cute retro-pixel style character
  drawAnimatedCharacter(ctx, x, y, charData, skinType = 0, isPlayer = false) {
    const ts = this.tileSize;
    
    // Bounce frame based on walking or breathing
    const isMoving = charData.isMoving;
    const frame = isMoving 
      ? Math.sin(this.animTime * 2.5) * 4 // Fast walking bounce
      : Math.sin(this.animTime * 0.8) * 1.5; // Slow breathing idle bounce

    // Legs offset
    const legOffset = isMoving ? Math.abs(Math.sin(this.animTime * 2.5)) * 6 : 0;

    // Shadows
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 24, y + 42, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 1. Draw Feet / Legs
    ctx.fillStyle = '#141221';
    ctx.fillRect(x + 14, y + 36 + (isMoving ? -legOffset + 4 : 0), 6, 8); // Left Leg
    ctx.fillRect(x + 28, y + 36 + (isMoving ? legOffset : 0), 6, 8); // Right Leg

    // 2. Draw Body / Cape
    if (isPlayer) {
      ctx.fillStyle = varColor('--accent-purple'); // Hero Cloak
    } else {
      // Color variations for NPCs based on skinType
      const colors = ['#b83030', '#305cb8', '#30b88d', '#d99723'];
      ctx.fillStyle = colors[skinType % colors.length];
    }
    ctx.fillRect(x + 12, y + 20 + frame, 24, 18); // Cloak / Torso
    
    // Chestpiece / Accents
    ctx.fillStyle = isPlayer ? varColor('--accent-cyan') : '#ffd700';
    ctx.fillRect(x + 20, y + 24 + frame, 8, 10);

    // 3. Draw Head / Helmet
    ctx.fillStyle = '#ebe5fc'; // Skin color
    ctx.fillRect(x + 16, y + 8 + frame, 16, 14); // Face
    
    // Hair/Helmet details
    ctx.fillStyle = isPlayer ? '#222222' : '#734e12';
    ctx.fillRect(x + 14, y + 6 + frame, 20, 6); // Crown/Cap

    // 4. Draw Eyes
    ctx.fillStyle = '#110c1c';
    ctx.fillRect(x + 18, y + 14 + frame, 3, 3); // Left Eye
    ctx.fillRect(x + 27, y + 14 + frame, 3, 3); // Right Eye

    // Glowing Knight Visor/Crown for Player
    if (isPlayer) {
      ctx.fillStyle = varColor('--accent-cyan');
      ctx.fillRect(x + 20, y + 15 + frame, 8, 1);
    }
  }

  // Draw Day-Night color overlays and dynamic campfires/ruin lightings
  drawDayNightAndLighting(ctx, px, py, camera, halfW, halfH, startX, endX, startY, endY) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    
    // Day-Night ambient light overlay color mapping
    // Dawn -> Day -> Dusk -> Night
    let lightColor = 'rgba(10, 8, 19, 0.0)';
    let lightOpacity = 0.0;
    
    const t = this.timeOfDay;
    if (t < 0.2) {
      // Dawn (Sunrise)
      lightOpacity = (1.0 - t / 0.2) * 0.45;
      lightColor = `rgba(182, 100, 247, ${lightOpacity})`; // purple hue
    } else if (t >= 0.2 && t < 0.55) {
      // Daytime (Clear)
      lightOpacity = 0.0;
    } else if (t >= 0.55 && t < 0.75) {
      // Dusk (Sunset)
      lightOpacity = ((t - 0.55) / 0.2) * 0.55;
      lightColor = `rgba(255, 80, 50, ${lightOpacity * 0.5})`; // warm orange
    } else {
      // Nighttime (Deep shadows)
      const fade = t < 0.9 ? (t - 0.75) / 0.15 : (1.0 - t) / 0.1;
      lightOpacity = fade * 0.75;
      lightColor = `rgba(8, 4, 28, ${lightOpacity})`; // midnight blue
    }

    if (lightOpacity <= 0) return;

    // Create night lighting mask using canvas offscreen/clipping operation
    ctx.save();
    
    // Set composite to draw dark ambient overlay
    ctx.fillStyle = lightColor;
    
    if (t < 0.75) {
      // Standard dusk/dawn overlay (flat atmospheric coloration)
      ctx.fillRect(0, 0, cw, ch);
    } else {
      // Deep night shadow with glowing local light sources!
      // Draw dark overlay everywhere, but cut out circular glowing zones (Player torch, ruins)
      
      // Draw ambient darkness
      ctx.fillRect(0, 0, cw, ch);
      
      // Blend lights back
      ctx.globalCompositeOperation = 'destination-out';
      
      // 1. Draw Player torchlight circular cutout
      const playerLightRad = 160 + Math.sin(this.animTime * 1.5) * 8; // pulsing
      const gradPlayer = ctx.createRadialGradient(px + 24, py + 24, 0, px + 24, py + 24, playerLightRad);
      gradPlayer.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      gradPlayer.addColorStop(0.3, 'rgba(255, 255, 255, 0.75)');
      gradPlayer.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      
      ctx.fillStyle = gradPlayer;
      ctx.beginPath();
      ctx.arc(px + 24, py + 24, playerLightRad, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw glowing ruins cutouts
      for (let gy = startY; gy <= endY; gy++) {
        for (let gx = startX; gx <= endX; gx++) {
          const tile = getTileAt(gx, gy);
          if (tile.id === BIOMES.RUINS.id) {
            const hash = Math.abs(Math.sin(gx * 81.33 + gy * 19.45) * 1000) % 1.0;
            if (hash > 0.8) {
              const rx = gx * this.tileSize - camera.x + halfW + 24;
              const ry = gy * this.tileSize - camera.y + halfH + 24;
              
              const ruinRad = 120 + Math.sin(this.animTime + hash * 5) * 10;
              const gradRuin = ctx.createRadialGradient(rx, ry, 0, rx, ry, ruinRad);
              gradRuin.addColorStop(0, 'rgba(0, 229, 255, 0.85)');
              gradRuin.addColorStop(0.4, 'rgba(0, 229, 255, 0.45)');
              gradRuin.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
              
              ctx.fillStyle = gradRuin;
              ctx.beginPath();
              ctx.arc(rx, ry, ruinRad, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }
    
    ctx.restore();
  }

  // Update and render leaf drifts and wind ember particles
  updateAndDrawParticles(ctx, camera, halfW, halfH) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    
    // Spawn ambient particles periodically
    if (this.particles.length < this.maxParticles && Math.random() < 0.15) {
      // Spawn slightly off-screen to slide in
      const side = Math.random() > 0.5;
      this.particles.push({
        x: camera.x + (side ? -halfW - 50 : Math.random() * cw - halfW),
        y: camera.y + (-halfH - 50 + Math.random() * ch),
        vx: 1.5 + Math.random() * 2.0, // blow east
        vy: 0.8 + Math.random() * 1.5, // drift south
        size: 3 + Math.floor(Math.random() * 4),
        color: Math.random() > 0.5 ? '#1a7534' : '#ffd700', // green leaf or gold speck
        life: 1.0,
        decay: 0.003 + Math.random() * 0.005
      });
    }

    // Update and draw particles
    this.particles = this.particles.filter(p => {
      // Update life
      p.life -= p.decay;
      if (p.life <= 0) return false;

      // Move particle
      p.x += p.vx;
      p.y += p.vy;

      // Get screen coords
      const screenX = p.x - camera.x + halfW;
      const screenY = p.y - camera.y + halfH;

      // Draw particle if inside canvas bounds
      if (screenX > -10 && screenX < cw + 10 && screenY > -10 && screenY < ch + 10) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(screenX, screenY, p.size, p.size);
      }

      return true;
    });

    ctx.globalAlpha = 1.0; // reset transparency
  }
}

// Utility to parse styling variables dynamically
function varColor(cssVarName) {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
}
