import React, { useState, useEffect, useRef } from 'react'

// Interactive Crop Profile Photo Modal (137x136 Aspect Ratio, Touch & Mouse Drag Enabled)
export default function PhotoCropModal({ imageSrc, isOpen, onClose, onSave }) {
  const canvasRef = useRef(null)
  const cropBoxRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const stateRef = useRef({
    img: null,
    imgX: 0,
    imgY: 0,
    baseScale: 1,
    zoom: 1,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isPinching: false,
    pinchStartDist: 0,
    pinchStartZoom: 1,
  })

  const CROP_BOX_W = 190
  const CROP_BOX_H = 188.6 // exact 137x136 proportion

  // Lock background page scroll while photo cropper modal is open
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    const prevTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouchAction
    }
  }, [isOpen])

  const clampPosition = (img, imgX, imgY, baseScale, currentZoom) => {
    const currentScale = baseScale * currentZoom
    const drawW = img.width * currentScale
    const drawH = img.height * currentScale
    const boxLeft = (360 - CROP_BOX_W) / 2
    const boxTop = (310 - CROP_BOX_H) / 2
    const boxRight = boxLeft + CROP_BOX_W
    const boxBottom = boxTop + CROP_BOX_H

    let newX = imgX
    let newY = imgY

    if (drawW >= CROP_BOX_W) {
      if (newX > boxLeft) newX = boxLeft
      if (newX + drawW < boxRight) newX = boxRight - drawW
    } else {
      newX = (360 - drawW) / 2
    }

    if (drawH >= CROP_BOX_H) {
      if (newY > boxTop) newY = boxTop
      if (newY + drawH < boxBottom) newY = boxBottom - drawH
    } else {
      newY = (310 - drawH) / 2
    }

    return { x: newX, y: newY }
  }

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !stateRef.current.img) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const { img, imgX, imgY, baseScale, zoom: currentZoom } = stateRef.current
    const currentScale = baseScale * currentZoom
    ctx.drawImage(img, imgX, imgY, img.width * currentScale, img.height * currentScale)
  }

  useEffect(() => {
    if (!isOpen || !imageSrc) return
    const img = new Image()
    img.onload = () => {
      const scaleW = CROP_BOX_W / img.width
      const scaleH = CROP_BOX_H / img.height
      const baseScale = Math.max(scaleW, scaleH)
      const currentZoom = 1

      let imgX = (360 - img.width * baseScale) / 2
      let imgY = (310 - img.height * baseScale) / 2
      const clamped = clampPosition(img, imgX, imgY, baseScale, currentZoom)

      stateRef.current = {
        img,
        imgX: clamped.x,
        imgY: clamped.y,
        baseScale,
        zoom: currentZoom,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        isPinching: false,
        pinchStartDist: 0,
        pinchStartZoom: 1,
      }
      setZoom(1)
      drawCanvas()
    }
    img.src = imageSrc
  }, [isOpen, imageSrc])

  const handleZoom = (val) => {
    const newZoom = parseFloat(val)
    setZoom(newZoom)
    const oldZoom = stateRef.current.zoom
    stateRef.current.zoom = newZoom

    const centerX = 360 / 2
    const centerY = 310 / 2
    const ratio = newZoom / oldZoom

    let newX = centerX - (centerX - stateRef.current.imgX) * ratio
    let newY = centerY - (centerY - stateRef.current.imgY) * ratio

    const clamped = clampPosition(stateRef.current.img, newX, newY, stateRef.current.baseScale, newZoom)
    stateRef.current.imgX = clamped.x
    stateRef.current.imgY = clamped.y
    drawCanvas()
  }

  // Touch Event Listeners with non-passive preventDefault so the mobile page NEVER scrolls
  useEffect(() => {
    if (!isOpen) return
    const el = cropBoxRef.current
    if (!el) return

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        stateRef.current.isDragging = true
        stateRef.current.dragStartX = e.touches[0].clientX - stateRef.current.imgX
        stateRef.current.dragStartY = e.touches[0].clientY - stateRef.current.imgY
      } else if (e.touches.length === 2) {
        stateRef.current.isPinching = true
        stateRef.current.pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        stateRef.current.pinchStartZoom = stateRef.current.zoom
      }
    }

    const onTouchMove = (e) => {
      if (e.cancelable) {
        e.preventDefault()
      }
      if (e.touches.length === 1 && stateRef.current.isDragging && stateRef.current.img) {
        const newX = e.touches[0].clientX - stateRef.current.dragStartX
        const newY = e.touches[0].clientY - stateRef.current.dragStartY
        const clamped = clampPosition(stateRef.current.img, newX, newY, stateRef.current.baseScale, stateRef.current.zoom)
        stateRef.current.imgX = clamped.x
        stateRef.current.imgY = clamped.y
        drawCanvas()
      } else if (e.touches.length === 2 && stateRef.current.isPinching) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        const ratio = dist / (stateRef.current.pinchStartDist || 1)
        const nextZoom = Math.min(3, Math.max(1, stateRef.current.pinchStartZoom * ratio))
        handleZoom(nextZoom)
      }
    }

    const onTouchEnd = () => {
      stateRef.current.isDragging = false
      stateRef.current.isPinching = false
    }

    const onWheel = (e) => {
      if (e.cancelable) e.preventDefault()
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      const nextZoom = Math.min(3, Math.max(1, stateRef.current.zoom + delta))
      handleZoom(nextZoom)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [isOpen])

  // Mouse handlers for desktop
  const handleMouseDown = (e) => {
    stateRef.current.isDragging = true
    stateRef.current.dragStartX = e.clientX - stateRef.current.imgX
    stateRef.current.dragStartY = e.clientY - stateRef.current.imgY
  }

  const handleMouseMove = (e) => {
    if (!stateRef.current.isDragging || !stateRef.current.img) return
    const newX = e.clientX - stateRef.current.dragStartX
    const newY = e.clientY - stateRef.current.dragStartY
    const clamped = clampPosition(stateRef.current.img, newX, newY, stateRef.current.baseScale, stateRef.current.zoom)
    stateRef.current.imgX = clamped.x
    stateRef.current.imgY = clamped.y
    drawCanvas()
  }

  const handleMouseUp = () => {
    stateRef.current.isDragging = false
  }

  const handleCropAndSave = () => {
    const { img, imgX, imgY, baseScale, zoom: currentZoom } = stateRef.current
    if (!img) return

    const clamped = clampPosition(img, imgX, imgY, baseScale, currentZoom)
    const boxLeft = (360 - CROP_BOX_W) / 2
    const boxTop = (310 - CROP_BOX_H) / 2

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = 274
    outputCanvas.height = 272
    const outCtx = outputCanvas.getContext('2d')
    outCtx.imageSmoothingEnabled = true
    outCtx.imageSmoothingQuality = 'high'

    const currentScale = baseScale * currentZoom
    let srcX = (boxLeft - clamped.x) / currentScale
    let srcY = (boxTop - clamped.y) / currentScale
    let srcW = CROP_BOX_W / currentScale
    let srcH = CROP_BOX_H / currentScale

    if (srcX < 0) srcX = 0
    if (srcY < 0) srcY = 0
    if (srcX + srcW > img.width) srcW = img.width - srcX
    if (srcY + srcH > img.height) srcH = img.height - srcY

    outCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputCanvas.width, outputCanvas.height)
    const croppedUrl = outputCanvas.toDataURL('image/jpeg', 0.95)
    onSave(croppedUrl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ touchAction: 'none' }}
    >
      <div
        className="bg-[#111827] border border-white/15 rounded-2xl p-4 sm:p-5 max-w-[440px] w-full flex flex-col gap-3.5 shadow-2xl max-h-[96vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base font-['Montserrat']">Crop Profile Photo</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none p-1 cursor-pointer">&times;</button>
        </div>

        {/* Cropper Container with Touch Action None */}
        <div
          ref={cropBoxRef}
          className="relative w-full h-[310px] bg-black rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none flex items-center justify-center touch-none"
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} width={360} height={310} className="block pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="relative rounded-lg border-2 border-white/90 shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]"
              style={{ width: `${CROP_BOX_W}px`, height: `${CROP_BOX_H}px` }}
            >
              {/* 3x3 Grid Lines */}
              <div className="absolute inset-0 border-l border-r border-white/40 left-1/3 right-1/3" />
              <div className="absolute inset-0 border-t border-b border-white/40 top-1/3 bottom-1/3" />
            </div>
          </div>
        </div>

        {/* Helpful Touch Gesture Hint */}
        <p className="text-[11px] text-center text-slate-400 font-medium -mt-1 select-none">
          👆 Drag photo to adjust position • Pinch or slider to zoom
        </p>

        {/* Zoom Controls with + / - Quick Buttons */}
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => handleZoom(Math.max(1, zoom - 0.2))}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">ZOOM</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => handleZoom(e.target.value)}
            className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <button
            type="button"
            onClick={() => handleZoom(Math.min(3, zoom + 0.2))}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Zoom in"
          >
            +
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropAndSave}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 cursor-pointer active:scale-95"
          >
            CROP &amp; SAVE
          </button>
        </div>
      </div>
    </div>
  )
}
