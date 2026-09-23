import * as React from "react"
import { TonePinyin } from "@/components/tone-pinyin"
import { speakMandarin } from "@/lib/tts"
import { CardTopBar } from "./card-top-bar"
import { CardHint } from "./card-hint"
import { SwipeFlashcard } from "./types"

type Props = {
  card: SwipeFlashcard
  idx: number
  flip: 0 | 1 | 2
  isDragging: boolean
  dragX: number
  dragY: number
  flyOut: { x: number; y: number } | null
  cardRef: React.RefObject<HTMLDivElement | null>
  onCardClick: () => void
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerCancel: () => void
  onPointerUp: () => void
}

export function FlashcardCard({
  card,
  idx,
  flip,
  isDragging,
  dragX,
  dragY,
  flyOut,
  cardRef,
  onCardClick,
  onPointerDown,
  onPointerMove,
  onPointerCancel,
  onPointerUp
}: Props) {
  let swipeStatus: "none" | "hafal" | "lupa" | "ragu" | "sulit" = "none"
  const absX = Math.abs(dragX)
  const absY = Math.abs(dragY)

  if (isDragging && flip === 2 && (absX > 20 || absY > 20)) {
    if (dragY > absX) swipeStatus = "ragu"
    else if (dragY < -absX) swipeStatus = "sulit"
    else if (absX > dragY) {
      if (dragX > 0) swipeStatus = "hafal"
      else swipeStatus = "lupa"
    }
  }

  const contentOpacity = swipeStatus !== "none" ? 0 : 1
  const cardRotation = dragX * 0.05

  function renderDetailFaceInner() {
    return (
      <>
        <div
          aria-hidden="true"
          className="absolute -right-8 -bottom-10 select-none pointer-events-none font-hanzi text-foreground/[0.07] dark:text-foreground/[0.1]"
          style={{ fontSize: "10rem", lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}
        >
          {card.hanzi}
        </div>
        <CardTopBar card={card} />
        <div className="flex-1 flex flex-col items-center justify-center mt-4">
          <div
            className="font-hanzi text-4xl sm:text-5xl leading-none text-foreground drop-shadow-sm mb-2 cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
            data-no-drag
            onClick={(e) => { e.stopPropagation(); speakMandarin(card.hanzi) }}
          >
            {card.hanzi}
          </div>
          <TonePinyin text={card.pinyin} className="mb-2 text-xl font-sans font-medium drop-shadow-sm" />
          <span className="text-lg font-semibold text-center text-foreground drop-shadow-sm">{card.arti}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-border/40 bg-gradient-to-br from-muted/30 to-muted/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-muted-foreground">CONTOH · penggunaan</div>
          </div>
          {card.exampleSentence ? (
            <>
              <div
                className="text-sm text-foreground mb-1 font-hanzi text-xl cursor-pointer hover:text-primary transition-colors"
                data-no-drag
                onClick={(e) => { e.stopPropagation(); speakMandarin(card.exampleSentence!) }}
              >
                {card.exampleSentence}
              </div>
              {card.examplePinyin && <TonePinyin text={card.examplePinyin || ""} className="text-sm mb-1 font-italic" />}
              <div className="text-sm text-foreground">{card.exampleTranslation}</div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground italic">Belum ada contoh kalimat untuk kata ini</div>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="relative w-full max-w-lg md:max-w-2xl lg:max-w-3xl perspective-[800px]">
      <div className="grid">
        <div aria-hidden="true" className="invisible pointer-events-none flex flex-col p-6 rounded-3xl [grid-area:1/1]">
          {renderDetailFaceInner()}
        </div>

        <div className="relative w-full [grid-area:1/1]">
          <div aria-hidden="true" className="absolute inset-0 rounded-3xl border border-border/30 bg-card/70" style={{ transform: "translate(0px, 22px) scale(0.96)", zIndex: 0 }} />
          <div aria-hidden="true" className="absolute inset-0 rounded-3xl border border-border/20 bg-card/40" style={{ transform: "translate(0px, 40px) scale(0.92)", zIndex: -1 }} />
          
          <div
            key={`${idx}-${card.id}`}
            ref={cardRef}
            className={`absolute inset-0 w-full h-full rounded-3xl border border-border/40 bg-card shadow-2xl flex flex-col transform-style-3d touch-none flashcardCard z-10 ${
              isDragging ? "!transition-none cursor-grabbing" : flyOut ? "transition-all duration-300 ease-out cursor-grabbing" : "transition-transform duration-300 cursor-pointer"
            }`}
            style={{
              transform: flyOut
                ? `translate(${flyOut.x}px, ${flyOut.y}px) rotate(${flyOut.x * 0.05}deg) rotateY(360deg)`
                : isDragging
                  ? `translate(${dragX}px, ${dragY}px) rotate(${cardRotation}deg) rotateY(${flip === 0 ? 0 : flip === 1 ? 180 : 360}deg)`
                  : `rotateY(${flip === 0 ? 0 : flip === 1 ? 180 : 360}deg)`,
              opacity: flyOut ? 0 : 1,
              transition: flyOut ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease' : isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onClick={onCardClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerCancel={onPointerCancel}
            onPointerUp={onPointerUp}
          >
            <div className="absolute inset-0 backface-hidden rounded-3xl overflow-hidden" style={{ visibility: flip === 1 ? "hidden" : "visible" }}>
              {flip === 2 ? (
                <div className="absolute inset-0 flex flex-col p-6 bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-3xl transition-opacity duration-200" style={{ opacity: contentOpacity }}>
                  {renderDetailFaceInner()}
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-card to-card/80 rounded-3xl overflow-hidden">
                  <div aria-hidden="true" className="absolute -right-8 -bottom-10 select-none pointer-events-none font-hanzi text-foreground/[0.07] dark:text-foreground/[0.1]" style={{ fontSize: "10rem", lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}>
                    {card.hanzi}
                  </div>
                  <CardTopBar card={card} />
                  <div className="font-hanzi text-6xl sm:text-7xl md:text-8xl leading-none text-foreground drop-shadow-sm whitespace-nowrap">{card.hanzi}</div>
                  <CardHint />
                </div>
              )}
            </div>

            <div className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 bg-gradient-to-br from-card to-card/80 rounded-3xl rotate-y-180 overflow-hidden" style={{ visibility: flip !== 1 ? "hidden" : "visible" }}>
              <div aria-hidden="true" className="absolute -right-8 -bottom-10 select-none pointer-events-none font-hanzi text-foreground/[0.07] dark:text-foreground/[0.1]" style={{ fontSize: "10rem", lineHeight: 1, transform: "scaleX(-1) rotate(-8deg)" }}>
                {card.hanzi}
              </div>
              <CardTopBar card={card} />
              <div className="font-hanzi mb-6 text-4xl sm:text-5xl md:text-6xl leading-none text-foreground drop-shadow-sm whitespace-nowrap">{card.hanzi}</div>
              <TonePinyin text={card.pinyin} className="text-3xl font-sans font-medium drop-shadow-sm" />
              <CardHint />
            </div>

            <div
              className={`absolute inset-0 rounded-3xl pointer-events-none flex items-center justify-center text-4xl font-bold tracking-wider z-20 backface-hidden transition-all duration-200 ${swipeStatus !== "none" ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
              style={{
                background: swipeStatus === "hafal" ? "rgba(26, 122, 74, 0.25)" : swipeStatus === "lupa" ? "rgba(192, 57, 43, 0.25)" : swipeStatus === "ragu" ? "rgba(245, 158, 11, 0.25)" : swipeStatus === "sulit" ? "rgba(59, 130, 246, 0.25)" : "transparent",
                color: swipeStatus === "hafal" ? "#4ade80" : swipeStatus === "lupa" ? "#f87171" : swipeStatus === "ragu" ? "#f59e0b" : swipeStatus === "sulit" ? "#60a5fa" : "transparent",
                border: swipeStatus === "hafal" ? "2px solid rgba(74, 222, 128, 0.4)" : swipeStatus === "lupa" ? "2px solid rgba(248, 113, 113, 0.4)" : swipeStatus === "ragu" ? "2px solid rgba(245, 158, 11, 0.4)" : swipeStatus === "sulit" ? "2px solid rgba(96, 165, 250, 0.4)" : "none",
                display: flip === 2 ? "flex" : "none",
              }}
            >
              <span className="drop-shadow-lg">
                {swipeStatus === "hafal" ? "MUDAH ✓" : swipeStatus === "lupa" ? "LUPA ✕" : swipeStatus === "ragu" ? "SULIT ?" : swipeStatus === "sulit" ? "INGAT !" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}