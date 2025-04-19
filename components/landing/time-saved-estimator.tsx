"use client";

import React, { useState, useMemo } from 'react';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MINUTES_PER_DOC_BEFORE = 18;
const MINUTES_PER_DOC_AFTER = 1;

// --- Constants for Slider Limits ---
const MAX_DOCS = 2000;
const MAX_TEAM_SIZE = 20;

interface EmojiReaction {
  emoji: string;
  caption: string;
}

function getEmojiReaction(hoursSaved: number): EmojiReaction {
  if (hoursSaved <= 20) return { emoji: "🙂", caption: "A few coffee breaks saved ☕" };
  if (hoursSaved <= 50) return { emoji: "😐", caption: "A full week unlocked 🔓" };
  if (hoursSaved <= 100) return { emoji: "😫", caption: "Time gain equivalent to a part-time job!" }; 
  if (hoursSaved <= 150) return { emoji: "😱", caption: "Huge time drain recovered 🚿" };
  return { emoji: "🤯", caption: "Transformative savings. Let's go!" }; 
}

export function TimeSavedEstimator() {
  const [docsPerMonth, setDocsPerMonth] = useState(200);
  const [teamSize, setTeamSize] = useState(1);
  const [isAfterMode, setIsAfterMode] = useState(false);

  const { beforeHours, afterHours, timeSavedHours } = useMemo(() => {
    const beforeMinutes = docsPerMonth * MINUTES_PER_DOC_BEFORE * teamSize;
    const afterMinutes = docsPerMonth * MINUTES_PER_DOC_AFTER * teamSize;
    const before = Math.round(beforeMinutes / 60);
    const after = Math.round(afterMinutes / 60);
    const saved = Math.max(0, before - after);
    return { beforeHours: before, afterHours: after, timeSavedHours: saved };
  }, [docsPerMonth, teamSize]);

  const { emoji, caption } = useMemo(() => getEmojiReaction(timeSavedHours), [timeSavedHours]);

  // Display values with '+' if max is reached
  const displayDocs = docsPerMonth >= MAX_DOCS ? `${MAX_DOCS}+` : docsPerMonth;
  const displayTeamSize = teamSize >= MAX_TEAM_SIZE ? `${MAX_TEAM_SIZE}+` : teamSize;

  return (
    <section id="calculator" className="w-full py-12 md:py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 md:px-6"> 
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-3">
              How Much Time Can You Save With CariNota?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
              <div className="space-y-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label htmlFor="docs-slider" className="flex items-center gap-1 cursor-help">
                        Documents Handled Per Month: <span className="font-bold">{displayDocs}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info text-muted-foreground"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Based on Gartner research: 18 minutes to find a doc.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Slider
                  id="docs-slider"
                  min={10}
                  max={MAX_DOCS}
                  step={10}
                  value={[docsPerMonth]}
                  onValueChange={(value) => setDocsPerMonth(value[0])}
                  aria-label="Documents handled per month"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="team-slider" className="flex items-center gap-1">
                  People Searching Documents: <span className="font-bold">{displayTeamSize}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info opacity-0">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4"/>
                    <path d="M12 8h.01"/>
                  </svg>
                </Label>
                <Slider
                  id="team-slider"
                  min={1}
                  max={MAX_TEAM_SIZE}
                  step={1}
                  value={[teamSize]}
                  onValueChange={(value) => setTeamSize(value[0])}
                  aria-label="People searching documents"
                />
              </div>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-center space-x-3 pt-4">
              <Label htmlFor="mode-switch" className={!isAfterMode ? 'font-bold' : 'text-muted-foreground'}>
                Before Using CariNota
              </Label>
              <Switch
                id="mode-switch"
                checked={isAfterMode}
                onCheckedChange={setIsAfterMode}
                aria-label="Toggle between before and after CariNota"
              />
              <Label htmlFor="mode-switch" className={isAfterMode ? 'font-bold text-primary' : 'text-muted-foreground'}>
                ✅ After Using CariNota
              </Label>
            </div>

            {/* Output & Visualization */}
            <div className="text-center space-y-4 pt-4">
              <div className="text-2xl md:text-3xl font-semibold">
                {isAfterMode ? (
                  <>
                    <span>With CariNota, your team could spend just </span>
                    <span className="text-primary font-bold">{afterHours} hours</span>
                    <span> searching.</span>
                  </>
                ) : (
                  <>
                    <span>Your team wastes about </span>
                    <span className="text-destructive font-bold">{beforeHours} hours</span>
                    <span> per month just searching for documents.</span>
                  </>
                )}
              </div>

              {/* Conditional "Time Saved" message only in After mode */}
              {isAfterMode && (
                <div className="text-xl md:text-2xl text-muted-foreground">
                  💡 This means <span className="font-bold text-foreground">{timeSavedHours} hours saved</span> — every month.
                </div>
              )}

              {/* Removed Progress Bar Section */}
              {/* Emoji Section */}
              <div className="pt-6 space-y-3">
                  <div className="text-4xl pt-4">{emoji}</div>
                  <div className="text-lg font-medium">{caption}</div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center pt-8">
              <Button size="lg" asChild>
                <a href="/login">
                  Try CariNota Free For 14 days
                </a>
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </section>
  );
} 