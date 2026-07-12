import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Question } from '../types';

interface QuestionAreaProps {
  question: Question;
  selectedOption: string | null;
  onSelectOption: (option: string) => void;
  totalQuestions: number;
}

export default function QuestionArea({ question, selectedOption, onSelectOption, totalQuestions }: QuestionAreaProps) {
  return (
    <article className="space-y-6">
      <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-sm border border-surface-container-high min-h-[500px] flex flex-col">
        <div className="flex justify-between items-start mb-8">
          <span className="px-3 py-1 bg-primary-fixed text-primary rounded-full text-sm font-semibold">
            Question {question.id} of {totalQuestions}
          </span>
          <span className="text-sm font-semibold text-on-surface-variant">Points: {question.points.toFixed(1)}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-grow"
          >
            <h2 className="text-2xl font-bold text-on-surface mb-8 leading-tight">
              {question.text}
            </h2>

            {question.image && (
              <div className="w-full max-w-md mx-auto mb-10 bg-surface-container p-8 rounded-2xl flex items-center justify-center">
                <img 
                  alt="Question illustration" 
                  src={question.image} 
                  className="max-w-full h-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div className="space-y-4">
              {question.options.map((option) => {
                const isSelected = selectedOption === option;
                return (
                  <label
                    key={option}
                    className={`group flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.99] ${
                      isSelected 
                        ? 'border-primary bg-primary-fixed shadow-sm' 
                        : 'border-outline-variant hover:bg-surface-container-low hover:border-primary'
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz_option"
                      className="w-5 h-5 text-primary border-outline-variant focus:ring-primary"
                      checked={isSelected}
                      onChange={() => onSelectOption(option)}
                    />
                    <span className={`ml-4 text-lg ${isSelected ? 'font-bold text-on-surface' : 'text-on-surface'}`}>
                      {option}
                    </span>
                  </label>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-outline-variant">
          <div className="flex gap-4 w-full md:w-auto">
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 border-2 border-primary text-primary font-semibold rounded-lg hover:bg-primary-fixed transition-colors active:opacity-80">
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary text-on-primary font-semibold rounded-lg hover:bg-primary-container transition-colors active:scale-95 shadow-md">
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button className="w-full md:w-auto px-10 py-4 bg-secondary-container text-on-secondary-container font-bold rounded-lg hover:brightness-105 transition-all shadow-md">
            Submit Final Answers
          </button>
        </div>
      </div>
    </article>
  );
}
