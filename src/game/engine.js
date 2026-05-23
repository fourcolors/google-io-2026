// ==========================================================================
// GemmaQuest Game Engine: Input Handling, Collisions, and Event Dispatching
// ==========================================================================

import { getTileAt, getNPCAt, BIOMES } from './tilemap.js';

export class GameEngine {
  constructor(renderer, onEvent) {
    this.renderer = renderer;
    this.onEvent = onEvent; // Callback for reporting game events (biome changed, met NPC)

    // Player position (Tile aligned)
    this.player = {
      gridX: -5,
      gridY: 0,
      targetGridX: -5,
      targetGridY: 0,
      moveProgress: 0,
      moveSpeed: 0.08, // Smoothness rate per frame
      isMoving: false,
      direction: 'down',
      currentBiome: null
    };

    // Smooth Camera Coordinates
    this.camera = {
      x: 0,
      y: 0,
      ease: 0.1
    };

    // Discovered NPCs cache (indexed by 'x,y' coords)
    this.discoveredNPCs = {};

    // Keys state
    this.keys = {};
    
    // Active conversation target
    this.activeNPC = null;

    this.initInputs();
  }

  initInputs() {
    window.addEventListener('keydown', (e) => {
      // Escape key to close active dialogue even if the chat input is focused!
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (this.activeNPC) {
          this.closeDialog();
        }
        return;
      }

      // Don't steal keys or prevent default behaviors while typing in a text input or textarea
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      
      const keyLower = e.key.toLowerCase();
      this.keys[keyLower] = true;
      
      // Prevent default scrolling for Space and Arrow keys during gameplay
      if ([' ', 'space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'up', 'down', 'left', 'right'].includes(keyLower) || e.code === 'Space') {
        e.preventDefault();
      }
      
      // Space to trigger NPC dialogue
      if (e.key === ' ' || e.code === 'Space') {
        this.interact();
      }
    });

    window.addEventListener('keyup', (e) => {
      // Always register keyup events to prevent keys from getting stuck when focus shifts
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  // Check collision for grid coordinate
  isWalkable(gx, gy) {
    const tile = getTileAt(gx, gy);
    
    // Check if tile is walkable
    if (!tile.walkable) return false;
    
    // Check if an NPC is blocking that coordinate
    const npcKey = `${gx},${gy}`;
    if (this.discoveredNPCs[npcKey] || getNPCAt(gx, gy)) {
      return false;
    }
    
    return true;
  }

  // Interaction logic (Triggered by Space)
  interact() {
    // If already in dialog, do nothing
    if (this.activeNPC) return;

    // Check surrounding 4 tiles for an NPC
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 0, y: 1 },  // Down
      { x: -1, y: 0 }, // Left
      { x: 1, y: 0 }   // Right
    ];

    for (const dir of directions) {
      const tx = this.player.gridX + dir.x;
      const ty = this.player.gridY + dir.y;
      
      const key = `${tx},${ty}`;
      let npc = this.discoveredNPCs[key];
      
      if (!npc) {
        npc = getNPCAt(tx, ty);
        if (npc) {
          this.discoveredNPCs[key] = npc;
        }
      }

      if (npc) {
        this.activeNPC = npc;
        this.player.isMoving = false;
        this.keys = {}; // Clear keys to prevent movement lock when dialogue focuses chat input
        
        // Dispatch dialog event
        this.onEvent('npc_talk', npc);
        break;
      }
    }
  }

  // Main frame update loop (60 FPS)
  update() {
    this.handleMovement();
    this.updateCamera();
    this.discoverNPCsNearby();
  }

  // Smooth movement transition logic
  handleMovement() {
    const p = this.player;

    if (p.isMoving) {
      p.moveProgress += p.moveSpeed;
      
      if (p.moveProgress >= 1.0) {
        // Tile arrival
        p.gridX = p.targetGridX;
        p.gridY = p.targetGridY;
        p.moveProgress = 0;
        p.isMoving = false;
        
        // Biome changed detection
        this.checkBiomeChange();
      }
    }

    // Stop movement inputs if in a conversation
    if (this.activeNPC) return;

    if (!p.isMoving) {
      let dx = 0;
      let dy = 0;

      if (this.keys['w'] || this.keys['arrowup'] || this.keys['up']) {
        dy = -1;
        p.direction = 'up';
      } else if (this.keys['s'] || this.keys['arrowdown'] || this.keys['down']) {
        dy = 1;
        p.direction = 'down';
      } else if (this.keys['a'] || this.keys['arrowleft'] || this.keys['left']) {
        dx = -1;
        p.direction = 'left';
      } else if (this.keys['d'] || this.keys['arrowright'] || this.keys['right']) {
        dx = 1;
        p.direction = 'right';
      }

      if (dx !== 0 || dy !== 0) {
        const nextX = p.gridX + dx;
        const nextY = p.gridY + dy;

        if (this.isWalkable(nextX, nextY)) {
          p.targetGridX = nextX;
          p.targetGridY = nextY;
          p.moveProgress = 0;
          p.isMoving = true;
          
          this.onEvent('walk'); // Trigger walking audio synthetics
        }
      }
    }
  }

  checkBiomeChange() {
    const p = this.player;
    const tile = getTileAt(p.gridX, p.gridY);
    
    if (!p.currentBiome || p.currentBiome.id !== tile.id) {
      p.currentBiome = tile;
      this.onEvent('biome_discover', {
        gridX: p.gridX,
        gridY: p.gridY,
        biome: tile
      });
    }
  }

  // Smooth camera following
  updateCamera() {
    const p = this.player;
    const ts = this.renderer.tileSize;
    
    // Exact player pixel coordinate
    const playerPixelX = (p.gridX + (p.targetGridX - p.gridX) * p.moveProgress) * ts;
    const playerPixelY = (p.gridY + (p.targetGridY - p.gridY) * p.moveProgress) * ts;

    // Soft camera lerp
    this.camera.x += (playerPixelX - this.camera.x) * this.camera.ease;
    this.camera.y += (playerPixelY - this.camera.y) * this.camera.ease;
  }

  // Scan adjacent tiles for NPCs to cache their positions
  discoverNPCsNearby() {
    const range = 8; // Scan radius
    
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const tx = this.player.gridX + dx;
        const ty = this.player.gridY + dy;
        const key = `${tx},${ty}`;
        
        if (!this.discoveredNPCs[key]) {
          const npc = getNPCAt(tx, ty);
          if (npc) {
            this.discoveredNPCs[key] = npc;
          }
        }
      }
    }
  }

  // Get active rendering list of NPCs
  getNPCList() {
    return Object.values(this.discoveredNPCs);
  }

  // Close active dialog conversation
  closeDialog() {
    this.activeNPC = null;
    this.keys = {}; // Clear keys to prevent movement lock when dialogue collapses
    this.onEvent('dialog_close');
  }
}
