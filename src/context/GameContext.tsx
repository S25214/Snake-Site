import React, { createContext, useState, useCallback } from 'react';

type Position = [number, number];
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

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
  snakeColors: string[];
}

interface GameContextType {
  gameState: GameState;
  startGame: () => void;
  updateGame: () => void;
  updateSettings: (settings: Partial<Pick<GameState, 'speed' | 'snakeColors'>>) => void;
  addFoodPosition: (position: Position) => void;
}

export const GameContext = createContext<GameContextType>({
  gameState: {
    isRunning: false,
    snakes: [{ body: [[10, 10]], direction: 'RIGHT' }, { body: [[20, 20]], direction: 'LEFT' }],
    food: [],
    scores: [0, 0],
    speed: 100,
    snakeColors: ['#00FF00', '#0000FF'],
  },
  startGame: () => {},
  updateGame: () => {},
  updateSettings: () => {},
  addFoodPosition: () => {},
});

const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;

// Helper function to generate random position
const generateRandomPosition = (): Position => {
  return [
    Math.floor(Math.random() * GRID_WIDTH),
    Math.floor(Math.random() * GRID_HEIGHT)
  ];
};

// Helper function to check if position is occupied by snakes
const isPositionOccupied = (position: Position, snakes: Snake[]): boolean => {
  return snakes.some(snake => 
    snake.body.some(([sx, sy]) => sx === position[0] && sy === position[1])
  );
};

// Generate food position that doesn't overlap with snakes
const generateFood = (snakes: Snake[]): Position => {
  let position: Position;
  do {
    position = generateRandomPosition();
  } while (isPositionOccupied(position, snakes));
  return position;
};

// Create initial state with snakes far apart
const createInitialState = (): GameState => {
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
    food: [],
    scores: [0, 0],
    speed: 100,
    snakeColors: ['#4ade80', '#60a5fa']
  };
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(createInitialState());

  const updateSettings = useCallback((settings: Partial<Pick<GameState, 'speed' | 'snakeColors'>>) => {
    setGameState(prev => ({
      ...prev,
      ...settings
    }));
  }, []);

  const addFoodPosition = useCallback((position: Position) => {
    setGameState(prev => ({
      ...prev,
      food: [...prev.food, position]
    }));
  }, []);

  // Helper function to determine if a move is safe
  const isSafeMove = (position: Position, snakes: Snake[]): boolean => {
    const [x, y] = position;
    
    // Check wall collisions
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      return false;
    }

    // Check snake collisions
    return !snakes.some(snake => 
      snake.body.some(([sx, sy]) => sx === x && sy === y)
    );
  };

  // Get the next position based on current position and direction
  const getNextPosition = (position: Position, direction: Direction): Position => {
    const [x, y] = position;
    switch (direction) {
      case 'UP': return [x, y - 1];
      case 'DOWN': return [x, y + 1];
      case 'LEFT': return [x - 1, y];
      case 'RIGHT': return [x + 1, y];
    }
  };

  // AI function to determine next direction for a snake
  const getNextDirection = (snake: Snake, food: Position, otherSnake: Snake): Direction => {
    const head = snake.body[0];
    const [hx, hy] = head;
    const [fx, fy] = food;
    
    // List of possible directions
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    // Filter out opposite of current direction to prevent immediate reversal
    const opposites: Record<Direction, Direction> = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };
    
    const validDirections = directions.filter(dir => 
      dir !== opposites[snake.direction] &&
      isSafeMove(getNextPosition(head, dir), [snake, otherSnake])
    );

    if (validDirections.length === 0) {
      return snake.direction; // Keep current direction if no safe moves
    }

    // Score each direction based on distance to food
    const directionScores = validDirections.map(dir => {
      const [nx, ny] = getNextPosition(head, dir);
      const distanceToFood = Math.abs(nx - fx) + Math.abs(ny - fy);
      return { direction: dir, score: -distanceToFood };
    });

    // Choose the direction with the highest score
    return directionScores.reduce((best, current) => 
      current.score > best.score ? current : best
    ).direction;
  };

  const updateGame = useCallback(() => {
    setGameState(prev => {
      const newState = { ...prev };
      const newScores = [...prev.scores];
      let newFood = prev.food;
      
      // Update snake directions using AI
      newState.snakes = prev.snakes.map((snake, index) => {
        const otherSnake = prev.snakes[index === 0 ? 1 : 0];
        const newDirection = getNextDirection(snake, prev.food[0], otherSnake);
        return { ...snake, direction: newDirection };
      });
      
      // Update snake positions
      newState.snakes = newState.snakes.map((snake, snakeIndex) => {
        const head = [...snake.body[0]] as Position;
        
        switch (snake.direction) {
          case 'UP': head[1] -= 1; break;
          case 'DOWN': head[1] += 1; break;
          case 'LEFT': head[0] -= 1; break;
          case 'RIGHT': head[0] += 1; break;
        }

        // Check collisions with walls
        if (head[0] < 0 || head[0] >= GRID_WIDTH || head[1] < 0 || head[1] >= GRID_HEIGHT) {
          newState.isRunning = false;
          return snake;
        }

        const newBody = [head];
        
        // Check if snake ate food
        if (head[0] === prev.food[0][0] && head[1] === prev.food[0][1]) {
          newBody.push(...snake.body);
          newFood = [generateFood(newState.snakes)];
          newScores[snakeIndex] += 1;
        } else {
          newBody.push(...snake.body.slice(0, -1));
        }

        return { ...snake, body: newBody };
      });

      // Update food and scores
      newState.food = newFood;
      newState.scores = newScores;

      // Check collisions between snakes
      const allSegments = newState.snakes.flatMap(snake => snake.body);
      const hasCollision = allSegments.some((segment, index) => {
        return allSegments.some((otherSegment, otherIndex) => {
          return index !== otherIndex && 
                 segment[0] === otherSegment[0] && 
                 segment[1] === otherSegment[1];
        });
      });

      if (hasCollision) {
        newState.isRunning = false;
      }

      return newState;
    });
  }, []);

  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...createInitialState(),
      speed: prev.speed,
      snakeColors: prev.snakeColors,
      isRunning: true
    }));
  }, []);

  return (
    <GameContext.Provider value={{ gameState, startGame, updateGame, updateSettings, addFoodPosition }}>
      {children}
    </GameContext.Provider>
  );
};