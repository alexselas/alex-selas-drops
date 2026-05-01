import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Check, X, RotateCcw } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  shape?: 'circle' | 'square' | 'banner';
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}

export default function ImageCropper({ imageUrl, shape = 'circle', onCrop, onCancel }: ImageCropperProps) {
  const W = shape === 'banner' ? Math.min(600, typeof window !== 'undefined' ? window.innerWidth - 40 : 560) : 300;
  const H = shape === 'banner' ? Math.round(W * 720 / 1920) : 300;

  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgKey, setImgKey] = useState(0);

  // Reset everything when imageUrl changes
  useEffect(() => {
    setNaturalW(0);
    setNaturalH(0);
    setZoom(1);
    setMinZoom(1);
    setPos({ x: 0, y: 0 });
    setImgKey(k => k + 1);
  }, [imageUrl]);

  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalW(w);
    setNaturalH(h);
    const fit = Math.max(W / w, H / h);
    setMinZoom(fit);
    setZoom(fit);
    setPos({ x: 0, y: 0 });
  }, [W, H]);

  const clampPos = useCallback((x: number, y: number, z: number) => {
    const scaledW = naturalW * z;
    const scaledH = naturalH * z;
    const maxX = Math.max(0, (scaledW - W) / 2);
    const maxY = Math.max(0, (scaledH - H) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, [naturalW, naturalH]);

  // Pointer drag
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setPos(prev => clampPos(prev.x + dx, prev.y + dy, zoom));
  }, [zoom, clampPos]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Mouse wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(prev => {
      const next = Math.max(minZoom, Math.min(minZoom * 5, prev + delta));
      setPos(p => clampPos(p.x, p.y, next));
      return next;
    });
  }, [minZoom, clampPos]);

  // Slider zoom
  const handleZoomChange = useCallback((val: number) => {
    setZoom(val);
    setPos(prev => clampPos(prev.x, prev.y, val));
  }, [clampPos]);

  // Reset
  const handleReset = () => {
    setZoom(minZoom);
    setPos({ x: 0, y: 0 });
  };

  // Crop to canvas
  const handleCrop = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    const outW = shape === 'banner' ? 1920 : 512;
    const outH = shape === 'banner' ? 720 : 512;
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    const ratioX = outW / W;
    const ratioY = outH / H;
    const drawW2 = naturalW * zoom * ratioX;
    const drawH2 = naturalH * zoom * ratioY;
    const drawX = (outW - naturalW * zoom * ratioX) / 2 + pos.x * ratioX;
    const drawY = (outH - naturalH * zoom * ratioY) / 2 + pos.y * ratioY;

    ctx.drawImage(img, drawX, drawY, drawW2, drawH2);

    canvas.toBlob(blob => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.95);
  };

  const borderRadius = shape === 'circle' ? '50%' : shape === 'banner' ? 16 : 16;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center gap-5 px-4">
      <p className="text-zinc-400 text-sm">Arrastra para mover · Slider o rueda para zoom</p>

      {/* Crop area */}
      <div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none border-[3px] border-yellow-400/40"
        style={{ width: W, height: H, borderRadius, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        <img
          key={imgKey}
          ref={imgRef}
          src={imageUrl}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          onLoad={handleImgLoad}
          style={{
            position: 'absolute',
            width: naturalW * zoom,
            height: naturalH * zoom,
            left: (W - naturalW * zoom) / 2 + pos.x,
            top: (H - naturalH * zoom) / 2 + pos.y,
            pointerEvents: 'none',
            userSelect: 'none',
            maxWidth: 'none',
          }}
        />

        {/* Grid */}
        <svg className="absolute inset-0 pointer-events-none" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          <line x1={W / 3} y1={0} x2={W / 3} y2={H} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          <line x1={W * 2 / 3} y1={0} x2={W * 2 / 3} y2={H} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          <line x1={0} y1={H / 3} x2={W} y2={H / 3} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          <line x1={0} y1={H * 2 / 3} x2={W} y2={H * 2 / 3} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          <circle cx={W / 2} cy={H / 2} r={3} fill="rgba(250,204,21,0.5)" />
        </svg>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-3 w-72">
        <button onClick={() => handleZoomChange(Math.max(minZoom, zoom - 0.1))} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <ZoomOut className="w-4 h-4" />
        </button>
        <input
          type="range"
          min={minZoom}
          max={minZoom * 5}
          step={0.01}
          value={zoom}
          onChange={e => handleZoomChange(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-700 accent-yellow-400 cursor-pointer"
        />
        <button onClick={() => handleZoomChange(Math.min(minZoom * 5, zoom + 0.1))} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors text-sm"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        <button
          onClick={handleCrop}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] transition-transform text-sm"
        >
          <Check className="w-4 h-4" />
          Confirmar
        </button>
      </div>
    </div>
  );
}
