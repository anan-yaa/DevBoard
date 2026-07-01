// Environment variable validation and configuration
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'CORS_ORIGIN',
] as const;

// Validate required environment variables
const missingEnvVars: string[] = [];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  }
}

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Environment configuration
export const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV!,
  PORT: parseInt(process.env.PORT || '5000', 10),
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,
    
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN!.split(',').map(origin => origin.trim()),
  
  // WebSocket
WS_URL: process.env.WS_URL || 'localhost:5000'  
  // Development defaults
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

// Log configuration (without secrets)
console.log('🔧 Environment Configuration:', {
  NODE_ENV: config.NODE_ENV,
  PORT: config.PORT,
  DATABASE_URL: config.DATABASE_URL ? '***CONFIGURED***' : 'MISSING',
  CORS_ORIGIN: config.CORS_ORIGIN,
  WS_URL: config.WS_URL,
  isDevelopment: config.isDevelopment,
  isProduction: config.isProduction,
});

export default config;
