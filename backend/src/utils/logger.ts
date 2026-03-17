const isDev = process.env.NODE_ENV !== "production";

function timestamp() {
  return new Date().toISOString();
}

export const logger = {
  info: (msg: string, meta?: object) => {
    console.log(`[${timestamp()}] INFO  ${msg}`, meta ? JSON.stringify(meta) : "");
  },
  warn: (msg: string, meta?: object) => {
    console.warn(`[${timestamp()}] WARN  ${msg}`, meta ? JSON.stringify(meta) : "");
  },
  error: (msg: string, meta?: object) => {
    console.error(`[${timestamp()}] ERROR ${msg}`, meta ? JSON.stringify(meta) : "");
  },
  debug: (msg: string, meta?: object) => {
    if (isDev) {
      console.debug(`[${timestamp()}] DEBUG ${msg}`, meta ? JSON.stringify(meta) : "");
    }
  },
};
