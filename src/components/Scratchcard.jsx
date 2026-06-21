import React, { useRef, useEffect, useState } from 'react';
import { playScratchEffect } from '../utils/soundGenerator';

const Scratchcard = ({ 
  width = 300, 
  height = 300, 
  overlayColor = '#333', 
  brushSize = 30, 
  onComplete, 
  onFieldReveal,
  children,
  threshold = 0.5,
  isMuted = false,
  revealAll = false
}) => {
  const canvasRef = useRef(null);
  const isCompletedRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [revealedMap, setRevealedMap] = useState(new Array(9).fill(false));
  const [isCompleted, setIsCompleted] = useState(false);
  const lastPointRef = useRef(null);

  // Define the 9 areas (3x3 grid)
  const areas = [];
  const cellWidth = width / 3;
  const cellHeight = height / 3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      areas.push({
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight
      });
    }
  }

  // Initial draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, width, height);

    // Visual noise
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.03})`;
        ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }
    
    isCompletedRef.current = false;
    setIsCompleted(false);
    setRevealedMap(new Array(9).fill(false));
  }, [width, height, overlayColor]);

  // Handle programmatic reveal
  useEffect(() => {
    if (revealAll && !isCompletedRef.current && canvasRef.current) {
        completeScratch();
    }
  }, [revealAll]);

  const completeScratch = () => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    setIsCompleted(true);
    setRevealedMap(new Array(9).fill(true));

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      // Force double clear
      setTimeout(() => {
        const ctx2 = canvas.getContext('2d');
        ctx2.clearRect(0, 0, width, height);
      }, 50);
    }

    setTimeout(() => { if (onComplete) onComplete(); }, 200);
  };

  const checkProgress = () => {
    const canvas = canvasRef.current;
    if (!canvas || isCompletedRef.current) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    setRevealedMap(prev => {
        let allDone = true;
        const next = [...prev];
        let anyNewReveal = false;

        areas.forEach((area, idx) => {
          if (next[idx]) return;

          const imgData = ctx.getImageData(area.x, area.y, area.width, area.height);
          const pixels = imgData.data;
          let transparentCount = 0;
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] < 128) transparentCount++; 
          }
          const transparency = transparentCount / (area.width * area.height);

          if (transparency > threshold) {
            next[idx] = true;
            anyNewReveal = true;
            
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillRect(area.x, area.y, area.width, area.height);
            ctx.restore();
            
            if (onFieldReveal) onFieldReveal(idx);
          } else {
            allDone = false;
          }
        });

        if (allDone && !isCompletedRef.current) {
            isCompletedRef.current = true;
            setIsCompleted(true);
            
            // Final clear
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            
            // Force double clear
            setTimeout(() => {
              const ctx2 = canvas.getContext('2d');
              ctx2.clearRect(0, 0, width, height);
            }, 50);

            setTimeout(() => { if (onComplete) onComplete(); }, 200);
        }

        return anyNewReveal ? next : prev;
    });
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleStart = (e) => {
    if (isCompletedRef.current) return;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    lastPointRef.current = { x, y };

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    checkProgress();
  };

  const handleMove = (e) => {
    if (!isDrawing || isCompletedRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { x, y } = getCoordinates(e);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize * 2;
    
    ctx.beginPath();
    if (lastPointRef.current) {
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    } else {
        ctx.moveTo(x, y);
    }
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPointRef.current = { x, y };

    if (!isMuted) playScratchEffect();
    checkProgress();
  };

  return (
    <div style={{ position: 'relative', width, height, userSelect: 'none', touchAction: 'none', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%' }}>
        {children}
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={() => setIsDrawing(false)}
        onMouseLeave={() => setIsDrawing(false)}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={() => setIsDrawing(false)}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          cursor: 'crosshair',
          zIndex: 10
        }}
      />
    </div>
  );
};

export default Scratchcard;
