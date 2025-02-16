import React, { useEffect, useRef, useContext, useState } from 'react';
import { GameContext } from '../context/GameContext';
import { Play } from 'lucide-react';

export const GameBoard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { gameState, startGame, updateGame, setFoodPosition } = useContext(GameContext);
  const [cellSize, setCellSize] = useState(0);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      // Dynamically calculate cellSize based on the container dimensions
      setCellSize(Math.min(canvas.width / 40, canvas.height / 30));
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (!gameState.isRunning) return;
      setIsMouseDown(true);
      handleMouseMove(e); // Initial food placement
    };

    const handleMouseUp = () => {
      setIsMouseDown(false);
      setMousePosition(null);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!gameState.isRunning || !isMouseDown) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / cellSize);
      const y = Math.floor((e.clientY - rect.top) / cellSize);

      // Ensure click is within grid bounds
      if (x >= 0 && x < 40 && y >= 0 && y < 30) {
        setMousePosition([x, y]);
        setFoodPosition([x, y]);
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp); // Global mouse up listener

    const render = () => {
      // Clear canvas with a gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#0a0a0f');
      gradient.addColorStop(1, '#0f0f1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      
      // Vertical lines
      for (let x = 0; x <= canvas.width; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = 0; y <= canvas.height; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw snakes with glow effect
      gameState.snakes.forEach((snake, index) => {
        const colors = [
          { body: gameState.snakeColors[0], glow: gameState.snakeColors[0] },
          { body: gameState.snakeColors[1], glow: gameState.snakeColors[1] }
        ];
        
        // Draw glow
        ctx.shadowColor = colors[index].glow;
        ctx.shadowBlur = 15;
        
        snake.body.forEach(([x, y], i) => {
          ctx.fillStyle = colors[index].body;
          // Head is slightly larger
          const size = i === 0 ? cellSize - 2 : cellSize - 4;
          const offset = i === 0 ? 1 : 2;
          ctx.fillRect(x * cellSize + offset, y * cellSize + offset, size, size);
        });
      });

      // Draw food with pulsing effect
      gameState.food.forEach((foodItem) => {
        const time = Date.now() * 0.005;
        const pulse = Math.sin(time) * 0.2 + 0.8;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 20 * pulse;
        ctx.fillStyle = '#f87171';
        const foodSize = (cellSize - 4) * pulse;
        const foodOffset = (cellSize - foodSize) / 2;
        ctx.fillRect(
          foodItem[0] * cellSize + foodOffset,
          foodItem[1] * cellSize + foodOffset,
          foodSize,
          foodSize
        );
      });

      // Reset shadow
      ctx.shadowBlur = 0;
    };

    const gameLoop = () => {
      if (gameState.isRunning) {
        updateGame();
        render();
      }
    };

    const interval = setInterval(gameLoop, gameState.speed);
    render();

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState, updateGame, setFoodPosition, cellSize]);

  return (
    <div ref={containerRef} className="fixed inset-0 pt-20">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer z-0"
      />
      {!gameState.isRunning && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
          <button
            onClick={startGame}
            className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-bold text-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            <span className="flex items-center gap-2">
              <Play className="w-6 h-6" />
              Start Battle
            </span>
          </button>
        </div>
      )}
    </div>
  );
};