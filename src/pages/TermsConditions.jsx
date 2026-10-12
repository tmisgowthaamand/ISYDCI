import { Link } from 'react-router-dom'

export default function TermsConditions() {
  return (
    <div className="bg-[#f7f2e2] min-h-screen pt-28 pb-24 text-slate-800">
      <div className="max-w-[1000px] mx-auto px-5">
        
        {/* Navigation Bar / Back Button */}
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-50 text-navy font-bold text-xs uppercase tracking-wider border border-navy/15 shadow-sm hover:shadow transition-all group active:scale-95 cursor-pointer"
          >
            <svg
              className="w-4 h-4 text-accent transition-transform group-hover:-translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Home</span>
          </Link>

          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/70 px-3 py-1 rounded-full border border-navy/10">
            ISYDCI • Agreement
          </span>
        </div>

        {/* Hero Section matching Screenshot Theme */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-accent font-bold tracking-[3px] text-xs uppercase block mb-2">
            OFFICIAL TERMS
          </span>
          <h1 className="text-navy text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight font-['Montserrat']">
            Terms & Conditions
          </h1>
          <p className="text-slate-600 font-medium text-sm sm:text-base mt-3">
            Last updated: <span className="text-navy font-bold">October 2026</span>
          </p>
          <div className="mt-4 p-4 rounded-2xl bg-white/80 border border-navy/10 text-xs sm:text-sm text-slate-700 leading-relaxed text-left sm:text-center shadow-xs">
            Welcome to the <strong>International Sports & Youth Development Campaign of India (ISYDCI)</strong> portal. These Terms & Conditions define the binding agreement between you and ISYDCI governing access to our website, athlete registration systems, digital membership ID cards, sports events, and administrative portals.
          </div>
        </div>

        {/* Clauses in Clean Elevated Cards */}
        <div className="space-y-6">

          {/* 1. Acceptance of Terms */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                1
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Acceptance of Terms
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              By accessing, browsing, registering on, or utilizing the International Sports & Youth Development Campaign of India platform ("ISYDCI", "the Platform", or "we"), you agree to be bound by these Terms & Conditions, all applicable sporting regulations, and our Privacy Policy. If you do not concur with any part of these provisions, you must immediately discontinue use of our digital services and registration facilities. These terms apply to all visitors, registered athletes, affiliated members, coaches, institutions, and administrative users.
            </p>
          </section>

          {/* 2. About ISYDCI */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                2
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                About ISYDCI
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              Founded in 1997 in Karnataka by Founder & National President Visanath Shetty, the International Sports & Youth Development Campaign of India is a pioneer grassroots sports and youth empowerment initiative. With extensive state chapters across Tamil Nadu and all of India, ISYDCI scouts talent, conducts training camps, supports under-resourced athletes, and issues authentic standardized membership credentials.
            </p>
          </section>

          {/* 3. User & Athlete Accounts */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                3
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                User & Athlete Accounts
              </h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              <li>You must provide accurate, authentic, and complete information when registering as an athlete or campaign member.</li>
              <li>You are personally responsible for safeguarding your registration details and administrative credentials where applicable.</li>
              <li>You must notify ISYDCI immediately of any unauthorized use, credential breach, or suspicious access to your profile.</li>
              <li>ISYDCI reserves the express right to reject, suspend, or terminate any registration that provides forged age proofs, misleading sport credentials, or violates campaign integrity.</li>
            </ul>
          </section>

          {/* 4. Athlete Registration & Member Cards */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                4
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Member Cards & Official Credentials
              </h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              <li>ISYDCI generates standardized digital and physical CR80 Membership ID cards bearing an auto-generated unique ID (format: <code>ISYDCI-XXXXXXXX</code>) and dynamic verification QR code.</li>
              <li>Membership cards remain the exclusive institutional property of ISYDCI and are issued for legitimate athlete identification, state tournament accreditations, and community campaign participation.</li>
              <li>Member cards are non-transferable and must only be presented by the verified individual named on the face of the card.</li>
              <li>Falsification, unauthorized duplication, digital manipulation, or commercial resale of ISYDCI credentials constitutes criminal fraud under Indian law.</li>
            </ul>
          </section>

          {/* 5. Code of Conduct & Prohibited Activities */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                5
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Prohibited Activities
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed mb-3">
              Users, athletes, and representatives must NOT:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              <li>Submit fabricated personal records, counterfeit identity certificates, or falsified age documentation.</li>
              <li>Utilize the Platform or generated credentials for any unlawful, defamatory, or anti-social purposes.</li>
              <li>Scrape, harvest, or bulk-extract member directory records, photographs, or administrative rosters without express written consent.</li>
              <li>Interfere with, overload, or compromise the Platform's server infrastructure, backend APIs, or database integrity.</li>
              <li>Impersonate ISYDCI state presidents, founders, campaign officers, or authorized referees.</li>
              <li>Inject malicious scripts, viruses, or harmful payloads through registration form upload fields.</li>
            </ul>
          </section>

          {/* 6. Intellectual Property */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                6
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Intellectual Property
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              All materials across the Platform—including the emblem, logo, digital card layouts, typography, sports editorial content, graphics, and software code—are owned by or licensed to the International Sports & Youth Development Campaign of India. You may not reproduce, modify, or commercially distribute campaign assets without explicit written authorization. Member-submitted photographs remain the personal property of the submitter, with a non-exclusive license granted to ISYDCI for card rendering, verification, and campaign publications.
            </p>
          </section>

          {/* 7. Sports Participation & Safety */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                7
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Sports Participation & Inherent Risk
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              Athletic training, competitive tournaments, and conditioning programs involve intrinsic physical exertion. Athletes and their legal guardians acknowledge that participation in offline events is voluntary. While ISYDCI mandates high sporting safety standards and qualified personnel during official camps, participants are encouraged to maintain active medical insurance and consult healthcare professionals prior to intense training.
            </p>
          </section>

          {/* 8. Limitation of Liability */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                8
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Limitation of Liability
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              The Platform and its digital tools are provided on an "as is" and "as available" basis without express or implied warranties. To the maximum degree permitted by Indian law, ISYDCI, its founder, trustees, and operational personnel shall not be liable for any indirect, incidental, or consequential damages resulting from digital service interruptions, third-party network downtime, or card loss.
            </p>
          </section>

          {/* 9. Modifications to Terms */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                9
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Modifications to Terms
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              ISYDCI reserves the authority to review and modify these Terms & Conditions as campaign governance expands. Updates take effect immediately upon posting, marked by the revision date at the top of this document. Continued involvement with ISYDCI after revisions constitutes your acceptance of the amended terms.
            </p>
          </section>

          {/* 10. Governing Law & Jurisdiction */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                10
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Governing Law & Legal Jurisdiction
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              These Terms & Conditions are governed and construed under the statutory laws of the Republic of India. Any claims, disagreements, or legal proceedings arising under these terms shall be subject to the exclusive jurisdiction of the competent civil courts located in Tamil Nadu, India.
            </p>
          </section>

          {/* 11. Contact & Administrative Grievance */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                11
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Contact & Governance Enquiries
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed mb-4">
              For any clarification, administrative questions, or institutional compliance verification regarding these Terms & Conditions, please contact:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-700">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-navy block mb-1">State Secretariat (Tamil Nadu)</span>
                <span>Chennai, Tamil Nadu, India</span>
                <span className="block mt-1 font-mono text-xs">Helpline: +91 99946 27551</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-navy block mb-1">National Headquarters</span>
                <span>VB Bhavan, Room No. 308, Rafi Marg, New Delhi – 110001</span>
                <span className="block mt-1 text-xs text-accent font-semibold">Official Email: isaydcindia@gmail.com</span>
              </div>
            </div>
          </section>

        </div>

        {/* Bottom Back Button */}
        <div className="text-center mt-12">
          <Link
            to="/"
            className="btn-gradient text-white px-8 py-3.5 rounded-full font-bold text-sm hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(47,158,68,.35)] transition-all inline-flex items-center gap-2 active:scale-95 cursor-pointer shadow-md"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Home</span>
          </Link>
        </div>

      </div>
    </div>
  )
}
