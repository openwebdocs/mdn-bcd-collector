//
// mdn-bcd-collector: lib/logger.ts
// Logging output module to log to either the console or GAE cloud
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import winston from "winston";
import {LoggingWinston} from "@google-cloud/logging-winston";

/**
 * Retrieves the appropriate transport for logging based on the environment.
 * If the GOOGLE_APPLICATION_CREDENTIALS environment variable is set, it returns a GAE cloud transport.
 * Otherwise, it returns a console transport.
 * @returns The logging transport.
 */
const getTransport = (): winston.transport => {
  /* c8 ignore next 3 */
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new LoggingWinston();
  }

  return new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  });
};

const logger = winston.createLogger({
  level: "info",
  transports: [getTransport()],
  silent: process.env.NODE_ENV === "test",
});

export default logger;
