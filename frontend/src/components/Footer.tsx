export default function Footer() {
  return (
    <footer className="bg-surface-container-highest mt-20 border-t border-outline-variant">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-4 md:px-10 py-16 max-w-7xl mx-auto">
        <div className="md:col-span-2">
          <span className="text-2xl font-extrabold text-primary">Bee Academy</span>
          <p className="mt-6 text-on-surface-variant leading-relaxed max-w-sm">
            Empowering secondary learners through interactive, rigorous, and motivating educational tools designed for the modern classroom.
          </p>
          <p className="mt-8 text-sm font-semibold text-on-surface-variant">© {new Date().getFullYear()} Bee Academy. Empowering secondary learners.</p>
        </div>
        
        <div>
          <h4 className="text-sm font-bold text-primary mb-6 uppercase tracking-wider">Support</h4>
          <ul className="space-y-4">
            <li><a href="#" className="text-on-surface-variant hover:text-secondary-container transition-colors font-medium">Help Center</a></li>
            <li><a href="#" className="text-on-surface-variant hover:text-secondary-container transition-colors font-medium">Contact Info</a></li>
            <li><a href="#" className="text-on-surface-variant hover:text-secondary-container transition-colors font-medium">Accessibility</a></li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-sm font-bold text-primary mb-6 uppercase tracking-wider">Subjects</h4>
          <ul className="space-y-4">
            <li><a href="#" className="text-on-surface-variant hover:text-secondary-container transition-colors font-medium">Math</a></li>
            <li><a href="#" className="text-on-surface-variant hover:text-secondary-container transition-colors font-medium">Science</a></li>
            <li><a href="#" className="text-on-surface-variant hover:text-secondary-container transition-colors font-medium">English</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
