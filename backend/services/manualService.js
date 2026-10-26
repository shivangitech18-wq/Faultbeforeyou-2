import { db } from '../db/database.js';

// Common stop words to exclude from keyword search
const STOP_WORDS = new Set([
  'the', 'and', 'a', 'an', 'in', 'on', 'of', 'at', 'to', 'for', 'with', 'by',
  'is', 'are', 'was', 'were', 'it', 'this', 'that', 'from', 'as', 'be', 'or',
  'has', 'had', 'have', 'my', 'me', 'our', 'we', 'you', 'your', 'showing', 'not'
]);

/**
 * Tokenize input text into clean lowercase search terms
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

/**
 * Retrieve approved manual passages for a specific equipment type and fault description.
 * Uses lightweight token matching and relevance scoring.
 * 
 * @param {string} equipmentType - 'printer', 'projector', 'desktop', 'scanner'
 * @param {string} faultDescription - User-submitted error description
 * @param {number} maxResults - Max passages to retrieve
 * @returns {Array<object>} Ranked matching passages
 */
export function retrieveApprovedManualPassages(equipmentType, faultDescription, maxResults = 3) {
  if (!equipmentType) return [];

  // 1. Fetch all passages for this equipment type
  const passages = db.query(
    `SELECT id, equipment_type, manual_name, section_number, title, content, keywords, is_user_safe
     FROM manual_passages
     WHERE equipment_type = ?`,
    [equipmentType.toLowerCase()]
  );

  if (!passages || passages.length === 0) {
    return [];
  }

  // 2. Tokenize fault description
  const queryTokens = tokenize(faultDescription);
  if (queryTokens.length === 0) {
    return passages.slice(0, 1); // default to general passage if no tokens
  }

  // 3. Score each passage
  const scored = passages.map(p => {
    let score = 0;
    const passageKeywords = tokenize(p.keywords);
    const titleTokens = tokenize(p.title);
    const contentTokens = tokenize(p.content);

    for (const token of queryTokens) {
      // Direct keyword hit (high weight)
      if (passageKeywords.includes(token)) {
        score += 5;
      }
      // Title hit (very high weight)
      if (titleTokens.includes(token)) {
        score += 8;
      }
      // Content hit (moderate weight)
      if (contentTokens.includes(token)) {
        score += 2;
      }
      // Partial matching for words like "jam" vs "jammed", "print" vs "printer"
      for (const kw of passageKeywords) {
        if (kw !== token && (kw.startsWith(token) || token.startsWith(kw))) {
          score += 3;
        }
      }
    }

    return { ...p, score };
  });

  // 4. Filter only passages with positive score and sort descending
  const relevant = scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

  return relevant.slice(0, maxResults);
}

/**
 * Get all manuals and sections grouped by equipment type
 */
export function getAllManuals() {
  return db.query(`
    SELECT id, equipment_type, manual_name, section_number, title, content, is_user_safe
    FROM manual_passages
    ORDER BY equipment_type, section_number
  `);
}

/**
 * Get a single passage by ID
 */
export function getManualPassageById(id) {
  return db.get(
    `SELECT * FROM manual_passages WHERE id = ?`,
    [id]
  );
}
