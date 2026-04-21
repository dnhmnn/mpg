import { useRef } from 'react'

interface SigCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
}

export default function SigCanvas({ canvasRef }: SigCanvasProps) {
  const drawing = useRef(false)

  function getXY(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const sx = c.width / r.width
    const sy = c.height / r.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy }
    }
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
  }

  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    const p = getXY(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = getXY(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function stop() { drawing.current = false }

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={150}
      style={{
        width: '100%', height: '100px',
        border: '1px solid var(--border)', borderRadius: '8px',
        touchAction: 'none', background: '#fff', cursor: 'crosshair', display: 'block'
      }}
      onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
    />
  )
}
