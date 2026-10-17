import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Pillars from './pages/Pillars.jsx'
import Founder from './pages/Founder.jsx'
import Gallery from './pages/Gallery.jsx'
import Athletes from './pages/Athletes.jsx'
import Contact from './pages/Contact.jsx'
import MembershipCardPage from './pages/MembershipCardPage.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import TermsConditions from './pages/TermsConditions.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminMembers from './pages/AdminMembers.jsx'
import AdminManagement from './pages/AdminManagement.jsx'
import FlowSimulator from './pages/FlowSimulator.jsx'
import BotMessages from './pages/BotMessages.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Website Routes (with standard header/footer) */}
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/pillars" element={<Pillars />} />
          <Route path="/founder" element={<Founder />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/athletes" element={<Athletes />} />
          <Route path="/membership-card" element={<MembershipCardPage />} />
          <Route path="/id-card" element={<MembershipCardPage />} />
          <Route path="/register" element={<MembershipCardPage />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsConditions />} />
          <Route path="/terms" element={<TermsConditions />} />
        </Route>

        {/* Dedicated Admin Login Route */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Shortcut alias for /flow-simulator matching reference screenshot */}
        <Route path="/flow-simulator" element={<Navigate to="/admin/flow-simulator" replace />} />

        {/* Dedicated Admin Portal Routes (with sidebar layout matching screenshot) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="members" element={<AdminMembers />} />
          <Route path="management" element={<AdminManagement />} />
          <Route path="bot-messages" element={<BotMessages />} />
          <Route path="flow-simulator" element={<FlowSimulator />} />
          <Route path="registrations" element={<AdminMembers />} />
        </Route>

        {/* Fallback 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
