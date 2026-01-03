import React, { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import SoundManager from './sounds'

// Game constants
const SHIP_SIZE = 40
const ASTEROID_MIN_SIZE = 25
const ASTEROID_MAX_SIZE = 60
const ASTEROID_SPEED = 1.2
const CRYSTAL_SIZE = 20
const THRUST_POWER = 0.3
const FRICTION = 0.98
const ROTATION_SPEED = 5
const GAME_WIDTH = 1200
const GAME_HEIGHT = 800
const POINTS_PER_CRYSTAL = 5
const ENERGY_PER_CRYSTAL = 15
const MAX_ENERGY = 100
const SHIELD_DURATION = 300 // frames (5 seconds at 60fps)

// Generate 99 levels with progressive difficulty
const generateLevels = () => {
  const levels = []
  for (let i = 1; i <= 99; i++) {
    // Progressive difficulty scaling
    const baseTarget = 50 + (i - 1) * 5 // Start at 50, increase by 5 per level
    const baseSpawnRate = Math.max(20, 120 - (i - 1) * 1) // Decrease spawn rate (harder)
    const baseSpeed = Math.min(3.5, 1.0 + (i - 1) * 0.025) // Increase speed (harder)
    
    // Difficulty labels
    let difficulty = 'Easy'
    if (i >= 20 && i < 40) difficulty = 'Medium'
    else if (i >= 40 && i < 60) difficulty = 'Hard'
    else if (i >= 60 && i < 80) difficulty = 'Very Hard'
    else if (i >= 80 && i < 95) difficulty = 'Extreme'
    else if (i >= 95) difficulty = 'Insane'
    
    levels.push({
      targetScore: baseTarget,
      spawnRate: Math.floor(baseSpawnRate),
      asteroidSpeed: baseSpeed,
      difficulty: difficulty
    })
  }
  return levels
}

const LEVELS = generateLevels()
const LEVELS_PER_PAGE = 12

function App() {
  const [gameState, setGameState] = useState('start')
  const [showInstructions, setShowInstructions] = useState(false)
  const [showCookies, setShowCookies] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showCookieConsent, setShowCookieConsent] = useState(() => {
    try {
      const consentGiven = localStorage.getItem('stellarEscapeCookieConsent')
      return !consentGiven
    } catch (error) {
      console.error('Error checking cookie consent:', error)
      return true // Show consent if localStorage fails
    }
  })
  const [shipX, setShipX] = useState(GAME_WIDTH / 2)
  const [shipY, setShipY] = useState(GAME_HEIGHT / 2)
  const [shipAngle, setShipAngle] = useState(0)
  const [asteroids, setAsteroids] = useState([])
  const [crystals, setCrystals] = useState([])
  const [particles, setParticles] = useState([])
  const [score, setScore] = useState(0)
  const [energy, setEnergy] = useState(0)
  const [powerActive, setPowerActive] = useState(false)
  const [powerTimer, setPowerTimer] = useState(0)
  
  // Sync powerActive ref with state
  useEffect(() => {
    powerActiveRef.current = powerActive
  }, [powerActive])
  const [level, setLevel] = useState(1)
  const [levelComplete, setLevelComplete] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [unlockedLevels, setUnlockedLevels] = useState(() => {
    try {
      const saved = localStorage.getItem('stellarEscapeUnlockedLevels')
      if (saved) {
        const parsed = JSON.parse(saved)
        return Array.isArray(parsed) ? parsed : [1]
      }
      return [1] // Start with level 1 unlocked
    } catch (error) {
      console.error('Error loading unlocked levels:', error)
      return [1]
    }
  })
  const [highScore, setHighScore] = useState(() => {
    try {
      const saved = localStorage.getItem('stellarEscapeHighScore')
      const score = saved ? parseInt(saved, 10) : 0
      return isNaN(score) ? 0 : score
    } catch (error) {
      console.error('Error loading high score:', error)
      return 0
    }
  })

  const keysRef = useRef({})
  const shipVelXRef = useRef(0)
  const shipVelYRef = useRef(0)
  const shipXRef = useRef(GAME_WIDTH / 2)
  const shipYRef = useRef(GAME_HEIGHT / 2)
  const shipAngleRef = useRef(0)
  const asteroidIdRef = useRef(0)
  const crystalIdRef = useRef(0)
  const particleIdRef = useRef(0)
  const gameLoopRef = useRef(null)
  const scoreRef = useRef(0)
  const energyRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const powerTimerRef = useRef(0)
  const powerActiveRef = useRef(false)
  const soundManagerRef = useRef(null)
  const thrustSoundTimerRef = useRef(0)
  const levelRef = useRef(1)

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
    return () => {
      if (soundManagerRef.current?.audioContext) {
        soundManagerRef.current.audioContext.close()
      }
    }
  }, [])

  // Helper function to play click sound and execute action
  const handleButtonClick = useCallback((action) => {
    if (soundManagerRef.current) {
      soundManagerRef.current.playClick()
    }
    action()
  }, [])

  const startLevel = useCallback((levelNum) => {
    if (soundManagerRef.current) {
      soundManagerRef.current.playStart()
    }
    setGameState('playing')
    setShipX(GAME_WIDTH / 2)
    setShipY(GAME_HEIGHT / 2)
    setShipAngle(0)
    setAsteroids([])
    setCrystals([])
    setParticles([])
    setScore(0)
    setEnergy(0)
    setPowerActive(false)
    powerActiveRef.current = false
    setPowerTimer(0)
    setLevel(levelNum)
    setLevelComplete(false)
    
    shipXRef.current = GAME_WIDTH / 2
    shipYRef.current = GAME_HEIGHT / 2
    shipVelXRef.current = 0
    shipVelYRef.current = 0
    shipAngleRef.current = 0
    asteroidIdRef.current = 0
    crystalIdRef.current = 0
    particleIdRef.current = 0
    scoreRef.current = 0
    energyRef.current = 0
    spawnTimerRef.current = 0
    powerTimerRef.current = 0
    levelRef.current = levelNum
  }, [])

  const startGame = useCallback(() => {
    startLevel(1)
  }, [startLevel])

  const restartCurrentLevel = useCallback(() => {
    setGameState('playing')
    setIsPaused(false)
    setScore(0)
    scoreRef.current = 0
    setEnergy(0)
    energyRef.current = 0
    setPowerActive(false)
    powerActiveRef.current = false
    setPowerTimer(0)
    powerTimerRef.current = 0
    setLevelComplete(false)
    setAsteroids([])
    setCrystals([])
    setParticles([])
    spawnTimerRef.current = 0
    asteroidIdRef.current = 0
    crystalIdRef.current = 0
    particleIdRef.current = 0
    
    // Reset ship position
    shipXRef.current = GAME_WIDTH / 2
    shipYRef.current = GAME_HEIGHT / 2
    shipVelXRef.current = 0
    shipVelYRef.current = 0
    shipAngleRef.current = 0
    setShipX(GAME_WIDTH / 2)
    setShipY(GAME_HEIGHT / 2)
    setShipAngle(0)
    
    if (soundManagerRef.current) {
      soundManagerRef.current.playStart()
    }
  }, [])

  const goToHome = useCallback(() => {
    setGameState('start')
    setIsPaused(false)
    setLevel(1)
    levelRef.current = 1
    setScore(0)
    scoreRef.current = 0
    setEnergy(0)
    energyRef.current = 0
    setPowerActive(false)
    powerActiveRef.current = false
    setPowerTimer(0)
    powerTimerRef.current = 0
    setLevelComplete(false)
    setAsteroids([])
    setCrystals([])
    setParticles([])
    spawnTimerRef.current = 0
    asteroidIdRef.current = 0
    crystalIdRef.current = 0
    particleIdRef.current = 0
    
    // Reset ship position
    shipXRef.current = GAME_WIDTH / 2
    shipYRef.current = GAME_HEIGHT / 2
    shipVelXRef.current = 0
    shipVelYRef.current = 0
    shipAngleRef.current = 0
    setShipX(GAME_WIDTH / 2)
    setShipY(GAME_HEIGHT / 2)
    setShipAngle(0)
  }, [])

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setIsPaused((prev) => !prev)
    }
  }, [gameState])

  const endGame = useCallback(() => {
    if (soundManagerRef.current) {
      soundManagerRef.current.playCrash()
    }
    setGameState('gameover')
    setIsPaused(false)
    const currentScore = scoreRef.current
    setHighScore((prevHighScore) => {
      if (currentScore > prevHighScore) {
        try {
          localStorage.setItem('stellarEscapeHighScore', currentScore.toString())
        } catch (error) {
          console.error('Error saving high score:', error)
        }
        return currentScore
      }
      return prevHighScore
    })
  }, [])

  const nextLevel = useCallback(() => {
    const currentLevel = levelRef.current
    if (currentLevel < LEVELS.length) {
      const nextLevelNum = currentLevel + 1
      
      // Unlock next level if not already unlocked
      if (!unlockedLevels.includes(nextLevelNum)) {
        const newUnlocked = [...unlockedLevels, nextLevelNum].sort((a, b) => a - b)
        setUnlockedLevels(newUnlocked)
        try {
          localStorage.setItem('stellarEscapeUnlockedLevels', JSON.stringify(newUnlocked))
        } catch (error) {
          console.error('Error saving unlocked levels:', error)
        }
      }
      
      startLevel(nextLevelNum)
    } else {
      // All levels completed! Go back to home
      setGameState('start')
    }
  }, [startLevel, unlockedLevels])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysRef.current[e.code] = true
      if (e.code === 'Space' && gameState === 'start') {
        e.preventDefault()
        // Start level 1 if space is pressed
        if (unlockedLevels.includes(1)) {
          startLevel(1)
        }
      } else if (e.code === 'Space' && gameState === 'gameover') {
        e.preventDefault()
        restartCurrentLevel()
      } else if (e.code === 'Space' && gameState === 'levelComplete') {
        e.preventDefault()
        if (level < LEVELS.length) {
          nextLevel()
        } else {
          // All levels done, go to home
          setGameState('start')
        }
      } else if (e.code === 'KeyP' && gameState === 'playing') {
        e.preventDefault()
        togglePause()
      }
    }

    const handleKeyUp = (e) => {
      keysRef.current[e.code] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gameState, startLevel, nextLevel, level, togglePause, unlockedLevels, restartCurrentLevel])

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing' || isPaused) return

    const gameLoop = () => {
      // Handle rotation
      if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) {
        shipAngleRef.current -= ROTATION_SPEED
      }
      if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) {
        shipAngleRef.current += ROTATION_SPEED
      }

      // Handle forward thrust
      if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) {
        const angleRad = (shipAngleRef.current * Math.PI) / 180
        shipVelXRef.current += Math.cos(angleRad) * THRUST_POWER
        shipVelYRef.current += Math.sin(angleRad) * THRUST_POWER

        // Play thrust sound (throttled)
        thrustSoundTimerRef.current++
        if (thrustSoundTimerRef.current % 3 === 0 && soundManagerRef.current) {
          soundManagerRef.current.playThrust()
        }

        // Add thruster particles
        const angleRad2 = ((shipAngleRef.current + 180) * Math.PI) / 180
        for (let i = 0; i < 3; i++) {
          setParticles((prev) => [
            ...prev,
            {
              id: particleIdRef.current++,
              x: shipXRef.current,
              y: shipYRef.current,
              vx: Math.cos(angleRad2) * (2 + Math.random() * 2),
              vy: Math.sin(angleRad2) * (2 + Math.random() * 2),
              life: 20,
              size: 3 + Math.random() * 3,
            },
          ])
        }
      }

      // Handle backward thrust
      if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) {
        const angleRad = (shipAngleRef.current * Math.PI) / 180
        shipVelXRef.current -= Math.cos(angleRad) * THRUST_POWER * 0.7 // Slightly slower backward
        shipVelYRef.current -= Math.sin(angleRad) * THRUST_POWER * 0.7

        // Play thrust sound (throttled)
        thrustSoundTimerRef.current++
        if (thrustSoundTimerRef.current % 3 === 0 && soundManagerRef.current) {
          soundManagerRef.current.playThrust()
        }

        // Add thruster particles (forward direction for backward thrust)
        const angleRad2 = (shipAngleRef.current * Math.PI) / 180
        for (let i = 0; i < 2; i++) {
          setParticles((prev) => [
            ...prev,
            {
              id: particleIdRef.current++,
              x: shipXRef.current,
              y: shipYRef.current,
              vx: Math.cos(angleRad2) * (1.5 + Math.random() * 1.5),
              vy: Math.sin(angleRad2) * (1.5 + Math.random() * 1.5),
              life: 15,
              size: 2 + Math.random() * 2,
            },
          ])
        }
      }

      // Apply friction
      shipVelXRef.current *= FRICTION
      shipVelYRef.current *= FRICTION

      // Update ship position
      shipXRef.current += shipVelXRef.current
      shipYRef.current += shipVelYRef.current

      // Wrap around screen edges
      if (shipXRef.current < 0) shipXRef.current = GAME_WIDTH
      if (shipXRef.current > GAME_WIDTH) shipXRef.current = 0
      if (shipYRef.current < 0) shipYRef.current = GAME_HEIGHT
      if (shipYRef.current > GAME_HEIGHT) shipYRef.current = 0

      setShipX(shipXRef.current)
      setShipY(shipYRef.current)
      setShipAngle(shipAngleRef.current)

      // Update shield timer
      if (powerActiveRef.current) {
        powerTimerRef.current++
        setPowerTimer(powerTimerRef.current)
        if (powerTimerRef.current >= SHIELD_DURATION) {
          setPowerActive(false)
          powerActiveRef.current = false
          powerTimerRef.current = 0
          setPowerTimer(0)
          energyRef.current = 0
          setEnergy(0)
        }
      }

      // Update particles (limit to prevent memory issues)
      setParticles((prev) => {
        const updated = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 1,
          }))
          .filter((p) => p.life > 0)
        // Limit particles to 500 to prevent memory issues
        return updated.length > 500 ? updated.slice(-500) : updated
      })

      // Check if shield should activate (if energy is full but shield not active)
      if (!powerActiveRef.current && energyRef.current >= MAX_ENERGY) {
        setPowerActive(true)
        powerActiveRef.current = true
        powerTimerRef.current = 0
        setPowerTimer(0)
        if (soundManagerRef.current) {
          soundManagerRef.current.playShieldActivate()
        }
      }

      // Check level completion - score-based (check at start of loop)
      const currentLevelConfig = LEVELS[levelRef.current - 1]
      if (currentLevelConfig && scoreRef.current >= currentLevelConfig.targetScore && !levelComplete) {
        setLevelComplete(true)
        setGameState('levelComplete')
        setIsPaused(false)
        
        // Check and update high score
        const currentScore = scoreRef.current
        setHighScore((prevHighScore) => {
          if (currentScore > prevHighScore) {
            try {
              localStorage.setItem('stellarEscapeHighScore', currentScore.toString())
            } catch (error) {
              console.error('Error saving high score:', error)
            }
            return currentScore
          }
          return prevHighScore
        })
        
        if (soundManagerRef.current) {
          soundManagerRef.current.playShieldActivate() // Use shield sound for level complete
        }
        return // Stop game loop
      }
      
      // Get level configuration
      const currentLevelIndex = levelRef.current - 1
      if (currentLevelIndex < 0 || currentLevelIndex >= LEVELS.length) {
        console.error('Invalid level index:', currentLevelIndex)
        return // Stop game loop if level is invalid
      }
      const levelConfig = LEVELS[currentLevelIndex]
      const levelSpawnRate = levelConfig.spawnRate
      const levelSpeed = levelConfig.asteroidSpeed

      // Spawn asteroids based on level difficulty
      spawnTimerRef.current++
      if (spawnTimerRef.current > levelSpawnRate) {
        spawnTimerRef.current = 0
        const side = Math.floor(Math.random() * 4)
        let x, y
        if (side === 0) {
          x = Math.random() * GAME_WIDTH
          y = -ASTEROID_MAX_SIZE
        } else if (side === 1) {
          x = GAME_WIDTH + ASTEROID_MAX_SIZE
          y = Math.random() * GAME_HEIGHT
        } else if (side === 2) {
          x = Math.random() * GAME_WIDTH
          y = GAME_HEIGHT + ASTEROID_MAX_SIZE
        } else {
          x = -ASTEROID_MAX_SIZE
          y = Math.random() * GAME_HEIGHT
        }

        const angle = Math.atan2(
          shipYRef.current - y,
          shipXRef.current - x
        ) + (Math.random() - 0.5) * 0.5

        const size = ASTEROID_MIN_SIZE + Math.random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE)
        const speed = levelSpeed + Math.random() * levelSpeed * 0.5

        setAsteroids((prev) => [
          ...prev,
          {
            id: asteroidIdRef.current++,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 3,
          },
        ])
      }

      // Update asteroids
      setAsteroids((prev) => {
        const updated = prev.map((asteroid) => ({
          ...asteroid,
          x: asteroid.x + asteroid.vx,
          y: asteroid.y + asteroid.vy,
          rotation: asteroid.rotation + asteroid.rotationSpeed,
        }))

        // Check collisions with ship
        const shipRect = {
          x: shipXRef.current - SHIP_SIZE / 2,
          y: shipYRef.current - SHIP_SIZE / 2,
          width: SHIP_SIZE,
          height: SHIP_SIZE,
        }

        for (const asteroid of updated) {
          const dx = shipXRef.current - asteroid.x
          const dy = shipYRef.current - asteroid.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < SHIP_SIZE / 2 + asteroid.size / 2) {
            // Check if shield is active
            if (powerActiveRef.current) {
              // Shield blocks the hit
              setPowerActive(false)
              powerActiveRef.current = false
              powerTimerRef.current = 0
              setPowerTimer(0)
              energyRef.current = 0
              setEnergy(0)
              if (soundManagerRef.current) {
                soundManagerRef.current.playShieldHit()
              }
              // Remove the asteroid that was blocked
              return updated.filter((a) => a.id !== asteroid.id)
            } else {
              // Collision with asteroid - game over
              endGame()
              return updated
            }
          }
        }

        return updated.filter(
          (a) =>
            a.x > -ASTEROID_MAX_SIZE &&
            a.x < GAME_WIDTH + ASTEROID_MAX_SIZE &&
            a.y > -ASTEROID_MAX_SIZE &&
            a.y < GAME_HEIGHT + ASTEROID_MAX_SIZE
        )
      })

      // Spawn crystals more frequently
      if (Math.random() < 0.04) {
        setCrystals((prev) => [
          ...prev,
          {
            id: crystalIdRef.current++,
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            rotation: 0,
            pulse: 0,
          },
        ])
      }

      // Update crystals
      setCrystals((prev) => {
        const updated = prev.map((crystal) => ({
          ...crystal,
          rotation: crystal.rotation + 2,
          pulse: crystal.pulse + 0.1,
        }))

        // Check collection
        const shipRect = {
          x: shipXRef.current - SHIP_SIZE / 2,
          y: shipYRef.current - SHIP_SIZE / 2,
          width: SHIP_SIZE,
          height: SHIP_SIZE,
        }

        const collected = []
        for (const crystal of updated) {
          const dx = shipXRef.current - crystal.x
          const dy = shipYRef.current - crystal.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < SHIP_SIZE / 2 + CRYSTAL_SIZE / 2) {
            collected.push(crystal.id)
            scoreRef.current += POINTS_PER_CRYSTAL
            setScore(scoreRef.current)
            
            // Add energy
            if (!powerActiveRef.current) {
              energyRef.current = Math.min(MAX_ENERGY, energyRef.current + ENERGY_PER_CRYSTAL)
              setEnergy(energyRef.current)
              
              // Activate shield if energy reaches 100%
              if (energyRef.current >= MAX_ENERGY) {
                setPowerActive(true)
                powerActiveRef.current = true
                powerTimerRef.current = 0
                setPowerTimer(0)
                if (soundManagerRef.current) {
                  soundManagerRef.current.playShieldActivate()
                }
              }
            }
            
            // Play collect sound
            if (soundManagerRef.current) {
              soundManagerRef.current.playCollect()
            }
            
            // Check if level is complete after collecting
            const currentLevelConfig = LEVELS[levelRef.current - 1]
            if (currentLevelConfig && scoreRef.current >= currentLevelConfig.targetScore && !levelComplete) {
              setLevelComplete(true)
              setGameState('levelComplete')
              
              // Check and update high score
              const currentScore = scoreRef.current
              setHighScore((prevHighScore) => {
                if (currentScore > prevHighScore) {
                  try {
                    localStorage.setItem('stellarEscapeHighScore', currentScore.toString())
                  } catch (error) {
                    console.error('Error saving high score:', error)
                  }
                  return currentScore
                }
                return prevHighScore
              })
              
              if (soundManagerRef.current) {
                soundManagerRef.current.playShieldActivate()
              }
              return updated.filter((c) => !collected.includes(c.id))
            }
            

            // Collection particles
            for (let i = 0; i < 10; i++) {
              setParticles((prev) => [
                ...prev,
                {
                  id: particleIdRef.current++,
                  x: crystal.x,
                  y: crystal.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  life: 30,
                  size: 2 + Math.random() * 2,
                  color: '#00FFFF',
                },
              ])
            }
          }
        }

        return updated.filter((c) => !collected.includes(c.id))
      })
    }

    gameLoopRef.current = setInterval(gameLoop, 16)
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState, isPaused, endGame, levelComplete])

  return (
    <div className="game-container">
      <div className="game-board" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
        {/* Starfield background */}
        <div className="starfield">
          {Array.from({ length: 200 }).map((_, i) => (
            <div
              key={i}
              className="star"
              style={{
                left: `${(i * 37) % 100}%`,
                top: `${(i * 73) % 100}%`,
                animationDelay: `${(i * 0.1) % 5}s`,
              }}
            />
          ))}
        </div>

        {/* Nebula effects */}
        <div className="nebula nebula1"></div>
        <div className="nebula nebula2"></div>
        <div className="nebula nebula3"></div>

        {/* Asteroids */}
        {asteroids.map((asteroid) => (
          <div
            key={asteroid.id}
            className="asteroid"
            style={{
              left: asteroid.x,
              top: asteroid.y,
              width: asteroid.size,
              height: asteroid.size,
              transform: `translate(-50%, -50%) rotate(${asteroid.rotation}deg)`,
            }}
          >
            <div className="asteroid-surface"></div>
          </div>
        ))}

        {/* Crystals */}
        {crystals.map((crystal) => (
          <div
            key={crystal.id}
            className="crystal"
            style={{
              left: crystal.x,
              top: crystal.y,
              transform: `translate(-50%, -50%) rotate(${crystal.rotation}deg) scale(${1 + Math.sin(crystal.pulse) * 0.2})`,
            }}
          >
            <div className="crystal-core"></div>
            <div className="crystal-glow"></div>
          </div>
        ))}

        {/* Particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="particle"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color || '#00FFFF',
              opacity: particle.life / 20,
            }}
          />
        ))}

        {/* Spaceship */}
        {gameState === 'playing' && (
          <>
            <div
              className="spaceship"
              style={{
                left: shipX,
                top: shipY,
                transform: `translate(-50%, -50%) rotate(${shipAngle}deg)`,
              }}
            >
              <div className="ship-body"></div>
              <div className="ship-wing ship-wing-left"></div>
              <div className="ship-wing ship-wing-right"></div>
              <div className="ship-cockpit"></div>
              <div className="ship-thruster"></div>
            </div>
            {/* Shield effect */}
            {powerActive && (
              <div
                className="shield"
                style={{
                  left: shipX,
                  top: shipY,
                }}
              >
                <div className="shield-ring shield-ring-1"></div>
                <div className="shield-ring shield-ring-2"></div>
                <div className="shield-ring shield-ring-3"></div>
              </div>
            )}
          </>
        )}

        {/* UI Overlay */}
        <div className="game-ui">
          {gameState === 'start' && (
            <div className="start-screen">
              <h1 className="game-title">STELLAR ESCAPE</h1>
              <p className="game-subtitle">Navigate the cosmic void</p>
              
              {/* High Score at Top */}
              {highScore > 0 && (
                <p className="high-score">🏆 High Score: {highScore}</p>
              )}
              
              {/* Level Selection */}
              <div className="level-selection">
                <h3 className="level-selection-title">Select Level:</h3>
                
                {/* Pagination Controls */}
                <div className="pagination-controls">
                  <button 
                    className="pagination-btn"
                    onClick={() => handleButtonClick(() => setCurrentPage(prev => Math.max(1, prev - 1)))}
                    disabled={currentPage === 1}
                  >
                    ← Prev
                  </button>
                  <div className="pagination-numbers">
                    {Array.from({ length: Math.ceil(LEVELS.length / LEVELS_PER_PAGE) }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`pagination-number-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => handleButtonClick(() => setCurrentPage(pageNum))}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <button 
                    className="pagination-btn"
                    onClick={() => handleButtonClick(() => setCurrentPage(prev => Math.min(Math.ceil(LEVELS.length / LEVELS_PER_PAGE), prev + 1)))}
                    disabled={currentPage === Math.ceil(LEVELS.length / LEVELS_PER_PAGE)}
                  >
                    Next →
                  </button>
                </div>
                
                <div className="level-grid">
                  {LEVELS.slice((currentPage - 1) * LEVELS_PER_PAGE, currentPage * LEVELS_PER_PAGE).map((levelConfig, index) => {
                    const levelNum = (currentPage - 1) * LEVELS_PER_PAGE + index + 1
                    const isUnlocked = unlockedLevels.includes(levelNum)
                    return (
                      <button
                        key={levelNum}
                        className={`level-button ${isUnlocked ? 'level-unlocked' : 'level-locked'}`}
                        onClick={() => isUnlocked && handleButtonClick(() => startLevel(levelNum))}
                        disabled={!isUnlocked}
                      >
                        <div className="level-number">{levelNum}</div>
                        <div className="level-info">
                          <div className="level-target">Target: {levelConfig.targetScore}</div>
                          <div className="level-difficulty">{levelConfig.difficulty}</div>
                        </div>
                        {!isUnlocked && <div className="level-lock">🔒</div>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* How to Play Button at Bottom */}
              <div className="start-screen-actions">
                <button className="control-btn instruction-btn" onClick={() => handleButtonClick(() => setShowInstructions(true))}>
                  📖 How to Play
                </button>
              </div>
            </div>
          )}

          {gameState === 'playing' && (
            <>
              {/* Game Controls */}
              <div className="game-controls">
                <button className="control-btn" onClick={() => handleButtonClick(togglePause)}>
                  {isPaused ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button className="control-btn" onClick={() => handleButtonClick(restartCurrentLevel)}>
                  🔄 Restart
                </button>
                <button className="control-btn" onClick={() => handleButtonClick(goToHome)}>
                  🏠 Home
                </button>
              </div>
              {isPaused && (
                <div className="pause-overlay">
                  <div className="pause-screen">
                    <h2>⏸ PAUSED</h2>
                    <p className="instruction">Click Resume or press P to continue</p>
                  </div>
                </div>
              )}
              <div className="score-display">Score: {score} | Level: {level}</div>
              <div className="level-target-display">
                Level {level} Target: {LEVELS[level - 1]?.targetScore || 0} points
                {LEVELS[level - 1] && (
                  <div className="level-progress-text">
                    Progress: {score} / {LEVELS[level - 1].targetScore}
                  </div>
                )}
              </div>
              {/* Energy Bar */}
              <div className="energy-bar-container">
                <div className="energy-label">Energy:</div>
                <div className="energy-bar">
                  <div
                    className={`energy-fill ${energy >= MAX_ENERGY ? 'energy-full' : ''}`}
                    style={{ width: `${energy}%` }}
                  ></div>
                </div>
                <div className="energy-percentage">{energy}%</div>
                {powerActive && (
                  <div className="power-active">
                    🛡️ SHIELD ACTIVE
                    <div className="power-timer">
                      {Math.ceil((SHIELD_DURATION - powerTimer) / 60)}s
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {gameState === 'levelComplete' && (
            <div className="level-complete-screen">
              <h2>Level {level} Complete! 🎉</h2>
              <p className="final-score">Score: {score}</p>
              {score === highScore && score > 0 && (
                <p className="new-record">New High Score! ⭐</p>
              )}
              {level < LEVELS.length ? (
                <>
                  <p className="next-level-info">Ready for Level {level + 1}?</p>
                  <p className="next-level-target">Target: {LEVELS[level]?.targetScore || 0} points</p>
                  <p className="instruction">Press SPACE to continue</p>
                </>
              ) : (
                <>
                  <p className="new-record">🎊 All Levels Completed! 🎊</p>
                  <p className="instruction">Press SPACE to restart</p>
                </>
              )}
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="gameover-screen">
              <h2>Mission Failed</h2>
              <p className="final-score">Final Score: {score}</p>
              <p className="final-level">Reached Level: {level}</p>
              {score === highScore && score > 0 && (
                <p className="new-record">New Record! ⭐</p>
              )}
              {highScore > 0 && (
                <p className="high-score">High Score: {highScore}</p>
              )}
              <div className="gameover-buttons">
                <button className="control-btn" onClick={() => handleButtonClick(restartCurrentLevel)}>
                  🔄 Restart Level
                </button>
                <button className="control-btn" onClick={() => handleButtonClick(goToHome)}>
                  🏠 Back to Home
                </button>
              </div>
            </div>
          )}

          {/* Instructions Modal */}
          {showInstructions && (
            <div className="instructions-overlay" onClick={() => handleButtonClick(() => setShowInstructions(false))}>
              <div className="instructions-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-instructions" onClick={() => handleButtonClick(() => setShowInstructions(false))}>
                  ✕
                </button>
                <h2 className="instructions-modal-title">How to Play</h2>
                <div className="instructions-content">
                  <div className="instruction-section">
                    <h3 className="instruction-section-title">Controls</h3>
                    <div className="instruction-item">
                      <span className="instruction-key">← → / A D</span>
                      <span className="instruction-text">Rotate your ship</span>
                    </div>
                    <div className="instruction-item">
                      <span className="instruction-key">↑ / W</span>
                      <span className="instruction-text">Thrust forward</span>
                    </div>
                    <div className="instruction-item">
                      <span className="instruction-key">↓ / S</span>
                      <span className="instruction-text">Thrust backward</span>
                    </div>
                    <div className="instruction-item">
                      <span className="instruction-key">P</span>
                      <span className="instruction-text">Pause/Resume game</span>
                    </div>
                  </div>

                  <div className="instruction-section">
                    <h3 className="instruction-section-title">Gameplay</h3>
                    <div className="instruction-item">
                      <span className="instruction-key">💎</span>
                      <span className="instruction-text">Collect crystals to gain 5 points and 15 energy</span>
                    </div>
                    <div className="instruction-item">
                      <span className="instruction-key">🛡️</span>
                      <span className="instruction-text">When energy reaches 100%, shield activates for 5 seconds!</span>
                    </div>
                    <div className="instruction-item">
                      <span className="instruction-key">⚠️</span>
                      <span className="instruction-text">Avoid asteroids or you'll crash! (Shield blocks one hit)</span>
                    </div>
                    <div className="instruction-item">
                      <span className="instruction-key">📈</span>
                      <span className="instruction-text">Reach the target score to complete each level!</span>
                    </div>
                  </div>

                  <div className="instruction-section">
                    <h3 className="instruction-section-title">Levels</h3>
                    <div className="instruction-item">
                      <span className="instruction-key">🎯</span>
                      <span className="instruction-text">Complete levels to unlock the next one</span>
                    </div>
                    <div className="instruction-item">
                      <span className="instruction-key">🔄</span>
                      <span className="instruction-text">If you crash, you can restart the current level</span>
                    </div>
                  </div>
                </div>
                <button className="control-btn close-instructions-btn" onClick={() => handleButtonClick(() => setShowInstructions(false))}>
                  Got it!
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="game-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href="#" onClick={(e) => { e.preventDefault(); handleButtonClick(() => setShowCookies(true)); }}>Cookies</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleButtonClick(() => setShowAbout(true)); }}>About Us</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleButtonClick(() => setShowPrivacy(true)); }}>Privacy Policy</a>
            <a href="#" onClick={(e) => { e.preventDefault(); handleButtonClick(() => setShowContact(true)); }}>Contact Us</a>
          </div>
        </div>
      </footer>

      {/* Cookies Modal */}
      {showCookies && (
        <div className="instructions-overlay" onClick={() => handleButtonClick(() => setShowCookies(false))}>
          <div className="instructions-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-instructions" onClick={() => handleButtonClick(() => setShowCookies(false))}>
              ✕
            </button>
            <h2 className="instructions-modal-title">Cookie Policy</h2>
            <div className="instructions-content">
              <div className="instruction-section">
                <h3 className="instruction-section-title">What are Cookies?</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  Cookies are small text files that are stored on your device when you visit our website. 
                  They help us provide you with a better experience by remembering your preferences and settings.
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">How We Use Cookies</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  Stellar Escape uses cookies to store your game progress, high scores, and unlocked levels. 
                  This allows you to continue your game from where you left off and track your achievements.
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">Managing Cookies</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  You can manage or delete cookies through your browser settings. However, disabling cookies 
                  may affect your ability to save game progress and preferences.
                </p>
              </div>
            </div>
            <button className="control-btn close-instructions-btn" onClick={() => handleButtonClick(() => setShowCookies(false))}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* About Us Modal */}
      {showAbout && (
        <div className="instructions-overlay" onClick={() => handleButtonClick(() => setShowAbout(false))}>
          <div className="instructions-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-instructions" onClick={() => handleButtonClick(() => setShowAbout(false))}>
              ✕
            </button>
            <h2 className="instructions-modal-title">About Us</h2>
            <div className="instructions-content">
              <div className="instruction-section">
                <h3 className="instruction-section-title">Stellar Escape</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  Stellar Escape is an exciting space-themed arcade game where you navigate through the cosmic void, 
                  collecting crystals and avoiding asteroids. Test your skills across multiple challenging levels!
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">Our Mission</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  Our mission is to provide an engaging and entertaining gaming experience that challenges players 
                  while maintaining fun and accessibility for all skill levels.
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">Developer</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  Stellar Escape was developed by <strong style={{ color: '#ffffff' }}>Michael Entera</strong>, 
                  bringing you an immersive space adventure with stunning visuals and smooth gameplay.
                </p>
              </div>
            </div>
            <button className="control-btn close-instructions-btn" onClick={() => handleButtonClick(() => setShowAbout(false))}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="instructions-overlay" onClick={() => handleButtonClick(() => setShowPrivacy(false))}>
          <div className="instructions-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-instructions" onClick={() => handleButtonClick(() => setShowPrivacy(false))}>
              ✕
            </button>
            <h2 className="instructions-modal-title">Privacy Policy</h2>
            <div className="instructions-content">
              <div className="instruction-section">
                <h3 className="instruction-section-title">Information We Collect</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  Stellar Escape stores game data locally on your device, including high scores, unlocked levels, 
                  and game preferences. No personal information is collected or transmitted to external servers.
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">Data Storage</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  All game data is stored locally in your browser's localStorage. This data remains on your device 
                  and is not shared with third parties or external services.
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">Your Rights</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  You can clear your game data at any time by clearing your browser's localStorage. 
                  This will reset all game progress, high scores, and unlocked levels.
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">Contact</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  If you have any questions about our privacy practices, please contact us through the Contact Us page.
                </p>
              </div>
            </div>
            <button className="control-btn close-instructions-btn" onClick={() => handleButtonClick(() => setShowPrivacy(false))}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Contact Us Modal */}
      {showContact && (
        <div className="instructions-overlay" onClick={() => handleButtonClick(() => setShowContact(false))}>
          <div className="instructions-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-instructions" onClick={() => handleButtonClick(() => setShowContact(false))}>
              ✕
            </button>
            <h2 className="instructions-modal-title">Contact Us</h2>
            <div className="instructions-content">
              <div className="instruction-section">
                <h3 className="instruction-section-title">Get in Touch</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  Have questions, feedback, or suggestions about Stellar Escape? We'd love to hear from you!
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">Developer</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  <strong style={{ color: '#ffffff' }}>Michael Entera</strong>
                </p>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  For inquiries about Stellar Escape, game features, bug reports, or general feedback, 
                  please reach out through your preferred communication channel.
                </p>
              </div>
              <div className="instruction-section">
                <h3 className="instruction-section-title">Feedback</h3>
                <p style={{ color: '#00ffff', lineHeight: '1.6', marginBottom: '15px' }}>
                  Your feedback helps us improve the game and create a better gaming experience. 
                  We appreciate all suggestions and bug reports!
                </p>
              </div>
            </div>
            <button className="control-btn close-instructions-btn" onClick={() => handleButtonClick(() => setShowContact(false))}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Cookie Consent Banner */}
      {showCookieConsent && (
        <div className="cookie-consent-banner">
          <div className="cookie-consent-content">
            <div className="cookie-consent-text">
              <p>🍪 We use cookies to enhance your gaming experience and save your progress. By continuing, you agree to our use of cookies.</p>
            </div>
            <div className="cookie-consent-buttons">
              <button 
                className="control-btn" 
                onClick={() => {
                  try {
                    localStorage.setItem('stellarEscapeCookieConsent', 'true')
                  } catch (error) {
                    console.error('Error saving cookie consent:', error)
                  }
                  setShowCookieConsent(false)
                }}
              >
                Accept
              </button>
              <button 
                className="control-btn" 
                onClick={() => {
                  try {
                    localStorage.setItem('stellarEscapeCookieConsent', 'declined')
                  } catch (error) {
                    console.error('Error saving cookie consent:', error)
                  }
                  setShowCookieConsent(false)
                }}
                style={{ background: 'linear-gradient(135deg, rgba(139, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.8) 100%)' }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
