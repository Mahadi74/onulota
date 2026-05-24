import yaml from 'js-yaml'

export interface ConfigurationObject {
  databaseUrl: string
  jwtSecret: string
  port: number
  [key: string]: unknown
}

export interface ParseError {
  message: string
  line?: number
  column?: number
}

export type ParseResult<T> =
  | { success: true; value: T }
  | { success: false; error: ParseError }

/**
 * Parse a JSON config string into a ConfigurationObject.
 * Returns line/column info on syntax errors.
 */
export function parseJsonConfig(input: string): ParseResult<ConfigurationObject> {
  // Handle empty or whitespace-only input
  if (!input || input.trim() === '') {
    return {
      success: false,
      error: { message: 'JSON parse error: Empty input', line: 1, column: 1 },
    }
  }

  try {
    const value = JSON.parse(input) as ConfigurationObject
    
    // Ensure the parsed value is an object
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {
        success: false,
        error: { message: 'JSON parse error: Configuration must be an object', line: 1, column: 1 },
      }
    }
    
    return { success: true, value }
  } catch (err) {
    const msg = (err as Error).message
    let line: number | undefined
    let column: number | undefined
    
    // Extract line/column from V8 JSON parse error messages
    const positionMatch = msg.match(/at position (\d+)/)
    if (positionMatch) {
      const pos = parseInt(positionMatch[1], 10)
      const before = input.slice(0, pos)
      const lines = before.split('\n')
      line = lines.length
      column = (lines[lines.length - 1]?.length ?? 0) + 1
    } else {
      // For errors without position info, try to provide reasonable defaults
      line = 1
      column = 1
    }
    
    return {
      success: false,
      error: { message: `JSON parse error: ${msg}`, line, column },
    }
  }
}

/**
 * Parse a YAML config string into a ConfigurationObject.
 * Returns line/column info on syntax errors.
 */
export function parseYamlConfig(input: string): ParseResult<ConfigurationObject> {
  // Handle empty or whitespace-only input
  if (!input || input.trim() === '') {
    return {
      success: false,
      error: { message: 'YAML parse error: Empty input', line: 1, column: 1 },
    }
  }

  try {
    const value = yaml.load(input) as ConfigurationObject
    if (typeof value !== 'object' || value === null) {
      return { success: false, error: { message: 'YAML must be a mapping object', line: 1, column: 1 } }
    }
    return { success: true, value }
  } catch (err) {
    const yamlErr = err as yaml.YAMLException
    return {
      success: false,
      error: {
        message: `YAML parse error: ${yamlErr.reason || yamlErr.message}`,
        line: yamlErr.mark?.line != null ? yamlErr.mark.line + 1 : undefined,
        column: yamlErr.mark?.column != null ? yamlErr.mark.column + 1 : undefined,
      },
    }
  }
}

/**
 * Pretty-print a ConfigurationObject back to JSON.
 */
export function printJsonConfig(config: ConfigurationObject): string {
  return JSON.stringify(config, null, 2)
}

/**
 * Pretty-print a ConfigurationObject back to YAML.
 */
export function printYamlConfig(config: ConfigurationObject): string {
  return yaml.dump(config, { indent: 2, lineWidth: -1 })
}

/**
 * Validate that required fields are present.
 * Returns list of missing field names.
 */
export function validateRequiredFields(config: ConfigurationObject): string[] {
  const required: string[] = ['databaseUrl', 'jwtSecret', 'port']
  return required.filter((field) => config[field] === undefined || config[field] === null || config[field] === '')
}

/**
 * Parse config from either JSON or YAML format.
 */
export function parseConfig(input: string, format: 'json' | 'yaml'): ParseResult<ConfigurationObject> {
  return format === 'json' ? parseJsonConfig(input) : parseYamlConfig(input)
}

/**
 * Print config to either JSON or YAML format.
 */
export function printConfig(config: ConfigurationObject, format: 'json' | 'yaml'): string {
  return format === 'json' ? printJsonConfig(config) : printYamlConfig(config)
}
