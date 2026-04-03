import { useEffect, useRef } from 'react'
import { createWatercolorScene, type WatercolorScene } from './watercolor'

export default function WatercolorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<WatercolorScene | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    sceneRef.current = createWatercolorScene(canvasRef.current)
    return () => {
      sceneRef.current?.destroy()
      sceneRef.current = null
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
      }}
    />
  )
}
