"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HskLevelFilter } from "@/components/hsk-level-filter";
import { useUnlockedHSK, clampToUnlockedLevel, lockedLevelMessage } from "@/lib/tier-unlock";

export type CumulativeFlashcardSet = {
  key: string;
  title: string;
  sub: string;
  description: string | null;
  badge: string;
  hsk_level: number;
  itemCount: number;
};

export function CumulativeFlashcardSetList({
  sets,
}: {
  sets: CumulativeFlashcardSet[];
}) {
  const unlockedHSK = useUnlockedHSK();
  const levels = [...new Set(sets.map((set) => set.hsk_level))].sort(
    (a, b) => a - b,
  );
  const [selectedLevel, setSelectedLevel] = React.useState(
    levels.includes(1) ? 1 : levels[0],
  );
  const effectiveLevel = unlockedHSK ? clampToUnlockedLevel(selectedLevel, unlockedHSK) : selectedLevel;
  const isLevelLocked = !!unlockedHSK && !unlockedHSK.includes(effectiveLevel);
  const visibleSets = sets.filter((set) => set.hsk_level === effectiveLevel);

  const [readCounts, setReadCounts] = React.useState<Record<string, number>>(
    {},
  );

  React.useEffect(() => {
    const counts = Object.fromEntries(
      sets.map((set) => {
        try {
          const stored = window.localStorage.getItem(
            `hanzi_read_progress:${set.key}`,
          );
          const completedIds = stored ? JSON.parse(stored) : [];
          return [
            set.key,
            Array.isArray(completedIds) ? completedIds.length : 0,
          ];
        } catch {
          return [set.key, 0];
        }
      }),
    ) as Record<string, number>;
    // Sinkronisasi dari localStorage (sistem eksternal) ke state React saat mount —
    // pola yang sah, bukan cascading render; localStorage tidak berubah karena setState ini.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReadCounts(counts);
  }, [sets]);

  return (
    <section className="flex flex-col gap-5">
      <HskLevelFilter
        levels={levels}
        selectedLevel={effectiveLevel}
        onChange={setSelectedLevel}
        unlockedLevels={unlockedHSK ?? undefined}
      />

      {isLevelLocked ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{lockedLevelMessage(effectiveLevel)}</p>
      ) : visibleSets.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Belum ada set kalimat untuk HSK {effectiveLevel}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleSets.map((set, index) => {
            const prevSet = index > 0 ? visibleSets[index - 1] : null;
            const prevDone = prevSet
              ? readCounts[prevSet.key] >= prevSet.itemCount && prevSet.itemCount > 0
              : true;
            const isLocked = !prevDone;

            const cardInner = (
              <Card className={`flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all ${isLocked ? "opacity-55" : "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"}`}>
                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-[10px] text-primary"
                    >
                      {set.badge || `HSK ${set.hsk_level}`}
                    </Badge>
                    {isLocked ? (
                      <Badge variant="secondary" className="gap-1 border-transparent bg-muted text-[10px] uppercase text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Kunci
                      </Badge>
                    ) : readCounts[set.key] >= set.itemCount &&
                      set.itemCount > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                      >
                        Selesai
                      </Badge>
                    ) : readCounts[set.key] > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                      >
                        {readCounts[set.key]}/{set.itemCount}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-muted text-[10px] text-muted-foreground"
                      >
                        Belum
                      </Badge>
                    )}
                  </div>
                  <h3 className="mb-1 mt-3 text-sm font-bold leading-tight transition-colors group-hover:text-primary">
                    {set.title}
                  </h3>
                  <p className="mt-3 min-h-10 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {set.description ?? ""}
                  </p>
                  <span className={`mt-auto inline-flex h-7 w-full items-center justify-center rounded-md text-xs font-semibold transition-colors ${isLocked ? "bg-muted/70 text-muted-foreground" : "bg-primary/15 text-primary group-hover:bg-primary/25"}`}>
                    {isLocked ? "Terkunci" : "Buka"}
                  </span>
                </CardContent>
              </Card>
            );

            if (isLocked) {
              return (
                <div key={set.key} className="block cursor-not-allowed">
                  {cardInner}
                </div>
              );
            }

            return (
              <Link
                key={set.key}
                href={`/dashboard/flashcard/cumulative/${set.key}`}
                className="group block"
              >
                {cardInner}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
