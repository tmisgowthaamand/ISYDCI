import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()
  const [showTopBtn, setShowTopBtn] = useState(false)

  // Automatically scroll to the top of the page on every route navigation
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  // Monitor scroll depth to toggle the floating Back-to-Top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 250) {
        setShowTopBtn(true)
      } else {
        setShowTopBtn(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      aria-label="Scroll to top of page"
      className={`fixed bottom-6 right-6 z-50 p-3 rounded-full bg-[#0b1e3f] text-white shadow-2xl shadow-navy/40 hover:bg-[#2f9e44] transition-all duration-300 active:scale-95 cursor-pointer border-2 border-white/30 group ${
        showTopBtn ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      title="Scroll to Top"
    >
      <svg
        className="w-5 h-5 transition-transform duration-200 group-hover:-translate-y-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  )
}
