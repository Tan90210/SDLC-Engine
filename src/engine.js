import { createHash } from 'node:crypto';
import { FACTORS, CATEGORIES, CANDIDATES } from './catalog.js';

const tokenize = text => text.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
const stop = new Set(['the','and','that','with','for','are','this','from','what','how','can','our','should','will','have']);
export function retrieve(knowledge, query, count = 4) {
  const terms = [...new Set(tokenize(query).filter(t => !stop.has(t)))];
  const docs = knowledge.map(d => ({ ...d, tokens: tokenize(d.title + ' ' + d.text) }));
  const avg = docs.reduce((s,d) => s + d.tokens.length,0) / (docs.length || 1);
  const documentFrequencies=new Map();
  for(const d of docs)for(const token of new Set(d.tokens))documentFrequencies.set(token,(documentFrequencies.get(token)||0)+1);
  return docs.map(d => {
    let score = 0;
    for (const t of terms) {
      const tf = d.tokens.filter(w => w === t).length;
      const df = documentFrequencies.get(t)||0;
      const idf = Math.log(1 + (docs.length - df + .5)/(df + .5));
      score += idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * d.tokens.length/(avg || 1)));
    }
    const { tokens, ...result } = d;
    return { ...result, retrievalScore: Math.round(score * 100)/100 };
  }).filter(d => d.retrievalScore > 0).sort((a,b) => b.retrievalScore-a.retrievalScore).slice(0,count);
}

export function readiness(project) {
  const accepted = project.requirements.filter(r => r.status === 'confirmed');
  const factors = FACTORS.map(f => ({ ...f, known: Boolean(project.factors[f.id]?.sourceIds?.length), value: project.factors[f.id]?.value ?? null }));
  const unresolved = project.conflicts.filter(c => c.status !== 'resolved');
  const missing = factors.filter(f => !f.known);
  const blockers = [];
  if (!project.stakeholders.length) blockers.push('Select at least one stakeholder.');
  const pending = project.stakeholders.filter(s => s.status !== 'complete' && s.status !== 'omitted');
  if (pending.length) blockers.push(`${pending.length} stakeholder interview(s) still open.`);
  if (!accepted.length) blockers.push('Confirm at least one source-linked requirement.');
  if (missing.length) blockers.push(`Evidence missing for: ${missing.map(f=>f.label).join(', ')}.`);
  if (unresolved.length) blockers.push(`${unresolved.length} unresolved conflict(s).`);
  const coverage = Math.round((factors.length-missing.length)/factors.length*100);
  return { ready: !blockers.length, coverage, factors, blockers, confirmed: accepted.length, proposed: project.requirements.filter(r=>r.status==='proposed').length, unresolved: unresolved.length };
}

// Source checks apply to every model write; retrieval cannot create project evidence.
export function validateExtraction(raw, project, stakeholderId, message) {
  if (!raw || typeof raw !== 'object' || typeof raw.reply !== 'string') throw new Error('The model returned an invalid interview response. Try again or choose another free model.');
  const ids = new Set(project.messages.filter(m=>m.role==='user').map(m=>m.id));
  const requirements = (Array.isArray(raw.requirements) ? raw.requirements : []).slice(0,12).flatMap(r => {
    if (typeof r.statement !== 'string' || r.statement.length < 8) return [];
    const quote = typeof r.quote === 'string' ? r.quote.trim() : '';
    if (!quote || !message.text.toLowerCase().includes(quote.toLowerCase())) return [];
    return [{ statement: r.statement.slice(0,1500), category: typeof r.category==='string' ? r.category : 'Functional',
      acceptanceCriteria: typeof r.acceptanceCriteria==='string' ? r.acceptanceCriteria.slice(0,1500) : '',
      derivation: typeof r.derivation === 'string' ? r.derivation.slice(0,1500) : '',
      quote, sourceIds: [message.id], stakeholderId, status: 'proposed', priority: ['Must','Should','Could'].includes(r.priority) ? r.priority : 'Should' }];
  });
  const factors = {};
  for (const f of FACTORS) {
    const v = raw.factors?.[f.id];
    if (!v || !Number.isInteger(v.value) || v.value < 1 || v.value > 5 || typeof v.reason !== 'string') continue;
    const quote = typeof v.quote === 'string' ? v.quote.trim() : '';
    if (!quote || !message.text.toLowerCase().includes(quote.toLowerCase())) continue;
    factors[f.id] = { value: v.value, reason: v.reason.slice(0,1000), quote, sourceIds: [message.id], status: 'inferred' };
  }
  const conflicts = (Array.isArray(raw.conflicts) ? raw.conflicts : []).slice(0,8).flatMap(c => {
    if (typeof c.description!=='string' || !Array.isArray(c.sourceIds)) return [];
    const sources = [...new Set(c.sourceIds)].filter(id => ids.has(id));
    return sources.length >= 2 ? [{ description: c.description.slice(0,1500), sourceIds: sources, status: 'open' }] : [];
  });
  return { reply: raw.reply.slice(0,5000), requirements, factors, conflicts };
}

const candidates = CANDIDATES;
export const WEIGHTS = [1.3,1.4,1.3,1.4,1,1.1,.7,.8];
function score(ideal, values) {
  const total = WEIGHTS.reduce((a,b)=>a+b,0);
  return Math.round(100 * WEIGHTS.reduce((sum,w,i)=>sum+w*(1-Math.abs(values[i]-ideal[i])/4),0)/total);
}
export function rank(project) {
  const values = FACTORS.map(f=>project.factors[f.id]?.value ?? 3);
  const rankings = candidates.map(c => ({ ...c, score: score(c.ideal,values), breakdown: FACTORS.map((f,i)=>({ factor:f.id, label:f.label, value:values[i], unknown:!project.factors[f.id]?.sourceIds?.length, ideal:c.ideal[i], weight:WEIGHTS[i], sourceIds:project.factors[f.id]?.sourceIds || [] })) })).sort((a,b)=>b.score-a.score);
  const changes = [];
  for (let i=0; i<FACTORS.length; i++) {
    for (const value of [1,5]) {
      const scenario = [...values]; scenario[i] = value;
      const best = candidates.map(c=>({ name:c.name, score:score(c.ideal,scenario) })).sort((a,b)=>b.score-a.score)[0];
      if (best.name !== rankings[0].name) changes.push({ factor:FACTORS[i].label, value, winner:best.name });
    }
  }
  return { rankings, sensitivity:changes, rubricVersion:'1.0', warning:'Suitability scores are heuristic rubric scores, not probabilities. Rubric requires independent expert validation.', securityPractices:['Threat modelling and security requirements','Automated security checks where feasible','Vulnerability response and release evidence'] };
}
export function snapshotHash(project) {
  return createHash('sha256').update(JSON.stringify({ requirements:project.requirements, factors:project.factors, conflicts:project.conflicts, messages:project.messages, knowledge:project.knowledge, stakeholders:project.stakeholders })).digest('hex');
}
export function demoExtract(project, stakeholderId, message) {
  const text = message.text;
  const lower = text.toLowerCase();
  const factors = {};
  const patterns = {
    stability: [/stable|fixed scope|change|evolv/i, /stable|fixed scope/i.test(text)?5:2],
    risk: [/risk|fraud|loss|failure|critical|financial/i, /critical|severe|loss|fraud/i.test(text)?5:3],
    uncertainty: [/uncertain|unproven|prototype|integration|technical|legacy/i, /uncertain|unproven|prototype/i.test(text)?5:3],
    assurance: [/audit|approval|verif|compliance|regulat|test/i, /audit|approval|compliance|regulat/i.test(text)?5:3],
    feedback: [/stakeholder|feedback|review|weekly|daily/i, /weekly|daily|frequent/i.test(text)?5:3],
    delivery: [/release|increment|deploy|deadline|delivery/i, /increment|weekly|frequent/i.test(text)?5:3],
    capability: [/team|automat|experience|capacity|pipeline/i, /automat|experienced|mature/i.test(text)?4:3],
    constraints: [/budget|schedule|legacy|vendor|dependenc|deadline/i, /fixed|legacy|vendor/i.test(text)?4:3]
  };
  for(const [key,[pattern,value]] of Object.entries(patterns)) if(pattern.test(text)) factors[key]={value,reason:'Demo keyword heuristic; review the score before relying on it.',quote:text.slice(0,160),sourceIds:[message.id],status:'inferred'};
  const missing = FACTORS.find(f=>!factors[f.id] && !project.factors[f.id]);
  return { reply: `Recorded your answer and proposed source-linked requirements. ${missing ? missing.question : 'The decision factors have evidence. Review proposed requirements, verify the factor scores, and mark completed interviews before analysis.'}`,
    requirements:text.split(/\n|(?<=[.!?])\s+/).filter(s=>s.trim().length>15).slice(0,6).map(statement=>({statement:statement.trim().slice(0,1500),category:/audit|trace/i.test(statement)?'Auditability':/latency|second|volume/i.test(statement)?'Performance':/auth|secur/i.test(statement)?'Security':'Functional',quote:statement.trim().slice(0,160),sourceIds:[message.id],stakeholderId,status:'proposed',priority:'Should',acceptanceCriteria:''})), factors,conflicts:[] };
}

export function validateDocumentIntake(raw, rawText) {
  if (!raw || typeof raw !== 'object') throw new Error('The model returned an invalid document intake structure.');
  const lowerDoc = (rawText || '').toLowerCase();

  const stakeholders = (Array.isArray(raw.stakeholders) ? raw.stakeholders : []).slice(0, 15).map((s, idx) => ({
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 100) : `Stakeholder ${idx + 1}`,
    role: typeof s.role === 'string' && s.role.trim() ? s.role.trim().slice(0, 100) : 'Business / product owner'
  }));
  if (!stakeholders.length) {
    stakeholders.push({ name: 'Key Stakeholders', role: 'Business / product owner' });
  }

  const messages = (Array.isArray(raw.messages) ? raw.messages : []).slice(0, 30).map(m => {
    const text = typeof m.text === 'string' ? m.text.trim() : '';
    const stakeholderName = typeof m.stakeholderName === 'string' ? m.stakeholderName.trim() : stakeholders[0].name;
    return { stakeholderName, text: text.slice(0, 5000) };
  }).filter(m => m.text.length > 5);

  const requirements = (Array.isArray(raw.requirements) ? raw.requirements : []).slice(0, 30).flatMap(r => {
    if (typeof r.statement !== 'string' || r.statement.length < 8) return [];
    const quote = typeof r.quote === 'string' ? r.quote.trim() : '';
    if (!quote || !lowerDoc.includes(quote.toLowerCase())) return [];
    const derivation = typeof r.derivation === 'string' && r.derivation.trim()
      ? r.derivation.trim().slice(0, 1500)
      : `Derived from stakeholder testimony: "${quote.slice(0, 100)}..." as a formal requirement.`;
    return [{
      statement: r.statement.slice(0, 1500),
      category: CATEGORIES.includes(r.category) ? r.category : 'Functional',
      priority: ['Must', 'Should', 'Could'].includes(r.priority) ? r.priority : 'Should',
      acceptanceCriteria: typeof r.acceptanceCriteria === 'string' ? r.acceptanceCriteria.slice(0, 1500) : '',
      quote,
      derivation,
      stakeholderName: typeof r.stakeholderName === 'string' ? r.stakeholderName.trim() : stakeholders[0].name
    }];
  });

  const factors = {};
  for (const f of FACTORS) {
    const v = raw.factors?.[f.id];
    if (!v || !Number.isInteger(v.value) || v.value < 1 || v.value > 5 || typeof v.reason !== 'string') continue;
    const quote = typeof v.quote === 'string' ? v.quote.trim() : '';
    if (!quote || !lowerDoc.includes(quote.toLowerCase())) continue;
    factors[f.id] = {
      value: v.value,
      reason: v.reason.slice(0, 1000),
      quote
    };
  }

  const conflicts = (Array.isArray(raw.conflicts) ? raw.conflicts : []).slice(0, 10).flatMap(c => {
    if (typeof c.description !== 'string' || c.description.length < 5) return [];
    return [{
      description: c.description.slice(0, 1500),
      quoteA: typeof c.quoteA === 'string' ? c.quoteA.trim() : '',
      quoteB: typeof c.quoteB === 'string' ? c.quoteB.trim() : ''
    }];
  });

  return {
    summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 2000) : 'Document analysis completed.',
    stakeholders,
    messages,
    requirements,
    factors,
    conflicts
  };
}

export function demoDocumentIntake(rawText) {
  const text = rawText || '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const detectedStakeholders = [];
  const stakeholderNames = new Set();

  for (const line of lines) {
    const m = line.match(/^([A-Z][a-zA-Z\s]{2,25})[:–-]\s*(.*)$/);
    if (m && !/^(http|note|page|chapter|section)/i.test(m[1])) {
      const name = m[1].trim();
      if (!stakeholderNames.has(name) && stakeholderNames.size < 6) {
        stakeholderNames.add(name);
        detectedStakeholders.push({
          name,
          role: /architect|developer|tech|engineer/i.test(name) ? 'Software architects / developers' :
            /security|privacy/i.test(name) ? 'Security / privacy' :
            /compliance|legal|regulat/i.test(name) ? 'Compliance / legal' :
            /user|customer/i.test(name) ? 'Customers / end users' : 'Business / product owner'
        });
      }
    }
  }

  if (!detectedStakeholders.length) {
    detectedStakeholders.push(
      { name: 'Business Stakeholders', role: 'Business / product owner' },
      { name: 'Technical Lead', role: 'Software architects / developers' },
      { name: 'Security & Compliance', role: 'Security / privacy' }
    );
  }

  const sentences = text.match(/[^.!?\n]+[.!?]+/g) || lines;
  const requirements = [];
  const patterns = [
    { regex: /audit|log|trace|record/i, category: 'Auditability', priority: 'Must' },
    { regex: /secur|auth|encrypt|protect/i, category: 'Security', priority: 'Must' },
    { regex: /complian|regulat|legal|gdpr|sox/i, category: 'Compliance', priority: 'Must' },
    { regex: /latency|second|millisecond|throughput|scale|tps/i, category: 'Performance', priority: 'Should' },
    { regex: /backup|availab|uptime|failover/i, category: 'Availability', priority: 'Must' },
    { regex: /integrat|api|gateway|connect|legacy/i, category: 'Integration', priority: 'Should' },
    { regex: /must|shall|need to|required to/i, priority: 'Must' },
    { regex: /should|recommend|expect|standard/i, priority: 'Should' }
  ];

  for (const rawSentence of sentences) {
    const s = rawSentence.trim();
    if (s.length < 15 || s.length > 350) continue;
    const match = patterns.find(p => p.regex.test(s));
    if (match && requirements.length < 15) {
      const category = match.category || (/data|database|schema/i.test(s) ? 'Data' : /user|ui|ux/i.test(s) ? 'Usability' : 'Functional');
      const priority = match.priority || 'Should';
      let statement = s.replace(/^[A-Za-z\s]+[:–-]\s*/, '').trim();
      if (!statement.toLowerCase().startsWith('the system shall')) {
        statement = `The system shall ${statement.charAt(0).toLowerCase() + statement.slice(1)}`;
      }
      requirements.push({
        statement: statement.slice(0, 1500),
        category,
        priority,
        acceptanceCriteria: `Verified by automated acceptance tests demonstrating: "${s.slice(0, 100)}".`,
        quote: s.slice(0, 150),
        derivation: `Derived by analyzing stakeholder requirement for "${category.toLowerCase()}" in statement: "${s.slice(0, 100)}". Classified as ${priority} based on business criticality.`,
        stakeholderName: detectedStakeholders[requirements.length % detectedStakeholders.length].name
      });
    }
  }

  const factorPatterns = {
    stability: [/stable|fixed scope|change|evolv/i, /stable|fixed scope/i.test(text) ? 4 : 2, 'Based on transcript statements regarding requirement evolution and rate of change.'],
    risk: [/risk|fraud|loss|failure|critical|financial/i, /critical|severe|loss|fraud/i.test(text) ? 5 : 3, 'Evaluated from stakeholder impact descriptions and consequence of system failures.'],
    uncertainty: [/uncertain|unproven|prototype|integration|technical|legacy/i, /uncertain|unproven|prototype/i.test(text) ? 4 : 2, 'Assessed from discussions around new technologies, legacy connections, or unproven APIs.'],
    assurance: [/audit|approval|verif|compliance|regulat|test/i, /audit|approval|compliance|regulat/i.test(text) ? 5 : 3, 'Derived from verification, formal sign-off, and regulatory audit mandates in transcript.'],
    feedback: [/stakeholder|feedback|review|weekly|daily/i, /weekly|daily|frequent/i.test(text) ? 4 : 3, 'Based on stakeholder availability and cadence of review cycles mentioned.'],
    delivery: [/release|increment|deploy|deadline|delivery/i, /increment|weekly|frequent/i.test(text) ? 4 : 2, 'Assessed from release milestones and capability to deploy incremental feature batches.'],
    capability: [/team|automat|experience|capacity|pipeline/i, /automat|experienced|mature/i.test(text) ? 4 : 3, 'Derived from team skills, automated tooling, and continuous integration maturity.'],
    constraints: [/budget|schedule|legacy|vendor|dependenc|deadline/i, /fixed|legacy|vendor/i.test(text) ? 4 : 3, 'Identified from fixed timeline, vendor integration, or regulatory compliance deadlines.']
  };

  const factors = {};
  for (const [key, [regex, value, reason]] of Object.entries(factorPatterns)) {
    const matchedLine = lines.find(l => regex.test(l)) || lines[0] || 'Project transcript';
    factors[key] = {
      value,
      reason,
      quote: matchedLine.slice(0, 150)
    };
  }

  return {
    summary: 'Document intake analysis extracted stakeholders, requirements, and decision factors from transcript.',
    stakeholders: detectedStakeholders,
    messages: detectedStakeholders.map(s => ({
      stakeholderName: s.name,
      text: lines.find(l => l.toLowerCase().includes(s.name.toLowerCase())) || lines.slice(0, 3).join(' ') || 'Stakeholder transcript contribution.'
    })),
    requirements,
    factors,
    conflicts: []
  };
}

export function applyDocumentIntake(project, intakeData, uid, now) {
  const stakeholderMap = new Map();
  for (const s of intakeData.stakeholders) {
    let existing = project.stakeholders.find(x => x.name.toLowerCase() === s.name.toLowerCase());
    if (!existing) {
      existing = { id: uid('s-'), name: s.name, role: s.role, status: 'complete' };
      project.stakeholders.push(existing);
    } else {
      existing.status = 'complete';
    }
    stakeholderMap.set(s.name.toLowerCase(), existing);
  }
  const defaultStakeholder = project.stakeholders[0] || { id: uid('s-'), name: 'Key Stakeholders', role: 'Business / product owner', status: 'complete' };

  if (Array.isArray(intakeData.messages) && intakeData.messages.length) {
    for (const m of intakeData.messages) {
      const s = stakeholderMap.get((m.stakeholderName || '').toLowerCase()) || defaultStakeholder;
      project.messages.push({
        id: uid('m-'),
        stakeholderId: s.id,
        role: 'user',
        text: m.text,
        createdAt: now(),
        mode: 'document-intake'
      });
    }
  }

  for (const s of project.stakeholders) {
    if (!project.messages.some(m => m.stakeholderId === s.id && m.role === 'user')) {
      project.messages.push({
        id: uid('m-'),
        stakeholderId: s.id,
        role: 'user',
        text: `Stakeholder interview notes and transcript for ${s.name} (${s.role}).`,
        createdAt: now(),
        mode: 'document-intake'
      });
    }
  }

  const userMessages = project.messages.filter(m => m.role === 'user');
  const userMessageIds = userMessages.map(m => m.id);

  for (const r of intakeData.requirements) {
    const s = stakeholderMap.get((r.stakeholderName || '').toLowerCase()) || defaultStakeholder;
    const matchingMsg = userMessages.find(m => m.text.toLowerCase().includes(r.quote.toLowerCase())) ||
      userMessages.find(m => m.stakeholderId === s.id) ||
      userMessages[0];
    const sourceIds = matchingMsg ? [matchingMsg.id] : [userMessageIds[0]];

    project.requirements.push({
      id: `REQ-${String(project.requirements.length + 1).padStart(3, '0')}`,
      statement: r.statement,
      category: r.category || 'Functional',
      priority: r.priority || 'Should',
      acceptanceCriteria: r.acceptanceCriteria || '',
      quote: r.quote,
      derivation: r.derivation || '',
      sourceIds,
      stakeholderId: s.id,
      status: 'confirmed',
      createdAt: now()
    });
  }

  for (const [factorId, f] of Object.entries(intakeData.factors)) {
    const matchingMsg = userMessages.find(m => m.text.toLowerCase().includes((f.quote || '').toLowerCase())) ||
      userMessages[0];
    const sourceIds = matchingMsg ? [matchingMsg.id] : [userMessageIds[0]];
    project.factors[factorId] = {
      value: f.value,
      reason: f.reason,
      quote: f.quote || '',
      sourceIds,
      status: 'confirmed'
    };
  }

  for (const c of intakeData.conflicts) {
    if (userMessageIds.length >= 2) {
      project.conflicts.push({
        id: uid('c-'),
        description: c.description,
        sourceIds: [userMessageIds[0], userMessageIds[1]],
        status: 'open'
      });
    }
  }

  project.messages.push({
    id: uid('m-'),
    stakeholderId: defaultStakeholder.id,
    role: 'assistant',
    text: `Document intake processed: extracted ${intakeData.requirements.length} formal requirements with AI derivations, initialized ${project.stakeholders.length} stakeholder profiles, and populated project decision factors.`,
    createdAt: now(),
    mode: 'document-intake'
  });

  return project;
}
