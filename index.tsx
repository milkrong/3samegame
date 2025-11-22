import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- Constants ---
const COLS = 8;
const ROWS = 8;
const TYPES = ['🍎', '🍊', '🍇', '🥥', '🥝', '🍋'];
const ANIMATION_MS = 300;

// --- Types ---
type Gem = {
  id: number;
  x: number;
  y: number;
  type: string;
  isMatch?: boolean;
  isNew?: boolean;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
};

// --- Utils ---
const getRandomType = () => TYPES[Math.floor(Math.random() * TYPES.length)];

let gemIdCounter = 0;
const createGem = (x: number, y: number, type?: string): Gem => ({
  id: gemIdCounter++,
  x,
  y,
  type: type || getRandomType(),
  isNew: true,
});

// --- Components ---

const App = () => {
  const [gems, setGems] = useState<Gem[]>([]);
  const [score, setScore] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  // Game Loop / Initialization
  useEffect(() => {
    initGame();
  }, []);

  const initGame = () => {
    let newGems: Gem[] = [];
    // Create initial grid without matches
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let type = getRandomType();
        // Simple prevention of initial matches
        while (
          (x >= 2 && newGems[newGems.length - 1].type === type && newGems[newGems.length - 2].type === type) ||
          (y >= 2 && newGems[newGems.length - COLS].type === type && newGems[newGems.length - COLS * 2].type === type)
        ) {
          type = getRandomType();
        }
        newGems.push(createGem(x, y, type));
      }
    }
    setGems(newGems);
    setScore(0);
    setIsProcessing(false);
  };

  // --- Game Logic Core ---

  const getGemAt = (x: number, y: number, currentGems: Gem[]) => 
    currentGems.find(g => g.x === x && g.y === y);

  const findMatches = (currentGems: Gem[]) => {
    const matches = new Set<number>();
    
    // Check Horizontal
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS - 2; x++) {
        const g1 = getGemAt(x, y, currentGems);
        const g2 = getGemAt(x + 1, y, currentGems);
        const g3 = getGemAt(x + 2, y, currentGems);
        
        if (g1 && g2 && g3 && g1.type === g2.type && g1.type === g3.type) {
          matches.add(g1.id);
          matches.add(g2.id);
          matches.add(g3.id);
          // Check for more than 3
          let k = x + 3;
          while(k < COLS) {
            const next = getGemAt(k, y, currentGems);
            if (next && next.type === g1.type) {
              matches.add(next.id);
              k++;
            } else break;
          }
        }
      }
    }

    // Check Vertical
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS - 2; y++) {
        const g1 = getGemAt(x, y, currentGems);
        const g2 = getGemAt(x, y + 1, currentGems);
        const g3 = getGemAt(x, y + 2, currentGems);
        
        if (g1 && g2 && g3 && g1.type === g2.type && g1.type === g3.type) {
          matches.add(g1.id);
          matches.add(g2.id);
          matches.add(g3.id);
           let k = y + 3;
          while(k < ROWS) {
            const next = getGemAt(x, k, currentGems);
            if (next && next.type === g1.type) {
              matches.add(next.id);
              k++;
            } else break;
          }
        }
      }
    }
    
    return matches;
  };

  // Spawns particles at x,y
  const spawnExplosion = (x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      newParticles.push({
        id: Math.random(),
        x: x * 66 + 30, // Approximate pixel conversion
        y: y * 66 + 30,
        color,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  // --- Main Game Processing Loop ---
  const processBoard = async (currentGems: Gem[], multiplier = 1) => {
    setIsProcessing(true);

    // 1. Find matches
    const matchedIds = findMatches(currentGems);
    
    if (matchedIds.size === 0) {
      setIsProcessing(false);
      return;
    }

    // 2. Show match animation & update score
    setScore(s => s + matchedIds.size * 10 * multiplier);
    
    // Trigger particles
    matchedIds.forEach(id => {
      const g = currentGems.find(gem => gem.id === id);
      if (g) spawnExplosion(g.x, g.y, getColorForType(g.type));
    });

    // Mark as matching (for visual effect if needed, but we'll just wait)
    setGems(gems => gems.map(g => matchedIds.has(g.id) ? { ...g, isMatch: true } : g));
    
    await wait(300); // Wait for explosion visual

    // 3. Remove matches
    const remainingGems = currentGems.filter(g => !matchedIds.has(g.id));
    
    // 4. Apply Gravity
    // Sort by y descending to handle columns bottom-up
    const columns: Gem[][] = Array.from({ length: COLS }, () => []);
    remainingGems.forEach(g => columns[g.x].push(g));
    
    const newGems: Gem[] = [];
    
    // Rebuild columns
    for (let x = 0; x < COLS; x++) {
      // Sort existing gems in this column by Y (top to bottom)
      columns[x].sort((a, b) => a.y - b.y);
      
      // Shift them down
      // If a column has 3 gems, they should be at y=5,6,7. 
      // The gap is at the top.
      const count = columns[x].length;
      const missing = ROWS - count;
      
      // Add new gems at the top (visually starting above board)
      for (let i = 0; i < missing; i++) {
        newGems.push({
          ...createGem(x, i - missing), // Start negative Y
          isNew: true
        });
      }
      
      // Move existing gems to new positions
      columns[x].forEach((g, index) => {
        newGems.push({
          ...g,
          y: index + missing, // Stack at bottom
          isMatch: false
        });
      });
    }
    
    // Render the falling state
    setGems(newGems);
    
    await wait(50); // Short delay to allow DOM to register new positions before transition
    
    // 5. Animate fall (This happens automatically because we changed Y coords)
    // But we need to ensure the "new" gems fall into place
    // Actually, React renders the new state. CSS transition handles the move.
    // However, newly created gems need to start 'above' and then fall.
    // The code above sets their Y to `i - missing` (negative). 
    // We need to snap them there, then update them to their final position.
    
    // Since we just setGems with negative Y, let's wait a tiny bit for that render,
    // then force them to their real positions. But wait, `processBoard` logic needs to be recursive.
    // The simplest way with React state transitions:
    // Just set them to their final positions immediately? No, then they appear instantly.
    // We set them at negative Y above.
    // Now we want to "drop" them.
    
    // Let's refine the gravity step:
    // 1. Identify destination Y for everyone.
    // 2. Current state: gems are at old Y or deleted.
    // 3. To animate drop:
    //    We simply update the Y values. New gems are created.
    //    For new gems to "fall in", they must first exist in the DOM at y < 0.
    
    // Simplified Approach: Just update logic. Visuals will slide if ID matches.
    // New items won't slide in from top unless we double-render. 
    // For this SPA, let's accept new items might fade in or pop in, OR we do a double setGems.
    
    // Let's do the double render for smooth entry.
    // We already calculated `newGems` where new items have negative Y.
    // BUT `columns[x]` items have updated positive Y. 
    
    // Let's actually set the state where they ARE falling.
    // So step 4 setGems IS the "start of fall" for new items?
    // No, we want them to end up at correct Y.
    
    // Let's just place them correctly.
    setGems(prev => {
       // We need to keep IDs stable.
       return newGems;
    });

    await wait(ANIMATION_MS);

    // Recursion check
    // We need to pass the *new* state to the recursive call
    // Since setGems is async/batched, we use the calculated `newGems`
    await processBoard(newGems, multiplier + 1);
  };

  const handleSwap = async (id1: number, id2: number) => {
    setIsProcessing(true);
    setSelectedId(null);

    const g1 = gems.find(g => g.id === id1)!;
    const g2 = gems.find(g => g.id === id2)!;

    // 1. Swap coordinates visually
    const nextGems = gems.map(g => {
      if (g.id === id1) return { ...g, x: g2.x, y: g2.y };
      if (g.id === id2) return { ...g, x: g1.x, y: g1.y };
      return g;
    });
    setGems(nextGems);

    await wait(ANIMATION_MS);

    // 2. Check matches
    const matches = findMatches(nextGems);
    
    if (matches.size > 0) {
      // Valid swap
      await processBoard(nextGems);
    } else {
      // Invalid swap - revert
      setGems(gems); // Revert to original 'gems' state from closure
      await wait(ANIMATION_MS);
      setIsProcessing(false);
    }
  };

  const handleClick = (id: number) => {
    if (isProcessing || isPaused) return;

    if (selectedId === null) {
      setSelectedId(id);
    } else {
      if (selectedId === id) {
        setSelectedId(null);
        return;
      }

      const g1 = gems.find(g => g.id === selectedId);
      const g2 = gems.find(g => g.id === id);

      if (g1 && g2) {
        // Check adjacency
        const dx = Math.abs(g1.x - g2.x);
        const dy = Math.abs(g1.y - g2.y);
        if (dx + dy === 1) {
          handleSwap(selectedId, id);
        } else {
          setSelectedId(id); // Select new instead
        }
      }
    }
  };

  // --- Particle System Loop ---
  useEffect(() => {
    if (particles.length === 0) return;
    
    const interval = setInterval(() => {
      setParticles(prev => {
        const next = prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.5, // gravity
          life: p.life - 0.05
        })).filter(p => p.life > 0);
        return next;
      });
    }, 16);
    
    return () => clearInterval(interval);
  }, [particles.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      {/* Header / Score */}
      <div style={{ 
        background: 'rgba(0,0,0,0.5)', 
        padding: '15px 30px', 
        borderRadius: '20px',
        display: 'flex',
        gap: '40px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Score</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffd700' }}>{score}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => setIsPaused(!isPaused)}
            style={buttonStyle}
          >
            {isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button 
            onClick={initGame}
            style={{...buttonStyle, background: '#e74c3c'}}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Board Container */}
      <div style={{ position: 'relative' }}>
        <div style={{
          width: `${COLS * 66}px`,
          height: `${ROWS * 66}px`,
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          position: 'relative',
          overflow: 'hidden',
          border: '4px solid rgba(255,255,255,0.1)',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)'
        }}>
          {/* Grid Background Cells (Checkerboard optional, just visuals) */}
          {Array.from({ length: ROWS * COLS }).map((_, i) => {
             const x = i % COLS;
             const y = Math.floor(i / COLS);
             return (
               <div key={i} style={{
                 position: 'absolute',
                 left: x * 66,
                 top: y * 66,
                 width: 60,
                 height: 60,
                 margin: 3,
                 background: (x + y) % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                 borderRadius: '8px'
               }} />
             )
          })}

          {/* Gems */}
          {gems.map((gem) => (
            <div
              key={gem.id}
              onClick={() => handleClick(gem.id)}
              style={{
                position: 'absolute',
                width: '60px',
                height: '60px',
                left: `${gem.x * 66 + 3}px`,
                top: `${gem.y * 66 + 3}px`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '36px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                transform: gem.isMatch ? 'scale(0)' : (selectedId === gem.id ? 'scale(1.15)' : 'scale(1)'),
                opacity: gem.isMatch ? 0 : 1,
                zIndex: selectedId === gem.id ? 10 : 1,
                filter: selectedId === gem.id ? 'drop-shadow(0 0 10px white)' : 'none',
                userSelect: 'none'
              }}
            >
              {gem.type}
            </div>
          ))}
          
          {/* Particles Overlay */}
          {particles.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: p.color,
              opacity: p.life,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)'
            }} />
          ))}

          {/* Pause Overlay */}
          {isPaused && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 20,
              fontSize: '32px',
              fontWeight: 'bold',
              color: 'white'
            }}>
              PAUSED
            </div>
          )}
        </div>
      </div>
      
      <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '10px' }}>
        Match 3 or more items to blast them away!
      </div>
    </div>
  );
};

// --- Helpers ---

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '8px',
  background: '#3498db',
  color: 'white',
  fontSize: '14px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'transform 0.1s, background 0.2s',
  boxShadow: '0 4px 0 rgba(0,0,0,0.2)'
};

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getColorForType(type: string) {
  switch(type) {
    case '🍎': return '#e74c3c';
    case '🍊': return '#e67e22';
    case '🍇': return '#9b59b6';
    case '🥥': return '#ecf0f1';
    case '🥝': return '#2ecc71';
    case '🍋': return '#f1c40f';
    default: return '#fff';
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
