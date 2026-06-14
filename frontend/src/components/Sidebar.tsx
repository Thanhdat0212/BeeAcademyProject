import { Lightbulb, Flag } from 'lucide-react';
import { cn } from '@/src/lib/utils'; // I'll create this helper

interface SidebarProps {
  currentQuestionId: number;
  totalQuestions: number;
  answeredQuestions: number[];
}

export default function Sidebar({ currentQuestionId, totalQuestions, answeredQuestions }: SidebarProps) {
  const questions = Array.from({ length: totalQuestions }, (_, i) => i + 1);

  return (
    <aside className="space-y-6">
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Question Map</h3>
          <span className="text-sm font-semibold text-on-surface-variant">{currentQuestionId} of {totalQuestions}</span>
        </div>
        
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q) => {
            const isCurrent = q === currentQuestionId;
            const isAnswered = answeredQuestions.includes(q);
            
            return (
              <button
                key={q}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-lg font-bold text-sm transition-all shadow-xs",
                  isAnswered && !isCurrent ? "bg-primary text-on-primary" : "",
                  isCurrent ? "border-2 border-primary bg-primary-fixed text-primary" : "",
                  !isAnswered && !isCurrent ? "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest" : ""
                )}
              >
                {q}
              </button>
            );
          })}
        </div>
        
        <div className="mt-8 pt-6 border-t border-outline-variant space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm font-semibold text-on-surface-variant">Answered</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full border-2 border-primary bg-primary-fixed" />
            <span className="text-sm font-semibold text-on-surface-variant">Current Question</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-surface-container-high" />
            <span className="text-sm font-semibold text-on-surface-variant">Remaining</span>
          </div>
        </div>
      </div>

      <div className="bg-[#414754] text-white p-6 rounded-xl flex flex-col gap-4 shadow-sm">
        <Lightbulb className="w-10 h-10 text-secondary-container" />
        <p className="text-sm font-medium leading-relaxed">
          Stuck? You can flag this question and come back to it later without losing your current progress.
        </p>
        <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
          <Flag className="w-4 h-4" /> Flag Question
        </button>
      </div>
    </aside>
  );
}
