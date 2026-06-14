import { Timer } from 'lucide-react';
import { motion } from 'motion/react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-outline-variant h-20 shadow-sm">
      <div className="flex justify-between items-center w-full px-4 md:px-10 max-w-7xl mx-auto h-full">
        <div className="flex items-center gap-6">
          <span className="text-2xl font-extrabold text-primary">Bee Academy</span>
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-semibold text-on-surface-variant">Mathematics Grade 8</span>
            <span className="text-xl font-semibold text-on-surface">Unit 4: Advanced Geometry Quiz</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-lg border border-outline-variant">
            <Timer className="text-primary w-5 h-5" />
            <span className="text-lg font-semibold tabular-nums">24:45</span>
          </div>
          
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-fixed">
            <img 
              alt="User" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAr8ZQFGiOXUOL46z2Uozrh8Hdwyv_H4WB6zf3gq1BNak_SIhUyPk6DgVrnKh3Zv7OOOGDJiAFIRgmSUkkriUTbc8ZsBYIiuSR75YSiJVEhD3X4g19vfOdR7-_3LsFlEEBa38WL3wVBK5o-1Btzstc4jPNkS6BQlpinzBweAAy7rmSKgH5GvhDQklwzp0lwirc6cre_jwdaTwAZZ8FLdC5Sju0oZQSCwQM2bdmajyWGEiFsHC5RE-9BFlgVPoxG1fv0nnLx7v2WLP4"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-surface-container-highest">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: '65%' }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full bg-secondary-container"
        />
      </div>
    </header>
  );
}
