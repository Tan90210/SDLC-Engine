export const FACTORS = [
  { id: 'stability', label: 'Requirement stability', question: 'How stable are the requirements? What is likely to change, and how frequently?', low: 'Evolving frequently', high: 'Stable and agreed' },
  { id: 'risk', label: 'Failure consequences', question: 'What are the business, financial, security, or safety consequences of failure?', low: 'Low impact', high: 'Severe impact' },
  { id: 'uncertainty', label: 'Technical uncertainty', question: 'Which technologies, integrations, or business assumptions are unproven?', low: 'Well understood', high: 'Highly uncertain' },
  { id: 'assurance', label: 'Verification and approvals', question: 'What testing, traceability, audit evidence, and formal approvals are required before release?', low: 'Lightweight validation', high: 'Formal verification gates' },
  { id: 'feedback', label: 'Stakeholder availability', question: 'How often can stakeholders review increments and make decisions?', low: 'Rarely available', high: 'Frequent collaboration' },
  { id: 'delivery', label: 'Incremental delivery', question: 'Can the system be released in small increments? What release deadlines or external dependencies apply?', low: 'Single constrained release', high: 'Frequent incremental releases' },
  { id: 'capability', label: 'Team capability', question: 'What experience, team capacity, automated testing, and delivery infrastructure are available?', low: 'Limited delivery capability', high: 'Mature delivery capability' },
  { id: 'constraints', label: 'Dependencies and constraints', question: 'What fixed budget, schedule, legacy systems, vendor contracts, or approval dependencies constrain delivery?', low: 'Few constraints', high: 'Many fixed constraints' }
];

export const CATEGORIES = ['Business', 'Functional', 'Security', 'Privacy', 'Compliance', 'Performance', 'Availability', 'Integration', 'Auditability', 'Operational', 'Usability', 'Data'];
export const ROLES = ['Business / product owner', 'Customers / end users', 'Software architects / developers', 'Security / privacy', 'Compliance / legal', 'Operations', 'Risk / audit'];

export const AGENTS = [
  { id: 'requirements', name: 'Requirements reviewer', focus: 'Assess requirement stability, testability, completeness, contradictions and unsupported assumptions.' },
  { id: 'risk', name: 'Risk and assurance analyst', focus: 'Assess technical uncertainty, failure consequences, security needs, evidence and approval gates. Do not make legal determinations.' },
  { id: 'delivery', name: 'Delivery analyst', focus: 'Assess stakeholder availability, increments, delivery constraints, dependencies and team capability.' },
  { id: 'review', name: 'Recommendation reviewer', focus: 'Challenge the preceding analyses and ranking. Identify unsupported claims, material missing information and conditions that would change the ranking.' }
];

export const CANDIDATES = [
  { id: 'waterfall', name: 'Waterfall / sequential', ideal: [5,3,1,4,1,1,3,5], guidanceDocuments: ['nasa-handbook','sei-spiral'], tradeoff: 'Fits agreed phase boundaries; late feedback is costly when assumptions are wrong.' },
  { id: 'vmodel', name: 'V-Shaped (V-Model)', ideal: [5,5,2,5,2,2,3,5], guidanceDocuments: ['nasa-handbook','nist-ssdf'], tradeoff: 'Strong specification-to-test traceability; changes can require substantial rework.' },
  { id: 'prototype', name: 'Prototype Model', ideal: [1,2,5,1,5,3,3,2], guidanceDocuments: ['sei-spiral','nasa-handbook'], tradeoff: 'Clarifies high UI and technical uncertainty through early working mockups; risk of stakeholders mistaking prototype for final software.' },
  { id: 'iterative', name: 'Iterative / Incremental', ideal: [3,3,3,3,4,4,3,3], guidanceDocuments: ['scrum-guide','nasa-handbook'], tradeoff: 'Progressively refines system across planned cycles; balances evolving requirements with architectural baseline control.' },
  { id: 'rad', name: 'RAD (Rapid Application Development)', ideal: [2,2,2,1,5,5,5,3], guidanceDocuments: ['scrum-guide','sei-spiral'], tradeoff: 'Ultra-fast timeboxed delivery (60–90 days) using visual/modular tools and continuous user focus groups; requires high team capability.' },
  { id: 'spiral', name: 'Spiral / risk-driven', ideal: [2,5,5,4,4,3,4,3], guidanceDocuments: ['sei-spiral','nist-ssdf'], tradeoff: 'Adds risk-analysis effort; each cycle must retire a specific risk.' },
  { id: 'agile-xp', name: 'Agile XP (Extreme Programming)', ideal: [1,3,3,2,5,5,5,1], guidanceDocuments: ['scrum-guide','nist-ssdf'], tradeoff: 'Emphasizes intense engineering discipline (TDD, continuous refactoring, pair programming, automated CI); requires close customer collaboration.' },
  { id: 'agile-dsdm', name: 'Agile DSDM (Dynamic Systems)', ideal: [2,4,2,4,4,4,4,5], guidanceDocuments: ['scrum-guide','nist-ssdf'], tradeoff: 'Guarantees fixed schedule and budget with MoSCoW variable scope and formal enterprise governance; demands early stakeholder consensus.' },
  { id: 'agile', name: 'Agile / incremental', ideal: [1,2,2,2,5,5,4,2], guidanceDocuments: ['scrum-guide','nist-ssdf'], tradeoff: 'Needs timely feedback, disciplined testing and useful release increments.' },
  { id: 'hybrid', name: 'Incremental + assurance gates', ideal: [2,5,3,5,4,4,4,4], guidanceDocuments: ['scrum-guide','nasa-handbook','nist-ssdf'], tradeoff: 'Requires explicit gate owners and evidence, with care to avoid excessive process overhead.' }
];
