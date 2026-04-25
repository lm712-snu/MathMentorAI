import { useState, useEffect } from "react";
import { Question, UserProfile, AgentMemory } from "../types";
import { MathDisplay } from "./MathDisplay";
import { Loader2, CheckCircle2, XCircle, ChevronRight, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, auth } from "../lib/firebase";
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, setDoc, arrayUnion } from "firebase/firestore";

import { assessmentAgent, plannerAgent } from "../services/aiService";

interface AssessmentGridProps {
  topic: string;
  userProfile: UserProfile;
  memory: AgentMemory | null;
  onFinished: (points: number) => void;
}

export function AssessmentGrid({ topic, userProfile, memory, onFinished }: AssessmentGridProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    async function fetchQuestions() {
      setLoading(true);
      try {
        const qs = await assessmentAgent.generateQuestions(topic, userProfile.level, 4);
        setQuestions(qs);
      } catch (err) {
        console.error("Failed to fetch questions", err);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, [topic]);

  const handleAnswer = (answer: string) => {
    if (isCorrect !== null) return;
    
    setSelectedAnswer(answer);
    const correct = answer === questions[currentIndex].correctAnswer;
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
    } else {
      finishAssessment();
    }
  };

  const finishAssessment = async () => {
    setFinished(true);
    const points = score * 50; // 50 points per correct answer
    
    // Update User Profile
    if (auth.currentUser) {
      const profileRef = doc(db, "users", auth.currentUser.uid, "profile", "info");
      await updateDoc(profileRef, {
        totalPoints: increment(points),
        lastActive: serverTimestamp()
      });

      // Record result
      const assessmentsRef = collection(db, "users", auth.currentUser.uid, "assessments");
      await addDoc(assessmentsRef, {
        topicId: topic,
        score,
        totalQuestions: questions.length,
        completedAt: serverTimestamp(),
        difficulty: userProfile.level,
        feedback: score === questions.length ? "Perfect!" : "Good effort!"
      });

      // Update AI Memory
      const memoryRef = doc(db, "users", auth.currentUser.uid, "memory", "current");
      
      // Call Planner Agent for next recommendation
      const planning = await plannerAgent.recommendNext(memory, topic);
      
      await setDoc(memoryRef, {
        updatedAt: serverTimestamp(),
        strengths: score > questions.length / 2 ? arrayUnion(topic) : (memory?.strengths || []),
        weaknesses: score <= questions.length / 2 ? arrayUnion(topic) : (memory?.weaknesses || []),
        recommendedTopics: [planning.nextTopic],
        tutoringStyle: userProfile.level === "Advanced" ? "Rigorous" : "Supportive"
      }, { merge: true });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Generating your practice session...</p>
      </div>
    );
  }

  if (finished) {
    return (
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-10 text-center shadow-xl border border-indigo-50 space-y-6"
      >
        <div className="bg-amber-100 p-4 rounded-full inline-block">
          <Trophy className="w-12 h-12 text-amber-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Session Complete!</h2>
          <p className="text-slate-500 mt-2 text-lg">You scored {score} out of {questions.length}</p>
        </div>
        <div className="text-4xl font-black text-indigo-600">+{score * 50} Points</div>
        <button 
          onClick={() => onFinished(score * 50)}
          className="w-full bg-indigo-600 text-white font-bold py-4 px-8 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg"
        >
          Return to Dashboard
        </button>
      </motion.div>
    );
  }

  const q = questions[currentIndex];

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white rounded-2xl border border-slate-200">
        <XCircle className="w-10 h-10 text-rose-500" />
        <p className="text-slate-500 font-medium text-center">
          Oops! We couldn't generate math questions right now.<br/>
          <button onClick={() => window.location.reload()} className="text-indigo-600 underline mt-2">Try again</button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-bold text-slate-900">Question {currentIndex + 1} of {questions.length}</h3>
        <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500" 
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <motion.div 
        key={currentIndex}
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-8"
      >
        <div className="text-xl font-medium text-slate-800 leading-relaxed">
          <MathDisplay content={q.question} />
        </div>

        <div className="grid grid-cols-1 gap-3">
          {q.options.map((option, idx) => {
            const isSelected = selectedAnswer === option;
            const isChoiceCorrect = isCorrect !== null && option === q.correctAnswer;
            const isChoiceWrong = isCorrect !== null && isSelected && !isChoiceCorrect;

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(option)}
                disabled={isCorrect !== null}
                className={`text-left p-5 rounded-xl border-2 transition-all flex items-center justify-between group ${
                  isChoiceCorrect 
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900" 
                    : isChoiceWrong 
                    ? "bg-rose-50 border-rose-500 text-rose-900" 
                    : isSelected
                    ? "bg-indigo-50 border-indigo-600 text-indigo-900"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 flex items-center justify-center rounded-lg border font-bold ${
                    isSelected ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-500 border-slate-200"
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <MathDisplay content={option} className="!prose-sm" />
                </div>
                {isChoiceCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                {isChoiceWrong && <XCircle className="w-6 h-6 text-rose-600" />}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {isCorrect !== null && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-4"
            >
              <div className={`p-5 rounded-xl ${isCorrect ? "bg-emerald-50" : "bg-rose-50"}`}>
                <p className={`font-bold mb-1 ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                  {isCorrect ? "Correct! Well done." : "Not quite right."}
                </p>
                <MathDisplay content={q.explanation} className="!prose-sm text-slate-600" />
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={nextQuestion}
                  className="bg-slate-900 text-white font-bold py-3 px-8 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 group"
                >
                  {currentIndex === questions.length - 1 ? "Finish Session" : "Next Question"}
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}


