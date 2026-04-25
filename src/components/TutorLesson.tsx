import { useState, useEffect } from "react";
import { UserProfile, AgentMemory } from "../types";
import { MathDisplay } from "./MathDisplay";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

import { tutorAgent } from "../services/aiService";

interface TutorLessonProps {
  topic: string;
  userProfile: UserProfile;
  memory: AgentMemory | null;
  onComplete: () => void;
}

export function TutorLesson({ topic, userProfile, memory, onComplete }: TutorLessonProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLesson() {
      setLoading(true);
      try {
        const text = await tutorAgent.explain(topic, userProfile, memory);
        setExplanation(text || null);
      } catch (err) {
        console.error("Failed to fetch lesson", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [topic]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Learning: {topic}
        </h2>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium">MathMentor is preparing your lesson...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <MathDisplay content={explanation || "Failed to load lesson content."} />
            
            <div className="pt-8 border-t border-slate-100 flex justify-end">
              <button 
                onClick={onComplete}
                className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 group"
              >
                Start Practice
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
