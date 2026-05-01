import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Eye, EyeOff, RotateCcw, ChevronUp, ChevronDown, Video } from 'lucide-react';
import { motion } from 'motion/react';
import type { Track } from '../types';

const CW = 1080, CH = 1920, SNAP = 15;

interface StoryEl {
  id: string; type: 'image' | 'text';
  x: number; y: number; w: number; h: number; content: string;
  fontSize?: number; color?: string; fontWeight?: string; fontFamily?: string;
  src?: string; borderRadius?: number; locked?: boolean;
}
interface DragInfo {
  type: 'move' | 'resize'; elId: string;
  startMouseX: number; startMouseY: number;
  origX: number; origY: number; origW: number; origH: number;
  origFontSize?: number; handle: string;
}

const BG_COLORS = [
  { color: '#7c3aed', label: 'Violeta' }, { color: '#2563eb', label: 'Azul' },
  { color: '#0891b2', label: 'Cyan' }, { color: '#059669', label: 'Verde' },
  { color: '#FACC15', label: 'Amarillo' }, { color: '#f97316', label: 'Naranja' },
  { color: '#ef4444', label: 'Rojo' }, { color: '#ec4899', label: 'Rosa' },
  { color: '#6366f1', label: 'Indigo' }, { color: '#1e1e1e', label: 'Gris' },
];
const TEXT_COLORS = ['#ffffff', '#FACC15', '#000000', '#a1a1aa', '#71717a', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ec4899'];
const FONTS = [
  { value: 'Inter, sans-serif', label: 'Inter' }, { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Arial Black, sans-serif', label: 'Arial Black' }, { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Courier New, monospace', label: 'Courier' },
];
const LABELS: Record<string, string> = {
  brand: 'MUSICDROP', sub: 'by 360DJAcademy', cover: 'Portada',
  authors: 'Artistas originales', title: 'T\u00edtulo', meta: 'BPM / Duraci\u00f3n',
  quality: 'Calidad audio', link: 'Enlace', web: 'Web',
};

function fmtDuration(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function getDominantColor(img: HTMLImageElement): string | null {
  try {
    const c = document.createElement('canvas'); c.width = 50; c.height = 50;
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0, 50, 50);
    const d = ctx.getImageData(0, 0, 50, 50).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i+1] + d[i+2]) / 3;
      if (l > 25 && l < 230) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
    }
    if (!n) return null;
    r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
    const f = Math.min(255 / Math.max(r,g,b,1), 1.4);
    r = Math.min(255, Math.round(r*f)); g = Math.min(255, Math.round(g*f)); b = Math.min(255, Math.round(b*f));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch { return null; }
}

function makeDefaults(track: Track): StoryEl[] {
  const meta: string[] = [];
  if (track.bpm > 0) meta.push(`${track.bpm} BPM`);
  if (track.duration > 0) meta.push(fmtDuration(track.duration));
  return [
    { id: 'brand', type: 'text', x: 90, y: 55, w: 900, h: 100, content: 'MUSICDROP', fontSize: 88, color: '#ffffff', fontWeight: '400', fontFamily: 'Impact, sans-serif', locked: true },
    { id: 'sub', type: 'text', x: 290, y: 160, w: 500, h: 40, content: 'by 360DJAcademy', fontSize: 28, color: '#d4d4d8', fontWeight: '500', fontFamily: 'Inter, sans-serif', locked: true },
    { id: 'cover', type: 'image', x: 165, y: 240, w: 750, h: 750, content: 'Cover', src: track.coverUrl, borderRadius: 18 },
    { id: 'authors', type: 'text', x: 90, y: 1025, w: 900, h: 55, content: track.authors || '', fontSize: 34, color: '#ffffff', fontWeight: '500', fontFamily: 'Inter, sans-serif' },
    { id: 'title', type: 'text', x: 90, y: 1090, w: 900, h: 80, content: track.title, fontSize: 50, color: '#ffffff', fontWeight: '400', fontFamily: 'Impact, sans-serif' },
    { id: 'meta', type: 'text', x: 290, y: 1185, w: 500, h: 40, content: meta.join('  ·  '), fontSize: 24, color: '#a1a1aa', fontWeight: '400', fontFamily: 'Inter, sans-serif' },
    { id: 'quality', type: 'text', x: 190, y: 1235, w: 700, h: 35, content: 'Preview \u00b7 Calidad completa en musicdrop.es', fontSize: 18, color: '#71717a', fontWeight: '400', fontFamily: 'Inter, sans-serif' },
    { id: 'link', type: 'text', x: 240, y: 1480, w: 600, h: 50, content: 'Pega aqu\u00ed tu enlace', fontSize: 22, color: '#a1a1aa', fontWeight: '400', fontFamily: 'Inter, sans-serif' },
    { id: 'web', type: 'text', x: 240, y: 1800, w: 600, h: 40, content: 'www.musicdrop.es', fontSize: 26, color: '#d4d4d8', fontWeight: '500', fontFamily: 'Inter, sans-serif' },
  ];
}

/* ─── Render story to canvas (skips 'link' element) ─── */
export async function renderStoryCanvas(elements: StoryEl[], bgColor: string, loadedImages: Record<string, HTMLImageElement>): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = CH;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, CH);
  grad.addColorStop(0, bgColor); grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, CW, CH);

  // Diamond mosaic texture overlay
  drawDiamondTexture(ctx, CW, CH);

  for (const el of elements) {
    if (el.id === 'link' || el.id === 'quality') continue; // Never render in export

    if (el.type === 'image' && el.src) {
      let img = loadedImages[el.src];
      if (!img) { const proxied = el.src!.includes('r2.dev') ? `/api/proxy-image?url=${encodeURIComponent(el.src!)}` : el.src!; img = await new Promise<HTMLImageElement>(res => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(i); i.src = proxied; }); }
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        if (el.borderRadius) { ctx.beginPath(); ctx.roundRect(el.x, el.y, el.w, el.h, el.borderRadius); ctx.clip(); }
        ctx.drawImage(img, el.x, el.y, el.w, el.h); ctx.restore();
      }
    } else if (el.type === 'text' && el.content) {
      const fs = el.fontSize || 40;
      ctx.fillStyle = el.color || '#ffffff';
      ctx.font = `${el.fontWeight || '400'} ${fs}px ${el.fontFamily || 'Inter, Arial, sans-serif'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 3;
      const lines = wrapText(ctx, el.content, el.w - 20);
      const lineH = fs * 1.25;
      const totalH = lines.length * lineH;
      const startY = el.y + (el.h - totalH) / 2 + lineH / 2;
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], el.x + el.w / 2, startY + i * lineH);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
  }
  return new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));
}

/* ─── Component ─── */
interface StoryEditorProps {
  track: Track;
  onClose: () => void;
  onGenerate: (imageBlob: Blob) => void;
}

export default function StoryEditor({ track, onClose, onGenerate }: StoryEditorProps) {
  const [elements, setElements] = useState<StoryEl[]>(() => makeDefaults(track));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [scale, setScale] = useState(0.35);
  const [bgColor, setBgColor] = useState('#7c3aed');
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [rendering, setRendering] = useState(false);

  const selected = elements.find(el => el.id === selectedId) || null;
  const isDragging = dragInfo !== null;

  useEffect(() => {
    const update = () => {
      const vh = window.innerHeight - 100;
      const vw = window.innerWidth < 768 ? window.innerWidth - 32 : window.innerWidth * 0.58;
      setScale(Math.min(vh / CH, vw / CW, 0.55));
    };
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!track.coverUrl) return;
    // Proxy R2 images to avoid CORS canvas tainting
    const proxiedUrl = track.coverUrl.includes('r2.dev')
      ? `/api/proxy-image?url=${encodeURIComponent(track.coverUrl)}`
      : track.coverUrl;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLoadedImages(prev => ({ ...prev, [track.coverUrl]: img }));
      const c = getDominantColor(img); if (c) setBgColor(c);
    };
    img.src = proxiedUrl;
  }, [track.coverUrl]);

  const guides = useMemo(() => {
    if (!selectedId || previewMode) return { vCenter: false, hCenter: false };
    const el = elements.find(e => e.id === selectedId);
    if (!el || el.locked) return { vCenter: false, hCenter: false };
    return { vCenter: Math.abs(el.x + el.w/2 - CW/2) < SNAP, hCenter: Math.abs(el.y + el.h/2 - CH/2) < SNAP };
  }, [elements, selectedId, previewMode]);

  useEffect(() => {
    if (!dragInfo) return;
    const onMove = (cx: number, cy: number) => {
      const dx = (cx - dragInfo.startMouseX) / scale, dy = (cy - dragInfo.startMouseY) / scale;
      setElements(prev => prev.map(el => {
        if (el.id !== dragInfo.elId) return el;
        if (dragInfo.type === 'move') {
          let nx = dragInfo.origX+dx, ny = dragInfo.origY+dy;
          if (Math.abs((nx+el.w/2)-CW/2)<SNAP) nx=CW/2-el.w/2;
          if (Math.abs((ny+el.h/2)-CH/2)<SNAP) ny=CH/2-el.h/2;
          return { ...el, x: nx, y: ny };
        }
        const {origX,origY,origW,origH,handle}=dragInfo;
        let x=origX,y=origY,w=origW,h=origH;
        if(handle.includes('e'))w+=dx;if(handle.includes('w')){x+=dx;w-=dx;}
        if(handle.includes('s'))h+=dy;if(handle.includes('n')){y+=dy;h-=dy;}
        if(el.type==='image'&&origW>0&&origH>0){const r=origH/origW;h=w*r;if(handle.includes('n'))y=origY+origH-h;}
        if(w<40){if(handle.includes('w'))x=origX+origW-40;w=40;}
        if(h<30){if(handle.includes('n'))y=origY+origH-30;h=30;}
        const u:StoryEl={...el,x,y,w,h};
        if(el.type==='text'&&dragInfo.origFontSize&&origH>0)u.fontSize=Math.max(10,Math.round(dragInfo.origFontSize*(h/origH)));
        return u;
      }));
    };
    const mm=(e:MouseEvent)=>onMove(e.clientX,e.clientY);
    const tm=(e:TouchEvent)=>{e.preventDefault();if(e.touches[0])onMove(e.touches[0].clientX,e.touches[0].clientY);};
    const end=()=>setDragInfo(null);
    window.addEventListener('mousemove',mm);window.addEventListener('mouseup',end);
    window.addEventListener('touchmove',tm,{passive:false});window.addEventListener('touchend',end);
    return()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',end);window.removeEventListener('touchmove',tm);window.removeEventListener('touchend',end);};
  }, [dragInfo, scale]);

  useEffect(() => {
    const h=(e:KeyboardEvent)=>{
      if(!selectedId||previewMode)return;
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;
      const el=elements.find(x=>x.id===selectedId);if(!el||el.locked)return;
      const s=e.shiftKey?20:5;let dx=0,dy=0;
      switch(e.key){case'ArrowUp':dy=-s;break;case'ArrowDown':dy=s;break;case'ArrowLeft':dx=-s;break;case'ArrowRight':dx=s;break;case'Escape':setSelectedId(null);return;default:return;}
      e.preventDefault();
      setElements(prev=>prev.map(el2=>el2.id===selectedId?{...el2,x:el2.x+dx,y:el2.y+dy}:el2));
    };
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  }, [selectedId, previewMode, elements]);

  const startDrag=(e:React.MouseEvent|React.TouchEvent,elId:string,type:'move'|'resize'='move',handle='')=>{
    e.stopPropagation();e.preventDefault();if(previewMode)return;
    const el=elements.find(x=>x.id===elId)!;setSelectedId(elId);if(el.locked)return;
    const cx='touches' in e?e.touches[0].clientX:e.clientX,cy='touches' in e?e.touches[0].clientY:e.clientY;
    setDragInfo({type,elId,handle,startMouseX:cx,startMouseY:cy,origX:el.x,origY:el.y,origW:el.w,origH:el.h,origFontSize:el.fontSize});
  };

  const updateEl=(id:string,u:Partial<StoryEl>)=>setElements(prev=>prev.map(el=>el.id===id?{...el,...u}:el));

  const handleGenerate = useCallback(async () => {
    setRendering(true);
    try {
      const blob = await renderStoryCanvas(elements, bgColor, loadedImages);
      onGenerate(blob);
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      setRendering(false);
    }
  }, [elements, bgColor, loadedImages, onGenerate]);

  const canvasW = CW * scale, canvasH = CH * scale;
  const HANDLES = [
    {key:'nw',style:{top:-5,left:-5,cursor:'nwse-resize'}},{key:'ne',style:{top:-5,right:-5,cursor:'nesw-resize'}},
    {key:'sw',style:{bottom:-5,left:-5,cursor:'nesw-resize'}},{key:'se',style:{bottom:-5,right:-5,cursor:'nwse-resize'}},
  ];

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 flex-shrink-0">
        <h2 className="text-base font-bold text-zinc-100 tracking-wide">Crear Historia de Instagram</h2>
        <div className="flex items-center gap-2">
          <button onClick={()=>setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${previewMode?'bg-yellow-400/20 text-yellow-400':'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            {previewMode?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}
            {previewMode?'Editar':'Preview'}
          </button>
          <button onClick={onClose} className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
        </div>
      </div>
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto"
          onMouseDown={(e)=>{if(e.target===e.currentTarget||(e.target as HTMLElement).dataset.canvasBg==='true')setSelectedId(null);}}>
          <div data-canvas-bg="true" style={{width:canvasW,height:canvasH,background:`linear-gradient(to bottom, ${bgColor}, #000000)`}}
            className="relative flex-shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black/50 select-none">
            {/* Diamond mosaic texture overlay */}
            <div className="absolute inset-0 pointer-events-none z-[1]" style={{
              backgroundImage: [
                'linear-gradient(30deg, rgba(255,255,255,0.035) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.035) 87.5%)',
                'linear-gradient(150deg, rgba(255,255,255,0.035) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.035) 87.5%)',
                'linear-gradient(30deg, rgba(255,255,255,0.035) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.035) 87.5%)',
                'linear-gradient(150deg, rgba(255,255,255,0.035) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.035) 87.5%)',
                'linear-gradient(60deg, rgba(255,255,255,0.025) 25%, transparent 25.5%, transparent 75%, rgba(255,255,255,0.025) 75%)',
                'linear-gradient(60deg, rgba(255,255,255,0.025) 25%, transparent 25.5%, transparent 75%, rgba(255,255,255,0.025) 75%)',
              ].join(','),
              backgroundSize: `${60*scale}px ${104*scale}px`,
              backgroundPosition: `0 0, 0 0, ${30*scale}px ${52*scale}px, ${30*scale}px ${52*scale}px, 0 0, ${30*scale}px ${52*scale}px`,
            }}/>
            {guides.vCenter&&<div className="absolute top-0 bottom-0 w-px z-[60] pointer-events-none" style={{left:(CW/2)*scale,background:'rgba(0,200,255,0.6)'}}/>}
            {guides.hCenter&&<div className="absolute left-0 right-0 h-px z-[60] pointer-events-none" style={{top:(CH/2)*scale,background:'rgba(0,200,255,0.6)'}}/>}
            {elements.map(el=>{
              const isSel=selectedId===el.id&&!previewMode;
              const isBeingDragged=isDragging&&dragInfo?.elId===el.id;
              return(
                <div key={el.id} onMouseDown={(e)=>startDrag(e,el.id)} onTouchStart={(e)=>startDrag(e,el.id)} onClick={(e)=>e.stopPropagation()}
                  style={{position:'absolute',left:el.x*scale,top:el.y*scale,width:el.w*scale,height:el.h*scale,
                    cursor:previewMode?'default':el.locked?'pointer':'move',zIndex:isSel?50:undefined,
                    pointerEvents:isDragging&&!isBeingDragged?'none':undefined}}
                  className={isSel?(el.locked?'ring-2 ring-yellow-400/60':'ring-2 ring-blue-500/80'):''}>
                  {el.type==='image'&&el.src&&(
                    <img src={el.src.includes('r2.dev') ? `/api/proxy-image?url=${encodeURIComponent(el.src)}` : el.src} className="w-full h-full object-cover pointer-events-none select-none"
                      style={{borderRadius:el.borderRadius?el.borderRadius*scale:0}} draggable={false} crossOrigin="anonymous"/>
                  )}
                  {el.type==='text'&&el.content&&el.id==='link'&&(
                    <div className="w-full h-full flex items-center justify-center pointer-events-none select-none"
                      style={{borderRadius:25*scale,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}}>
                      <span style={{fontSize:(el.fontSize||22)*scale,color:el.color||'#a1a1aa',fontWeight:el.fontWeight||'400',fontFamily:el.fontFamily||'Inter, sans-serif'}}>{el.content}</span>
                    </div>
                  )}
                  {el.type==='text'&&el.content&&el.id!=='link'&&(
                    <div className="w-full h-full flex items-center justify-center pointer-events-none select-none text-center leading-tight"
                      style={{fontSize:(el.fontSize||40)*scale,color:el.color||'#ffffff',fontWeight:el.fontWeight||'400',fontFamily:el.fontFamily||'Inter, sans-serif',textShadow:'0 2px 8px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)'}}>
                      {el.content}
                    </div>
                  )}
                  {isSel&&!el.locked&&HANDLES.map(({key,style})=>(
                    <div key={key} onMouseDown={(e)=>startDrag(e,el.id,'resize',key)} onTouchStart={(e)=>startDrag(e,el.id,'resize',key)}
                      className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-sm shadow-md" style={{...style,position:'absolute'}}/>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-zinc-800/60 flex flex-col flex-shrink-0 bg-zinc-950/50">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Color de fondo</h3>
              <div className="flex flex-wrap gap-1.5">
                {BG_COLORS.map(({color,label})=>(
                  <button key={color} onClick={()=>setBgColor(color)} title={label}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${bgColor===color?'border-white scale-110 shadow-lg':'border-zinc-700 hover:border-zinc-500'}`}
                    style={{background:`linear-gradient(to bottom, ${color}, #000)`}}/>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">Auto-detectado de la portada</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Elementos</h3>
              <div className="space-y-1">
                {elements.map(el=>(
                  <div key={el.id} onClick={()=>!previewMode&&setSelectedId(el.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                      selectedId===el.id?el.locked?'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30':'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      :'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'}`}>
                    <span className="truncate font-medium">{LABELS[el.id]||el.id}</span>
                    {el.locked&&<span className="ml-auto text-[10px] text-zinc-600 flex-shrink-0">fijo</span>}
                  </div>
                ))}
              </div>
            </div>
            {selected&&!previewMode&&(
              <div className="space-y-4 pt-3 border-t border-zinc-800/60">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{LABELS[selected.id]||selected.id}</h3>
                {selected.locked&&selected.type==='text'&&(
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5">Color</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TEXT_COLORS.map(c=>(<button key={c} onClick={()=>updateEl(selected.id,{color:c})}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${selected.color===c?'border-white scale-110':'border-zinc-700 hover:border-zinc-500'}`}
                        style={{backgroundColor:c}}/>))}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-2">Posicion fija. Solo puedes cambiar el color.</p>
                  </div>
                )}
                {!selected.locked&&selected.type==='text'&&(
                  <>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Tamano: {selected.fontSize||40}px</label>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>updateEl(selected.id,{fontSize:Math.max(10,(selected.fontSize||40)-2)})} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"><ChevronDown className="w-4 h-4"/></button>
                        <input type="range" min={10} max={120} value={selected.fontSize||40} onChange={(e)=>updateEl(selected.id,{fontSize:Number(e.target.value)})} className="flex-1 accent-yellow-400"/>
                        <button onClick={()=>updateEl(selected.id,{fontSize:Math.min(120,(selected.fontSize||40)+2)})} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"><ChevronUp className="w-4 h-4"/></button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Color del texto</label>
                      <div className="flex flex-wrap gap-1.5">
                        {TEXT_COLORS.map(c=>(<button key={c} onClick={()=>updateEl(selected.id,{color:c})}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${selected.color===c?'border-white scale-110':'border-zinc-700 hover:border-zinc-500'}`}
                          style={{backgroundColor:c}}/>))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Tipo de letra</label>
                      <select value={selected.fontFamily||'Inter, sans-serif'} onChange={(e)=>updateEl(selected.id,{fontFamily:e.target.value})}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-yellow-400/50 appearance-none cursor-pointer">
                        {FONTS.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Peso</label>
                      <div className="flex gap-1">
                        {([['400','Normal'],['500','Medium'],['bold','Bold']] as const).map(([val,label])=>(
                          <button key={val} onClick={()=>updateEl(selected.id,{fontWeight:val})}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${selected.fontWeight===val?'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30':'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {!selected.locked&&selected.type==='image'&&(<p className="text-xs text-zinc-500">Arrastra para mover. Esquinas para redimensionar.</p>)}
                {!selected.locked&&(<p className="text-[11px] text-zinc-600">Flechas = mover (Shift = rapido). Guia cyan = centrado.</p>)}
              </div>
            )}
            {!selected&&!previewMode&&(<p className="text-xs text-zinc-500 pt-3 border-t border-zinc-800/60">Haz clic en un elemento del canvas o de la lista para seleccionarlo.</p>)}
          </div>
          <div className="p-4 border-t border-zinc-800/60 space-y-2 flex-shrink-0">
            <button onClick={()=>{setElements(makeDefaults(track));setSelectedId(null);}}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors">
              <RotateCcw className="w-4 h-4"/> Resetear posiciones
            </button>
            <button onClick={handleGenerate} disabled={rendering}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl gradient-bg text-black text-sm font-bold shadow-lg glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
              <Video className="w-4 h-4"/> {rendering ? 'Preparando...' : 'Generar Video'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Diamond mosaic texture for canvas export ─── */
function drawDiamondTexture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sw = 80; // diamond width
  const sh = 46; // diamond height (squished for isometric 3D feel)

  for (let row = -1; row < Math.ceil(h / sh) + 1; row++) {
    for (let col = -1; col < Math.ceil(w / sw) + 1; col++) {
      const offsetX = row % 2 === 0 ? 0 : sw / 2;
      const cx = col * sw + offsetX;
      const cy = row * sh;

      // Seeded pseudo-random for consistent subtle variation
      const seed = Math.sin(cx * 0.1 + cy * 0.13) * Math.cos(cx * 0.07 - cy * 0.11);
      const rand = Math.abs(seed);
      const opacity = 0.015 + rand * 0.035;

      // Diamond fill
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy - sh / 2);
      ctx.lineTo(cx + sw / 2, cy);
      ctx.lineTo(cx, cy + sh / 2);
      ctx.lineTo(cx - sw / 2, cy);
      ctx.closePath();
      ctx.fill();

      // Subtle top-edge highlight for 3D effect
      if (rand > 0.3) {
        ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.6})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - sw / 2, cy);
        ctx.lineTo(cx, cy - sh / 2);
        ctx.lineTo(cx + sw / 2, cy);
        ctx.stroke();
      }
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if(maxWidth<=0)return[text];const words=text.split(' ');const lines:string[]=[];let current='';
  for(const word of words){const test=current?`${current} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&current){lines.push(current);current=word;}else current=test;}
  if(current)lines.push(current);return lines.length?lines:[text];
}
