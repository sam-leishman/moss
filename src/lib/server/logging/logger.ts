export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	FATAL = 4
}

export interface LogEntry {
	timestamp: Date;
	level: LogLevel;
	message: string;
	context?: string;
	metadata?: Record<string, unknown>;
	error?: Error;
}

export interface LoggerOptions {
	minLevel?: LogLevel;
	context?: string;
	enableConsole?: boolean;
	enableFile?: boolean;
}

class Logger {
	private minLevel: LogLevel;
	private context?: string;
	private enableConsole: boolean;
	private enableFile: boolean;

	constructor(options: LoggerOptions = {}) {
		this.minLevel = options.minLevel ?? this.getDefaultLogLevel();
		this.context = options.context;
		this.enableConsole = options.enableConsole ?? true;
		this.enableFile = options.enableFile ?? false;
	}

	private getDefaultLogLevel(): LogLevel {
		const env = process.env.NODE_ENV;
		const logLevel = process.env.LOG_LEVEL?.toUpperCase();

		if (logLevel) {
			switch (logLevel) {
				case 'DEBUG': return LogLevel.DEBUG;
				case 'INFO': return LogLevel.INFO;
				case 'WARN': return LogLevel.WARN;
				case 'ERROR': return LogLevel.ERROR;
				case 'FATAL': return LogLevel.FATAL;
			}
		}

		return env === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
	}

	private shouldLog(level: LogLevel): boolean {
		return level >= this.minLevel;
	}

	private safeStringify(obj: Record<string, unknown>): string {
		try {
			return JSON.stringify(obj, (key, value) => {
				if (value instanceof Error) {
					return {
						name: value.name,
						message: value.message,
						stack: value.stack
					};
				}
				return value;
			});
		} catch (error) {
			return '[Circular or non-serializable object]';
		}
	}

	private formatMessage(entry: LogEntry): string {
		const timestamp = entry.timestamp.toISOString();
		const level = LogLevel[entry.level].padEnd(5);
		const context = entry.context ? `[${entry.context}]` : '';
		const metadata = entry.metadata ? ` ${this.safeStringify(entry.metadata)}` : '';
		
		return `[${timestamp}] ${level} ${context} ${entry.message}${metadata}`;
	}

	private log(entry: LogEntry): void {
		if (!this.shouldLog(entry.level)) {
			return;
		}

		const formattedMessage = this.formatMessage(entry);

		if (this.enableConsole) {
			switch (entry.level) {
				case LogLevel.DEBUG:
					console.debug(formattedMessage);
					break;
				case LogLevel.INFO:
					console.info(formattedMessage);
					break;
				case LogLevel.WARN:
					console.warn(formattedMessage);
					break;
				case LogLevel.ERROR:
				case LogLevel.FATAL:
					console.error(formattedMessage);
					if (entry.error) {
						console.error(entry.error.stack);
					}
					break;
			}
		}
	}

	debug(message: string, metadata?: Record<string, unknown>): void {
		this.log({
			timestamp: new Date(),
			level: LogLevel.DEBUG,
			message,
			context: this.context,
			metadata
		});
	}

	info(message: string, metadata?: Record<string, unknown>): void {
		this.log({
			timestamp: new Date(),
			level: LogLevel.INFO,
			message,
			context: this.context,
			metadata
		});
	}

	warn(message: string, metadata?: Record<string, unknown>): void {
		this.log({
			timestamp: new Date(),
			level: LogLevel.WARN,
			message,
			context: this.context,
			metadata
		});
	}

	error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
		this.log({
			timestamp: new Date(),
			level: LogLevel.ERROR,
			message,
			context: this.context,
			metadata,
			error
		});
	}

	fatal(message: string, error?: Error, metadata?: Record<string, unknown>): void {
		this.log({
			timestamp: new Date(),
			level: LogLevel.FATAL,
			message,
			context: this.context,
			metadata,
			error
		});
	}

	child(context: string): Logger {
		const childContext = this.context ? `${this.context}:${context}` : context;
		return new Logger({
			minLevel: this.minLevel,
			context: childContext,
			enableConsole: this.enableConsole,
			enableFile: this.enableFile
		});
	}
}

const defaultLogger = new Logger();

export function createLogger(options?: LoggerOptions): Logger {
	return new Logger(options);
}

export function getLogger(context?: string): Logger {
	if (context) {
		return defaultLogger.child(context);
	}
	return defaultLogger;
}

export { Logger };
