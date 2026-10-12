export const pillars = [
  { n: '01', t: 'Global Excellence', d: 'Elevating Indian athletes to the world stage through elite training pathways.' },
  { n: '02', t: 'Economic Growth', d: 'Fueling the nation’s prosperity through a robust, self-sustaining sports industry.' },
  { n: '03', t: 'Social Inclusion & Health', d: 'Promoting wellness and unity across every community in India.' },
  { n: '04', t: 'Mass Participation', d: 'Turning sports into a national movement for every citizen.' },
  { n: '05', t: 'Educational Integration', d: 'Seamlessly blending athletic training with academic growth.' },
]

export const galleryImages = Array.from({ length: 12 }, (_, i) => ({
  src: `/events/${i + 1}.png`,
  label: `Event ${i + 1}`,
}))

export const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/pillars', label: 'Pillars' },
  { to: '/founder', label: 'Founder' },
  { to: '/gallery', label: 'Events' },
  { to: '/athletes', label: 'Athletes' },
  { to: '/membership-card', label: 'Membership Card' },
  { to: '/contact', label: 'Contact' },
]
