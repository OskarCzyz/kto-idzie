// Line icons for the bottom navigation (stroke = currentColor).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const CalendarIcon = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" /></svg>
)
export const GridIcon = () => (
  <svg {...base}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg>
)
export const PlanIcon = () => (
  <svg {...base}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth={3} /></svg>
)
export const PeopleIcon = () => (
  <svg {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.6c2.4.2 4.2 1.9 5 4.9" /></svg>
)
