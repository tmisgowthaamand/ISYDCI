import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
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
            ISYDCI • Legal
          </span>
        </div>

        {/* Hero Section matching Screenshot Theme */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-accent font-bold tracking-[3px] text-xs uppercase block mb-2">
            OFFICIAL POLICY
          </span>
          <h1 className="text-navy text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight font-['Montserrat']">
            Privacy Policy
          </h1>
          <p className="text-slate-600 font-medium text-sm sm:text-base mt-3">
            Last updated: <span className="text-navy font-bold">October 2026</span>
          </p>
          <div className="mt-4 p-4 rounded-2xl bg-white/80 border border-navy/10 text-xs sm:text-sm text-slate-700 leading-relaxed text-left sm:text-center shadow-xs">
            At <strong>International Sports & Youth Development Campaign of India (ISYDCI)</strong>, your privacy and trust matter deeply to us. This Privacy Policy details how we collect, use, manage, and safeguard your personal information when you access our campaign portal, register as an athlete or member, generate official digital membership ID cards, or participate in our sports programs. By accessing or using the ISYDCI Platform, you consent to the practices described herein.
          </div>
        </div>

        {/* Clauses in Clean Elevated Cards */}
        <div className="space-y-6">

          {/* 1. Information We Collect */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                1
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Information We Collect
              </h2>
            </div>
            <div className="space-y-4 text-sm sm:text-[14.5px] leading-relaxed text-slate-700">
              <div>
                <h3 className="font-bold text-navy mb-1.5">a) Information you provide directly:</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><strong>Personal & Identity Information:</strong> Full legal name, date of birth, age, blood group, contact phone number, and residential address submitted during membership or athlete enrollment.</li>
                  <li><strong>Sports & Demographic Details:</strong> Preferred sport or athletic discipline, state (e.g. Tamil Nadu), district, assembly constituency, and sports council zone.</li>
                  <li><strong>Profile & ID Card Media:</strong> High-resolution profile photographs and identification cards rendered for your official ISYDCI Membership ID card.</li>
                  <li><strong>Athletic Participation:</strong> Tournament enrolments, performance credentials, school/academy affiliations, and program feedback submitted across our activities.</li>
                </ul>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <h3 className="font-bold text-navy mb-1.5">b) Information collected automatically:</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>Device information (browser type, operating system version).</li>
                  <li>Platform telemetry (pages visited, time spent, interaction timestamps).</li>
                  <li>IP address and approximate geographic location for security audit trails.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 2. How We Use Your Information */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                2
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                How We Use Your Information
              </h2>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              <li>To register, verify, and authenticate athlete and member profiles in the national campaign roster.</li>
              <li>To dynamically generate, render, and issue your official ISYDCI Membership ID Card with unique alphanumeric ID and instant QR code verification.</li>
              <li>To store your profile photo and rendered front & back card assets securely in cloud storage infrastructure (including dedicated Cloudinary storage under member-specific directories).</li>
              <li>To coordinate state, district, and national sporting camps, championship trials, and athlete empowerment workshops.</li>
              <li>To dispatch vital campaign notifications, event schedules, credential downloads, and verification notices.</li>
              <li>To monitor platform integrity, prevent fraudulent or duplicate ID card generation, and safeguard member data.</li>
              <li>To satisfy regulatory compliance and documentation standards governing registered sports organizations in India.</li>
            </ul>
          </section>

          {/* 3. WhatsApp & Official Communications */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                3
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                WhatsApp & Official Communications
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              ISYDCI may communicate with registered athletes, members, and guardians via official WhatsApp messaging, SMS, or email for membership verification, digital card delivery, event schedules, and critical administrative notices. By registering with the campaign, you consent to receiving these service communications. You may request communication preference adjustments at any time by contacting our support desk.
            </p>
          </section>

          {/* 4. Sharing of Information */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                4
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Sharing of Information
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed mb-3">
              We uphold strict privacy ethics and <strong>never sell or lease your personal information</strong>. Information is disclosed solely in the following limited circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              <li><strong>Cloud & Technology Partners:</strong> Vetted cloud service providers that facilitate secure asset storage (such as Cloudinary for encrypted photo and ID card hosting), database reliability, and transaction security.</li>
              <li><strong>Official Member Verification:</strong> Public verification attributes (such as Member Name, ID Card Number, District, and Verification Status) may be displayed upon scanning your card's official QR code to authenticate official standing at authorized tournaments.</li>
              <li><strong>Statutory & Legal Requirements:</strong> When compelled by law, court decree, or authorized statutory sports governance bodies in India.</li>
            </ul>
          </section>

          {/* 5. Data Storage & Security */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                5
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Data Storage & Security
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              All member records, digital card renders, and uploaded assets are secured using industry-standard technical measures, including HTTPS encryption in transit, strict administrative credentials, sanitized folder paths, and hardened cloud storage. While we apply thorough commercial-grade defenses, no electronic storage or transmission over the internet is completely infallible, and absolute security cannot be unconditionally guaranteed.
            </p>
          </section>

          {/* 6. Cookies */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                6
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Cookies & Session Technologies
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              We employ essential session storage and functional cookies to remember UI preferences, support smooth registration flow, and retain administrative session authentication. You may control or disable cookie allowances through your web browser preferences; however, doing so may impact interactive features such as photo cropping or live ID card previews.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                7
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Your Rights
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed mb-3">
              As a registered member or participant, you have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              <li>Request access to the personal membership and athletic records maintained in our system.</li>
              <li>Request correction or updates to inaccurate, incomplete, or outdated demographic details.</li>
              <li>Request the de-registration or deletion of your profile and associated ID card renders, subject to legal and auditing requirements.</li>
              <li>Opt-out of non-essential campaign newsletters or marketing broadcasts at any time.</li>
            </ul>
            <p className="text-xs sm:text-sm text-slate-500 mt-3 pt-3 border-t border-slate-100">
              To exercise any of these privileges, please submit a formal request to our secretariat at <a href="mailto:isaydcindia@gmail.com" className="text-accent font-bold hover:underline">isaydcindia@gmail.com</a>.
            </p>
          </section>

          {/* 8. Third-Party Links */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                8
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Third-Party Links & Services
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              Our website may contain hyperlinks to national sporting federations, accredited tournament venues, or government youth programs. ISYDCI is not responsible for the privacy practices, content, or security standards of third-party platforms. We encourage members to review the external privacy terms of each destination visited.
            </p>
          </section>

          {/* 9. Children & Student Athletes */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                9
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Youth & Student Athlete Privacy
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              Because ISYDCI actively fosters grassroots sports among children and youth, we frequently enroll minor student athletes. Registrations for athletes under 18 years of age must be undertaken with the express consent and supervision of a parent, legal guardian, or authorized school athletic coach. We apply heightened safeguards to protect young athletes' personal images and records.
            </p>
          </section>

          {/* 10. Changes to This Policy */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                10
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Changes to This Policy
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed">
              We may update this Privacy Policy periodically to reflect technological advances, statutory updates, or evolving campaign initiatives. Significant changes will be announced by revising the "Last updated" date at the header of this page. Your continued use of the platform after modifications are posted signifies your acceptance of the updated practices.
            </p>
          </section>

          {/* 11. Contact Us */}
          <section className="bg-white/95 rounded-2xl p-6 sm:p-8 border border-navy/10 shadow-[0_4px_20px_rgba(11,30,63,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-accent font-black text-sm flex items-center justify-center border border-emerald-200">
                11
              </span>
              <h2 className="text-navy text-lg sm:text-xl font-bold font-['Montserrat']">
                Contact & Grievance Redressal
              </h2>
            </div>
            <p className="text-sm sm:text-[14.5px] text-slate-600 leading-relaxed mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please connect with our office:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-700">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-navy block mb-1">State Office (Tamil Nadu)</span>
                <span>Chennai, Tamil Nadu, India</span>
                <span className="block mt-1 font-mono text-xs">Phone: +91 99946 27551</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-navy block mb-1">National Headquarters</span>
                <span>VB Bhavan, Room No. 308, Rafi Marg, New Delhi – 110001</span>
                <span className="block mt-1 text-xs text-accent font-semibold">Email: isaydcindia@gmail.com</span>
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
