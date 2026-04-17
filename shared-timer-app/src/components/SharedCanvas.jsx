import React, { useRef, useEffect, useState } from 'react';
import { Trash2, Eraser } from 'lucide-react';
import EVENTS from '../../socketEvents.json';

const SharedCanvas = ({ roomState, socket }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentLine, setCurrentLine] = useState(null);
    const [lines, setLines] = useState(() => roomState?.state?.canvasLines || []);
    const lastLineCountRef = useRef(0);

    useEffect(() => {
        setLines(roomState?.state?.canvasLines || []);
        lastLineCountRef.current = roomState?.state?.canvasLines?.length || 0;
    }, [roomState?.id, roomState?.state?.canvasLines]);

    // Redraw only when line data actually changes (not on every timer sync tick)
    useEffect(() => {
        if (lines.length !== lastLineCountRef.current) {
            lastLineCountRef.current = lines.length;
            drawAllLines();
        }
    }, [lines]);

    // Live sync listener for instant strokes
    useEffect(() => {
        if (!socket) return;

        const handleDraw = ({ line }) => {
            if (!canvasRef.current || !line || line.length < 2) return;
            setLines(prev => [...prev, line]);
            const ctx = canvasRef.current.getContext('2d');
            const { width, height } = canvasRef.current;

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(line[0].x * width, line[0].y * height);
            for (let i = 1; i < line.length; i++) {
                ctx.lineTo(line[i].x * width, line[i].y * height);
            }
            ctx.stroke();
        };

        const handleClear = () => {
            setLines([]);
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        };

        socket.on(EVENTS.DRAW_LINE, handleDraw);
        socket.on(EVENTS.CLEAR_CANVAS, handleClear);

        return () => {
            socket.off(EVENTS.DRAW_LINE, handleDraw);
            socket.off(EVENTS.CLEAR_CANVAS, handleClear);
        };
    }, [socket]);

    // Handle Resize
    useEffect(() => {
        const resizeCanvas = () => {
            if (canvasRef.current && containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                canvasRef.current.width = width;
                canvasRef.current.height = height;
                drawAllLines();
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [lines]);

    const getMousePos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        // Calculate relative coordinates (0.0 to 1.0) for responsive scaling across different screens
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
        };
    };

    const startDrawing = (e) => {
        setIsDrawing(true);
        const pos = getMousePos(e);
        setCurrentLine([pos]);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const pos = getMousePos(e);
        setCurrentLine(prev => [...prev, pos]);

        // Draw the line segment locally for immediate feedback
        const ctx = canvasRef.current.getContext('2d');
        const rect = canvasRef.current.getBoundingClientRect();

        ctx.strokeStyle = 'var(--accent-primary)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        // Move to previous point
        const prev = currentLine[currentLine.length - 1];
        ctx.moveTo(prev.x * rect.width, prev.y * rect.height);
        // Draw to new point
        ctx.lineTo(pos.x * rect.width, pos.y * rect.height);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        if (currentLine && currentLine.length > 1) {
            socket.emit(EVENTS.DRAW_LINE, { roomId: roomState.id, line: currentLine });
        }
        setCurrentLine(null);
    };

    const drawAllLines = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;

        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = '#ffffff'; // The synced lines are white
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        lines.forEach(line => {
            if (line.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(line[0].x * width, line[0].y * height);
            for (let i = 1; i < line.length; i++) {
                ctx.lineTo(line[i].x * width, line[i].y * height);
            }
            ctx.stroke();
        });
    };

    const clearCanvas = () => {
        socket.emit(EVENTS.CLEAR_CANVAS, { roomId: roomState.id });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Scribble Space</h4>
                <button className="btn-ghost alert" style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }} onClick={clearCanvas}>
                    <Eraser size={12} /> Clear
                </button>
            </div>

            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'crosshair'
                }}
            >
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                />
            </div>
        </div>
    );
};

export default SharedCanvas;
