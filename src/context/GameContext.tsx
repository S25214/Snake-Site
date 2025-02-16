import React, { createContext, useState, useCallback } from 'react';

type Position = [number, number];
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type GameMode = 'SINGLE' | 'MULTIPLAYER' | 'AI_VS_AI';

interface Snake {
  body: Position[];
  direction: Direction;
}

interface GameState {
  isRunning: boolean;
  snakes: Snake[];
  food: Position[];
  scores: number[];
  speed: number;
  snakeColors: [string, string];
  gameMode: GameMode;
  powerUps: PowerUp[];
  snakeEffects: [SnakeEffects, SnakeEffects];
  lastPowerUpSpawn: number;
}

interface GameContextType {
  gameState: GameState;
  setFoodPosition: (position: Position) => void;
  setSnakeDirection: (snakeIndex: number, direction: Direction) => void; // <-- added
}

export const GameContext = createContext<GameContextType>({} as GameContextType);

const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;

// Helper function to generate random position
const generateRandomPosition = (): Position => {
  return [
    Math.floor(Math.random() * GRID_WIDTH),
    Math.floor(Math.random() * GRID_HEIGHT)
  ];
};

// Helper function to check if position is occupied by snakes or food
const isPositionOccupied = (position: Position, snakes: Snake[], foods: Position[] = []): boolean => {
  const occupiedBySnake = snakes.some(snake => 
    snake.body.some(([sx, sy]) => sx === position[0] && sy === position[1])
  );
  const occupiedByFood = foods.some(([fx, fy]) => fx === position[0] && fy === position[1]);
  return occupiedBySnake || occupiedByFood;
};

// Generate food position that doesn't overlap with snakes (or existing food)
const generateFood = (snakes: Snake[], foods: Position[] = []): Position => {
  let position: Position;
  do {
    position = generateRandomPosition();
  } while (isPositionOccupied(position, snakes, foods));
  return position;
};

// Create initial state based on the selected game mode
const createInitialState = (mode: GameMode): GameState => {
  // For SINGLE and MULTIPLAYER modes assume two snakes:
  // In SINGLE mode, the first snake will be user-controlled while the second is AI-controlled.
  // In MULTIPLAYER mode both are controlled by players.
  // In AI_VS_AI mode, both are controlled by the AI.
  const snakes: Snake[] = [
    {
      body: [[5, 5]],
      direction: 'RIGHT'
    },
    {
      body: [[GRID_WIDTH - 6, GRID_HEIGHT - 6]],
      direction: 'LEFT'
    }
  ];

  return {
    isRunning: false,
    snakes,
    food: [generateFood(snakes)],
    scores: [0, 0],
    speed: 100,
    snakeColors: ['#4ade80', '#60a5fa'],
    gameMode: mode
  };
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(createInitialState('SINGLE'));

  const updateSettings = useCallback((settings: Partial<Pick<GameState, 'speed' | 'snakeColors'>>) => {
    setGameState(prev => ({
      ...prev,
      ...settings
    }));
  }, []);

  const setFoodPosition = useCallback((position: Position) => {
    setGameState(prev => {
      if (!prev.isRunning) return prev;
      
      // Prevent adding food if the click overlaps a snake or existing food.
      if (isPositionOccupied(position, prev.snakes, prev.food)) {
        return prev;
      }
      
      return {
        ...prev,
        food: [...prev.food, position]
      };
    });
  }, []);

  // New function to update snake direction (prevents reversing)
  const setSnakeDirection = useCallback((snakeIndex: number, direction: Direction) => {
    setGameState(prev => {
      const opposites: Record<Direction, Direction> = {
        'UP': 'DOWN',
        'DOWN': 'UP',
        'LEFT': 'RIGHT',
        'RIGHT': 'LEFT'
      };
      const snake = prev.snakes[snakeIndex];
      if (opposites[snake.direction] === direction) {
        return prev;
      }
      const newSnakes = prev.snakes.map((s, index) =>
        index === snakeIndex ? { ...s, direction } : s
      );
      return { ...prev, snakes: newSnakes };
    });
  }, []);

  // Helper function to determine if a move is safe
  const isSafeMove = (position: Position, snakes: Snake[]): boolean => {
    const [x, y] = position;
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
    return !snakes.some(snake => snake.body.some(([sx, sy]) => sx === x && sy === y));
  };

  // Get next position based on direction
  const getNextPosition = (position: Position, direction: Direction): Position => {
    const [x, y] = position;
    switch (direction) {
      case 'UP': return [x, y - 1];
      case 'DOWN': return [x, y + 1];
      case 'LEFT': return [x - 1, y];
      case 'RIGHT': return [x + 1, y];
    }
  };

  // AI function to determine next direction
  const getNextDirection = (snake: Snake, foodList: Position[], otherSnake: Snake): Direction => {
    const head = snake.body[0];
    const targetFood = foodList.reduce((prev, curr) => {
      const prevDist = Math.abs(prev[0] - head[0]) + Math.abs(prev[1] - head[1]);
      const currDist = Math.abs(curr[0] - head[0]) + Math.abs(curr[1] - head[1]);
      return currDist < prevDist ? curr : prev;
    }, foodList[0]);

    const [hx, hy] = head;
    const [fx, fy] = targetFood;
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const opposites: Record<Direction, Direction> = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };

    const validDirections = directions.filter(dir =>
      dir !== opposites[snake.direction] && isSafeMove(getNextPosition(head, dir), [snake, otherSnake])
    );

    // Avoid head-on collision with other snake’s predicted head position.
    const predictedOtherHead = getNextPosition(otherSnake.body[0], otherSnake.direction);
    const filteredDirections = validDirections.filter(dir => {
      const candidate = getNextPosition(head, dir);
      return candidate[0] !== predictedOtherHead[0] || candidate[1] !== predictedOtherHead[1];
    });
    const finalDirections = filteredDirections.length ? filteredDirections : validDirections;

    if (finalDirections.length === 0) {
      return snake.direction;
    }

    // Choose the direction that minimizes distance to the target food.
    const directionScores = finalDirections.map(dir => {
      const [nx, ny] = getNextPosition(head, dir);
      const distanceToFood = Math.abs(nx - fx) + Math.abs(ny - fy);
      return { direction: dir, score: -distanceToFood };
    });

    return directionScores.reduce((best, current) =>
      current.score > best.score ? current : best
    ).direction;
  };

  const updateGame = useCallback(() => {
    setGameState(prev => {
      const newState = { ...prev };
      const newScores = [...prev.scores];

      // Update snake directions based on game mode.
      if (prev.gameMode === 'AI_VS_AI') {
        newState.snakes = prev.snakes.map((snake, index) => {
          const otherSnake = prev.snakes[index === 0 ? 1 : 0];
          const newDirection = getNextDirection(snake, prev.food, otherSnake);
          return { ...snake, direction: newDirection };
        });
      } else if (prev.gameMode === 'SINGLE') {
        // Assume first snake is user-controlled; update only the AI snake.
        const humanSnake = prev.snakes[0];
        const aiSnake = prev.snakes[1];
        newState.snakes[1] = {
          ...aiSnake,
          direction: getNextDirection(aiSnake, prev.food, humanSnake)
        };
      } else if (prev.gameMode === 'MULTIPLAYER') {
        // Do not auto-update directions; players control their snakes.
        newState.snakes = prev.snakes;
      }

      // Update snake positions and handle food consumption.
      newState.snakes = newState.snakes.map((snake, snakeIndex) => {
        const head = [...snake.body[0]] as Position;
        switch (snake.direction) {
          case 'UP': head[1] -= 1; break;
          case 'DOWN': head[1] += 1; break;
          case 'LEFT': head[0] -= 1; break;
          case 'RIGHT': head[0] += 1; break;
        }
        if (head[0] < 0 || head[0] >= GRID_WIDTH || head[1] < 0 || head[1] >= GRID_HEIGHT) {
          newState.isRunning = false;
          return snake;
        }
        const newBody = [head];
        // Check food consumption.
        const foodIndex = prev.food.findIndex(food => food[0] === head[0] && food[1] === head[1]);
        if (foodIndex > -1) {
          newBody.push(...snake.body);
          newScores[snakeIndex] += 1;
          newState.food = prev.food.filter((_, index) => index !== foodIndex);
        } else {
          newBody.push(...snake.body.slice(0, -1));
        }
        return { ...snake, body: newBody };
      });

      // Only spawn new food if none is present.
      if (newState.food.length === 0) {
        newState.food.push(generateFood(newState.snakes, []));
      }

      newState.scores = newScores;

      // Check collisions between snakes.
      const allSegments = newState.snakes.flatMap(snake => snake.body);
      const hasCollision = allSegments.some((segment, index) =>
        allSegments.some((otherSegment, otherIndex) =>
          index !== otherIndex && segment[0] === otherSegment[0] && segment[1] === otherSegment[1]
        )
      );
      if (hasCollision) {
        newState.isRunning = false;
      }

      return newState;
    });
  }, []);

  // startGame now takes a game mode.
  const startGame = useCallback((mode: GameMode) => {
    setGameState(prev => ({
      ...createInitialState(mode),
      speed: prev.speed,
      snakeColors: prev.snakeColors,
      isRunning: true
    }));
  }, []);

  return (
    <GameContext.Provider value={{ gameState, startGame, updateGame, updateSettings, setFoodPosition, setSnakeDirection }}>
      {children}
    </GameContext.Provider>
  );
};