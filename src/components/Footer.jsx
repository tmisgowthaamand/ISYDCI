import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-[#07132a] text-slate-400 pt-12 pb-5">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 mb-8">
          <div>
            <img src="/logo.png" alt="ISYDCI" className="w-13 h-13 rounded-full mb-3" />
            <h4 className="text-white text-[15px] tracking-wide mb-3 uppercase font-bold">ISYDCI</h4>
            <p className="text-sm leading-relaxed text-slate-500">
              International Sports & Youth Development Campaign of India — founded 1997 in Karnataka.
              Unleashing the unyielding power of India's untapped sporting potential.
            </p>
          </div>
          <div>
            <h4 className="text-white text-[15px] tracking-wide mb-3 uppercase font-bold">Explore</h4>
            <Link to="/about" className="block py-1 text-sm hover:text-accent">About</Link>
            <Link to="/pillars" className="block py-1 text-sm hover:text-accent">Pillars</Link>
            <Link to="/founder" className="block py-1 text-sm hover:text-accent">Founder</Link>
            <Link to="/gallery" className="block py-1 text-sm hover:text-accent">Events</Link>
          </div>
          <div>
            <h4 className="text-white text-[15px] tracking-wide mb-3 uppercase font-bold">Programs</h4>
            <Link to="/athletes" className="block py-1 text-sm hover:text-accent">Athlete Registration</Link>
            <Link to="/athletes" className="block py-1 text-sm hover:text-accent">Training Camps</Link>
            <Link to="/contact" className="block py-1 text-sm hover:text-accent">Scholarships</Link>
            <Link to="/contact" className="block py-1 text-sm hover:text-accent">School Partnerships</Link>
          </div>
          <div>
            <h4 className="text-white text-[15px] tracking-wide mb-3 uppercase font-bold">Reach Us</h4>
            <span className="block py-1 text-sm">Head Office, New Delhi</span>
            <span className="block py-1 text-sm">State Office, Chennai</span>
            <span className="block py-1 text-sm">isaydcindia@gmail.com</span>
            <span className="block py-1 text-sm">+91 99946 27551</span>
          </div>
        </div>
        <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-80">
          <div>
            © {new Date().getFullYear()} International Sports & Youth Development Campaign of India. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <span className="opacity-40">•</span>
            <Link to="/terms-and-conditions" className="hover:text-white transition-colors">Terms & Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
