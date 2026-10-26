import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';

// Allowed classification categories per specification
export const ALLOWED_CATEGORIES = [
  'Hardware',
  'Supplies',
  'Connectivity',
  'Software',
  'Display',
  'Other'
];

// Allowed severity levels per specification
export const ALLOWED_SEVERITIES = [
  'Low',
  'Medium',
  'High'
];

// Simple in-memory rate limiter: max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;
let requestTimestamps = [];

function checkRateLimit() {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error('AI rate limit reached. Please wait a few seconds before submitting another AI request.');
  }
  requestTimestamps.push(now);
}

// Input sanitizer & length limiter
function sanitizeInput(text, maxLength = 1000) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().slice(0, maxLength);
}

// Redact any potential API keys or secrets from error messages
function sanitizeErrorMessage(error) {
  if (!error) return 'Unknown error';
  const msg = error.message || String(error);
  return msg.replace(/[a-zA-Z0-9_\-]{30,}/g, '[REDACTED_KEY]');
}

// Lazy-initialized GenAI client
let genAIClient = null;

export function getGenAIClient() {
  if (!config.geminiApiKey || config.geminiApiKey.trim() === '' || config.geminiApiKey === 'your_api_key_here') {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return genAIClient;
}

/**
 * Returns current status of Gemma 4 integration
 */
export function getAIStatus() {
  const hasKey = Boolean(config.geminiApiKey && config.geminiApiKey !== 'your_api_key_here');
  return {
    configured: hasKey,
    model: config.gemmaModel,
    sdk: '@google/genai',
    status: hasKey ? 'ready' : 'unconfigured',
    message: hasKey
      ? `Gemma 4 model ${config.gemmaModel} configured via Google AI Studio.`
      : 'GEMINI_API_KEY is not configured in .env. Fault management runs in manual mode.'
  };
}

/**
 * Core wrapper to call Gemma with timeout and safe error handling
 */
async function callGemmaWithTimeout(prompt, timeoutMs = 15000) {
  checkRateLimit();

  const client = getGenAIClient();
  if (!client) {
    throw new Error('Gemma API key is not configured. Set GEMINI_API_KEY in .env to enable Gemma 4 intelligence.');
  }

  // Create an abort controller for strict request timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.models.generateContent({
      model: config.gemmaModel,
      contents: prompt
    });

    clearTimeout(timeoutId);

    if (!response || !response.text) {
      throw new Error('Empty response received from Gemma model.');
    }

    return response.text;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Gemma request timed out after ${timeoutMs / 1000} seconds.`);
    }
    // Safe logging without credentials
    console.error('Safe Gemma Error:', sanitizeErrorMessage(err));
    throw new Error(sanitizeErrorMessage(err));
  }
}

/**
 * Helper to clean and parse JSON from model output that might contain markdown backticks
 */
function extractAndParseJSON(rawText) {
  if (!rawText) return null;
  let cleaned = rawText.trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  // Find first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

// -------------------------------------------------------------
// FEATURE A: FAULT INTELLIGENCE
// -------------------------------------------------------------

/**
 * Classifies a user-reported equipment fault.
 * Returns structured classification, severity, recommended immediate steps, and technician requirement.
 */
export async function classifyFaultReport(description, equipmentMetadata = {}) {
  const sanitizedDesc = sanitizeInput(description, 1000);
  if (!sanitizedDesc) {
    throw new Error('Fault description is required.');
  }

  const prompt = `You are the equipment diagnostics intelligence engine in the FaultBeforeYou system.
Analyze the following equipment fault report and classify it accurately according to the strict application schema.

EQUIPMENT DETAILS:
- ID: ${equipmentMetadata.id || 'Unknown'}
- Name: ${equipmentMetadata.name || 'Shared Equipment'}
- Type: ${equipmentMetadata.type || 'Equipment'}
- Location: ${equipmentMetadata.location || 'Unknown'}

USER FAULT REPORT:
"${sanitizedDesc}"

SCHEMA REQUIREMENTS:
Return ONLY a valid, single JSON object (with NO extra commentary, explanations outside JSON, or markdown fences):
{
  "category": "Hardware" | "Supplies" | "Connectivity" | "Software" | "Display" | "Other",
  "summary": "One concise sentence summarizing the primary fault symptom",
  "suggestedSeverity": "Low" | "Medium" | "High",
  "recommendedNextStep": "Actionable immediate instruction for user or staff",
  "technicianRequired": true | false,
  "reasoningSummary": "1-2 sentences explaining why this category and severity were assigned"
}

RULES:
- "category" MUST be one of: Hardware, Supplies, Connectivity, Software, Display, Other.
- "suggestedSeverity" MUST be one of: Low, Medium, High.
- If the issue involves paper jams, power failures, broken parts, or mechanical sounds, set category to Hardware or Supplies.
- If network offline, cable unplugged, or signal drop, set category to Connectivity.
- If severe risk, smoke, burning smell, or complete loss of core function, set severity to High.
- AI classifications are advisory only; human verification is always required for recovery.
`;

  try {
    const rawOutput = await callGemmaWithTimeout(prompt);
    const parsed = extractAndParseJSON(rawOutput);

    if (parsed) {
      // Validate category
      const category = ALLOWED_CATEGORIES.includes(parsed.category) ? parsed.category : 'Hardware';
      // Validate severity
      const severity = ALLOWED_SEVERITIES.includes(parsed.suggestedSeverity) ? parsed.suggestedSeverity : 'Medium';
      // Validate technicianRequired
      const technicianRequired = Boolean(parsed.technicianRequired);

      return {
        category,
        summary: parsed.summary || sanitizedDesc.slice(0, 100),
        suggestedSeverity: severity,
        recommendedNextStep: parsed.recommendedNextStep || 'Inspect equipment and follow approved manual steps.',
        technicianRequired,
        reasoningSummary: parsed.reasoningSummary || 'Classified based on reported symptom patterns.'
      };
    }
  } catch (err) {
    // If Gemma API is unconfigured or failed, fall back to robust rule-based classification
    // clearly indicating fallback
    console.warn('Gemma inference not completed; using deterministic fallback:', err.message);
    return getFallbackClassification(sanitizedDesc, equipmentMetadata, err.message);
  }

  // If parsing failed
  return getFallbackClassification(sanitizedDesc, equipmentMetadata, 'Could not parse JSON from model output');
}

/**
 * Deterministic rule-based fallback when Gemma API key is missing or network unavailable
 */
export function getFallbackClassification(description, equipmentMetadata, reason = 'API unconfigured') {
  const lower = description.toLowerCase();
  let category = 'Hardware';
  let severity = 'Medium';
  let technicianRequired = false;
  let recommendedNextStep = 'Review the approved equipment manual or report to on-duty staff.';

  if (lower.includes('toner') || lower.includes('ink') || lower.includes('paper out') || lower.includes('empty')) {
    category = 'Supplies';
    severity = 'Low';
    recommendedNextStep = 'Check and replenish paper or toner supplies according to manual.';
  } else if (lower.includes('jam') || lower.includes('stuck') || lower.includes('feed') || lower.includes('roller')) {
    category = 'Hardware';
    severity = 'Medium';
    technicianRequired = lower.includes('fuser') || lower.includes('burn') || lower.includes('gear');
    recommendedNextStep = 'Clear user-accessible feed path as shown in manual Sec 3.1; do not force jammed paper.';
  } else if (lower.includes('offline') || lower.includes('ip') || lower.includes('network') || lower.includes('cable') || lower.includes('wifi') || lower.includes('connect')) {
    category = 'Connectivity';
    severity = 'Medium';
    recommendedNextStep = 'Check network and video cables are securely latched; power cycle network adapter.';
  } else if (lower.includes('screen') || lower.includes('display') || lower.includes('hdmi') || lower.includes('no signal') || lower.includes('project')) {
    category = 'Display';
    severity = 'Low';
    recommendedNextStep = 'Verify source cable and display settings (Win+P or macOS Display Mirror).';
  } else if (lower.includes('boot') || lower.includes('crash') || lower.includes('freeze') || lower.includes('os') || lower.includes('driver')) {
    category = 'Software';
    severity = 'Medium';
    technicianRequired = true;
    recommendedNextStep = 'Perform clean reboot and run built-in diagnostics; contact technician if boot loop persists.';
  }

  if (lower.includes('smoke') || lower.includes('spark') || lower.includes('burn') || lower.includes('fire') || lower.includes('danger')) {
    severity = 'High';
    technicianRequired = true;
    recommendedNextStep = 'DANGER: Immediately disconnect power and notify authorized safety technician!';
  }

  return {
    category,
    summary: description.slice(0, 100),
    suggestedSeverity: severity,
    recommendedNextStep,
    technicianRequired,
    reasoningSummary: `Deterministic analysis (${reason}): Detected keywords matching standard ${category} fault signature.`
  };
}

// -------------------------------------------------------------
// FEATURE B: APPROVED-MANUAL TROUBLESHOOTING
// -------------------------------------------------------------

/**
 * Generates manual-grounded troubleshooting guidance strictly based on supplied manual passages.
 */
export async function generateManualGroundedTroubleshooting(equipmentType, faultDescription, manualPassages = []) {
  const sanitizedDesc = sanitizeInput(faultDescription, 1000);

  // If no passages found in knowledge base
  if (!manualPassages || manualPassages.length === 0) {
    return {
      grounded: false,
      guidance: 'No verified troubleshooting guidance was found in the available manual.',
      passagesUsed: [],
      userLevelSteps: [],
      technicianWarning: null,
      sourceManual: null
    };
  }

  // Format passages for prompt context
  const passageContext = manualPassages.map((p, idx) => `
[PASSAGE ${idx + 1}]
Manual: ${p.manual_name}
Section: ${p.section_number} - ${p.title}
Audience: ${p.is_user_safe ? 'Safe for General Users' : 'RESTRICTED: Authorized Technicians Only'}
Content: ${p.content}
`).join('\n');

  const prompt = `You are the troubleshooting assistant for the FaultBeforeYou equipment safety platform.
Provide step-by-step troubleshooting guidance for the reported equipment fault, STRICTLY grounded in the provided approved manual passages.

EQUIPMENT TYPE: ${equipmentType}
REPORTED FAULT: "${sanitizedDesc}"

APPROVED MANUAL PASSAGES (GROUND TRUTH ONLY):
${passageContext}

STRICT GROUNDING RULES:
1. Explain ONLY the troubleshooting steps that are explicitly supported by the approved passages above.
2. DO NOT invent, assume, or fabricate any steps, tools, screw types, or procedures not present in the passages.
3. Explicitly cite the manual name and section number (e.g. "${manualPassages[0].manual_name}, ${manualPassages[0].section_number}").
4. If an internal repair, electrical hazard, high-temperature component (like a fuser), or lamp replacement is mentioned, EXPLICITLY flag it as "Technician Required - Do Not Attempt".
5. Only present user-level steps for safe actions (is_user_safe = 1).
6. If the passages do not contain steps for this specific issue, respond ONLY with: "No verified troubleshooting guidance was found in the available manual."

OUTPUT FORMAT:
Return a clear, structured JSON object:
{
  "grounded": true,
  "sourceManual": "${manualPassages[0].manual_name}",
  "sectionsCited": ["${manualPassages[0].section_number}"],
  "userLevelSteps": [
    "Step 1: ...",
    "Step 2: ..."
  ],
  "technicianWarning": "Warning text if technician is required, or null if safe for user",
  "verificationInstruction": "Exact test to verify recovery as noted in the manual",
  "guidanceSummary": "Clear 2-sentence summary of the grounded recovery procedure"
}
`;

  try {
    const rawOutput = await callGemmaWithTimeout(prompt);
    const parsed = extractAndParseJSON(rawOutput);

    if (parsed && parsed.grounded !== false) {
      return {
        grounded: true,
        guidance: parsed.guidanceSummary || 'Follow verified manual procedures.',
        sourceManual: parsed.sourceManual || manualPassages[0].manual_name,
        sectionsCited: parsed.sectionsCited || [manualPassages[0].section_number],
        userLevelSteps: Array.isArray(parsed.userLevelSteps) ? parsed.userLevelSteps : [],
        technicianWarning: parsed.technicianWarning || null,
        verificationInstruction: parsed.verificationInstruction || 'Conduct recovery test verification per manual.',
        passagesUsed: manualPassages.map(p => ({
          manual: p.manual_name,
          section: p.section_number,
          title: p.title,
          isUserSafe: Boolean(p.is_user_safe),
          snippet: p.content
        }))
      };
    }
  } catch (err) {
    console.warn('Gemma manual grounding fallback triggered:', err.message);
  }

  // Fallback grounded extraction from the actual database passages
  return getFallbackManualGuidance(manualPassages, sanitizedDesc);
}

/**
 * Deterministic fallback extractor directly quoting the approved passages
 */
export function getFallbackManualGuidance(manualPassages, query) {
  if (!manualPassages || manualPassages.length === 0) {
    return {
      grounded: false,
      guidance: 'No verified troubleshooting guidance was found in the available manual.',
      passagesUsed: [],
      userLevelSteps: [],
      technicianWarning: null,
      sourceManual: null
    };
  }

  const primary = manualPassages[0];
  const hasUnsafe = manualPassages.some(p => !p.is_user_safe);

  // Extract numbered steps from content if present
  const stepMatches = primary.content.match(/\d\)[^0-9]+/g);
  const steps = stepMatches
    ? stepMatches.map(s => s.trim())
    : [primary.content];

  return {
    grounded: true,
    guidance: `Troubleshooting procedure grounded in ${primary.manual_name} (${primary.section_number}: ${primary.title}).`,
    sourceManual: primary.manual_name,
    sectionsCited: manualPassages.map(p => p.section_number),
    userLevelSteps: primary.is_user_safe ? steps : ['CAUTION: This procedure contains internal hazard steps reserved for technicians.'],
    technicianWarning: hasUnsafe
      ? 'WARNING: One or more manual passages require authorized technician intervention due to thermal or electrical hazard.'
      : null,
    verificationInstruction: 'Conduct diagnostic test print/pattern verification before returning equipment to available status.',
    passagesUsed: manualPassages.map(p => ({
      manual: p.manual_name,
      section: p.section_number,
      title: p.title,
      isUserSafe: Boolean(p.is_user_safe),
      snippet: p.content
    }))
  };
}

// -------------------------------------------------------------
// FEATURE C: INCIDENT INTELLIGENCE
// -------------------------------------------------------------

/**
 * Summarizes equipment historical incidents, past fixes, verified successes, and patterns.
 */
export async function summarizeEquipmentIncidentHistory(equipmentMetadata, incidentHistory = [], verificationHistory = []) {
  if (!incidentHistory || incidentHistory.length === 0) {
    return {
      hasSufficientHistory: false,
      summary: 'Insufficient incident history recorded for this equipment. No recurring patterns or past repair verifications available in the database.',
      commonFaults: [],
      verifiedFixes: [],
      patterns: 'No historical pattern data.',
      relevantIncidentIds: []
    };
  }

  // Format incident records concisely
  const incidentRecordsText = incidentHistory.map(inc => `
- Incident #${inc.id} [${inc.status.toUpperCase()}]: Reported "${inc.description}" (Category: ${inc.category || 'N/A'}, Severity: ${inc.severity || 'N/A'}).
  Created: ${inc.created_at}, Resolved: ${inc.resolved_at || 'Unresolved'}
  Technician Note: ${inc.technician_note || 'None recorded'}
`).join('\n');

  const verificationRecordsText = verificationHistory.map(v => `
- Verification for Incident #${v.incident_id}: Test "${v.test_name}" by ${v.verifier_name} -> RESULT: ${v.test_result.toUpperCase()} (${v.notes || 'No notes'}).
`).join('\n');

  const prompt = `You are the Incident Intelligence analyzer for FaultBeforeYou.
Analyze the following recorded equipment incident and repair history.

EQUIPMENT:
- ID: ${equipmentMetadata.id}
- Name: ${equipmentMetadata.name}
- Type: ${equipmentMetadata.type}
- Location: ${equipmentMetadata.location}

RECORDED INCIDENTS (${incidentHistory.length} total):
${incidentRecordsText}

RECORDED VERIFICATIONS:
${verificationRecordsText || 'No verification records recorded.'}

RULES:
1. Base your summary STRICTLY on the recorded incidents and verification records above.
2. Clearly distinguish between RECORDED FACTS (e.g., specific tests passed, specific parts replaced) and AI-GENERATED INTERPRETATIONS.
3. If history has fewer than 2 incidents, state clearly that history is limited.
4. Do NOT invent incidents, fake test names, or pretend a repair succeeded if it failed.
5. Reference the exact Incident IDs (e.g., #1, #2).

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "hasSufficientHistory": ${incidentHistory.length >= 2},
  "summary": "Concise factual summary of equipment reliability and recent service history",
  "commonFaults": ["List of recurring fault categories or symptoms"],
  "previouslyRecordedRepairs": ["List of technician actions recorded"],
  "verifiedFixes": ["Specific repairs that passed authorized human verification"],
  "patternsSupportedByRecords": "1-2 sentences on trends evidenced by the database",
  "relevantIncidentIds": [${incidentHistory.map(i => i.id).join(', ')}]
}
`;

  try {
    const rawOutput = await callGemmaWithTimeout(prompt);
    const parsed = extractAndParseJSON(rawOutput);

    if (parsed) {
      return {
        hasSufficientHistory: incidentHistory.length >= 2,
        summary: parsed.summary,
        commonFaults: parsed.commonFaults || [],
        previouslyRecordedRepairs: parsed.previouslyRecordedRepairs || [],
        verifiedFixes: parsed.verifiedFixes || [],
        patternsSupportedByRecords: parsed.patternsSupportedByRecords,
        relevantIncidentIds: parsed.relevantIncidentIds || incidentHistory.map(i => i.id)
      };
    }
  } catch (err) {
    console.warn('Gemma incident intelligence fallback triggered:', err.message);
  }

  // Deterministic fallback based directly on recorded rows
  const verifiedList = verificationHistory
    .filter(v => v.test_result === 'passed')
    .map(v => `Incident #${v.incident_id}: Verified via "${v.test_name}" (${v.notes})`);

  const repairList = incidentHistory
    .filter(i => i.technician_note)
    .map(i => `Incident #${i.id}: ${i.technician_note}`);

  return {
    hasSufficientHistory: incidentHistory.length >= 2,
    summary: `Equipment ${equipmentMetadata.id} has ${incidentHistory.length} recorded incident(s). Database contains ${verificationHistory.length} verification record(s).`,
    commonFaults: [...new Set(incidentHistory.map(i => i.category || 'Hardware'))],
    previouslyRecordedRepairs: repairList,
    verifiedFixes: verifiedList,
    patternsSupportedByRecords: incidentHistory.length >= 2
      ? 'Recorded history shows successful resolution following technician intervention and formal test verification.'
      : 'Single incident recorded; insufficient history to establish recurring trends.',
    relevantIncidentIds: incidentHistory.map(i => i.id)
  };
}

// -------------------------------------------------------------
// TECHNICIAN NOTE STRUCTURING
// -------------------------------------------------------------

/**
 * Structures raw technician notes without adding any unreported events or actions.
 */
export async function structureTechnicianNotes(rawNote, equipmentMetadata = {}) {
  const sanitized = sanitizeInput(rawNote, 800);
  if (!sanitized) {
    throw new Error('Technician note is required.');
  }

  const prompt = `You are a technician documentation assistant for FaultBeforeYou.
Structure the following raw technician field notes into standard maintenance record items.

EQUIPMENT: ${equipmentMetadata.name || 'Shared Device'} (${equipmentMetadata.id || 'N/A'})
RAW TECHNICIAN NOTE:
"${sanitized}"

CRITICAL RULE:
Strictly preserve the facts recorded by the technician. DO NOT add any actions, parts, replacements, or tests that the technician did not mention.

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "actionsTaken": ["Specific action mentioned by technician"],
  "partsInspected": ["Components mentioned in the note"],
  "rootCauseIdentified": "Root cause as stated or implied in note",
  "readinessForVerification": true | false,
  "formattedSummary": "Clean, professional 1-2 sentence technician note"
}
`;

  try {
    const rawOutput = await callGemmaWithTimeout(prompt);
    const parsed = extractAndParseJSON(rawOutput);

    if (parsed) {
      return {
        actionsTaken: Array.isArray(parsed.actionsTaken) ? parsed.actionsTaken : [sanitized],
        partsInspected: Array.isArray(parsed.partsInspected) ? parsed.partsInspected : [],
        rootCauseIdentified: parsed.rootCauseIdentified || 'Refer to raw technician notes',
        readinessForVerification: Boolean(parsed.readinessForVerification),
        formattedSummary: parsed.formattedSummary || sanitized
      };
    }
  } catch (err) {
    console.warn('Gemma note structuring fallback triggered:', err.message);
  }

  return {
    actionsTaken: [sanitized],
    partsInspected: ['Refer to technician entry'],
    rootCauseIdentified: 'Documented in technician note',
    readinessForVerification: true,
    formattedSummary: sanitized
  };
}
