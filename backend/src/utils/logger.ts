import pino from 'pino';
import config from '../config/env';

// Create logger instance with environment-specific configuration
const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport: config.isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  } : undefined,
  
  // Base logging context
  base: {
    pid: process.pid,
    hostname: require('os').hostname(),
    service: 'devboard-api',
    version: '1.0.0',
    environment: config.NODE_ENV
  },
  
  // Timestamp formatting
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Serialization
  serializers: {
    // Hide sensitive data in logs
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
    
    // Custom serializers
    socket: (socket: any) => ({
      id: socket.id,
      connected: socket.connected,
      rooms: Array.from(socket.rooms || [])
    }),
    
    // Sanitize database objects
    user: (user: any) => ({
      id: user.id,
      username: user.username
      // Remove any sensitive fields
    })
  }
});

// Helper functions for structured logging
export const logInfo = (message: string, meta?: any) => {
  logger.info(meta || {}, message);
};

export const logError = (message: string, error?: Error | any, meta?: any) => {
  logger.error({ 
    ...meta, 
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : undefined 
  }, message);
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(meta || {}, message);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(meta || {}, message);
};

// Specialized logging functions
export const logSocketEvent = (event: string, socketId: string, meta?: any) => {
  logger.info({
    type: 'socket_event',
    event,
    socketId,
    ...meta
  }, `Socket event: ${event}`);
};

export const logHttpRequest = (method: string, url: string, statusCode: number, duration: number, meta?: any) => {
  logger.info({
    type: 'http_request',
    method,
    url,
    statusCode,
    duration,
    ...meta
  }, `${method} ${url} - ${statusCode} (${duration}ms)`);
};

export const logDatabaseQuery = (query: string, duration: number, meta?: any) => {
  logger.debug({
    type: 'database_query',
    query,
    duration,
    ...meta
  }, `DB Query (${duration}ms): ${query}`);
};

export const logSecurityEvent = (event: string, ip?: string, userAgent?: string, meta?: any) => {
  logger.warn({
    type: 'security_event',
    event,
    ip,
    userAgent,
    ...meta
  }, `Security Event: ${event}`);
};

// Create child logger with additional context
export const createChildLogger = (context: any) => {
  return logger.child(context);
};

// Default export
export default logger;
