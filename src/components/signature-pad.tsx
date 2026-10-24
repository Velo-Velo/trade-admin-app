"use client";

import { useEffect, useRef, useState } from "react";

export function SignaturePad({ inputName = "signaturePng" }: { inputName?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    context.scale(ratio, ratio);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#16181d";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function commit() {
    const canvas = canvasRef.current;
    if (!canvas || !hiddenRef.current || empty) return;
    hiddenRef.current.value = canvas.toDataURL("image/png");
  }

  return (
    <div className="grid gap-2">
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-md border border-sand bg-white"
        aria-label="Signature"
        onPointerDown={(event) => {
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!canvas || !context) return;
          canvas.setPointerCapture(event.pointerId);
          drawing.current = true;
          const here = point(event);
          context.beginPath();
          context.moveTo(here.x, here.y);
          setEmpty(false);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const context = canvasRef.current?.getContext("2d");
          if (!context) return;
          const here = point(event);
          context.lineTo(here.x, here.y);
          context.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          commit();
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <input ref={hiddenRef} type="hidden" name={inputName} />
      <button
        type="button"
        className="justify-self-start text-sm font-semibold text-muted"
        onClick={() => {
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!canvas || !context) return;
          context.clearRect(0, 0, canvas.width, canvas.height);
          if (hiddenRef.current) hiddenRef.current.value = "";
          setEmpty(true);
        }}
      >
        Clear signature
      </button>
    </div>
  );
}
