import { useState } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import QuestionArea from '../../components/QuestionArea';
import Footer from '../../components/Footer';
import { Question } from '../../types';

const MOCK_QUESTIONS: Question[] = [
  {
    id: 13,
    text: "In a right-angled triangle, if the square of the hypotenuse is equal to the sum of the squares of the other two sides, what is the length of the missing side 'c' if side 'a' is 6cm and side 'b' is 8cm?",
    options: ["9 cm", "10 cm", "12 cm", "14 cm"],
    correctAnswer: "10 cm",
    points: 5.0,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC42r69hX0GE_6ax0qp6GQjzcQxcW5XngqY_TWDgeLhvdo490D8YrZI-8HvjggYIypUXwl6fqQ1CQoU9wCB9rM_6IBcfWI2BR4JgjLhZgir1bgLMIGignpa5ryMITuVNJaCMF4j7srKQyo-ua4AMDLdWmw5GhiDrGbQaT2p9O9ZybxoV5PxWA32Y7KW2WxMOwGgV1oxyNpBehTwInTF58XeIUMmbA4UGwWj3xogIVSCpRTPNwdQU7rY4UQAtMLc7m19f2E6mADmtbs"
  }
];

export default function QuizPage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({
    13: "10 cm" // Default selected based on screenshot
  });
  
  const currentQuestion = MOCK_QUESTIONS[currentQuestionIndex];
  const totalQuestions = 20;
  const answeredQuestions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const handleSelectOption = (option: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: option
    }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 md:px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar on the left on desktop, second on mobile */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <Sidebar 
              currentQuestionId={currentQuestion.id}
              totalQuestions={totalQuestions}
              answeredQuestions={answeredQuestions}
            />
          </div>
          
          {/* Main content area */}
          <div className="lg:col-span-9 order-1 lg:order-2">
            <QuestionArea 
              question={currentQuestion}
              selectedOption={selectedAnswers[currentQuestion.id] || null}
              onSelectOption={handleSelectOption}
              totalQuestions={totalQuestions}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
