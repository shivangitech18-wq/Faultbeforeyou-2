import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5500',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  gemmaModel: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
  jwtSecret: process.env.JWT_SECRET || 'faultbeforeyou-default-jwt-secret-key-2026',
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: path.resolve(__dirname, '../../data/faultbeforeyou.db')
};
