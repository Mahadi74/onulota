import * as fc from 'fast-check'
import {
  parseJsonConfig,
  parseYamlConfig,
  printJsonConfig,
  printYamlConfig,
  validateRequiredFields,
  parseConfig,
  printConfig,
  ConfigurationObject,
} from '../configParser'

describe('parseJsonConfig', () => {
  describe('valid JSON parsing', () => {
    it('parses valid JSON configuration', () => {
      const input = JSON.stringify({
        databaseUrl: 'mongodb://localhost:27017/test',
        jwtSecret: 'secret123',
        port: 3000,
      })
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.databaseUrl).toBe('mongodb://localhost:27017/test')
        expect(result.value.jwtSecret).toBe('secret123')
        expect(result.value.port).toBe(3000)
      }
    })

    it('parses JSON with additional optional fields', () => {
      const input = JSON.stringify({
        databaseUrl: 'mongodb://localhost:27017/test',
        jwtSecret: 'secret123',
        port: 3000,
        redisUrl: 'redis://localhost:6379',
        logLevel: 'info',
      })
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.redisUrl).toBe('redis://localhost:6379')
        expect(result.value.logLevel).toBe('info')
      }
    })
  })

  describe('invalid JSON handling', () => {
    it('handles empty input', () => {
      const result = parseJsonConfig('')
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('JSON parse error: Empty input')
        expect(result.error.line).toBe(1)
        expect(result.error.column).toBe(1)
      }
    })

    it('handles whitespace-only input', () => {
      const result = parseJsonConfig('   \n  \t  ')
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('JSON parse error: Empty input')
        expect(result.error.line).toBe(1)
        expect(result.error.column).toBe(1)
      }
    })

    it('handles malformed JSON with missing bracket', () => {
      const input = '{"databaseUrl": "test", "jwtSecret": "secret"'
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('JSON parse error:')
        expect(result.error.line).toBeDefined()
        expect(result.error.column).toBeDefined()
      }
    })

    it('handles JSON with trailing comma', () => {
      const input = '{"databaseUrl": "test", "jwtSecret": "secret",}'
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('JSON parse error:')
        expect(result.error.line).toBeDefined()
        expect(result.error.column).toBeDefined()
      }
    })

    it('handles JSON with invalid characters', () => {
      const input = '{"databaseUrl": "test", "jwtSecret": "secret", "invalid": \x00}'
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('JSON parse error:')
      }
    })

    it('rejects non-object JSON (array)', () => {
      const input = '["not", "an", "object"]'
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('JSON parse error: Configuration must be an object')
        expect(result.error.line).toBe(1)
        expect(result.error.column).toBe(1)
      }
    })

    it('rejects non-object JSON (string)', () => {
      const input = '"just a string"'
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('JSON parse error: Configuration must be an object')
      }
    })

    it('rejects non-object JSON (null)', () => {
      const input = 'null'
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('JSON parse error: Configuration must be an object')
      }
    })

    it('provides accurate line and column numbers for multi-line JSON', () => {
      const input = `{
  "databaseUrl": "test",
  "jwtSecret": "secret",
  "port": 3000,
  "invalid": 
}`
      
      const result = parseJsonConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.line).toBeDefined()
        expect(result.error.column).toBeDefined()
        expect(typeof result.error.line).toBe('number')
        expect(typeof result.error.column).toBe('number')
        expect(result.error.line!).toBeGreaterThan(0)
        expect(result.error.column!).toBeGreaterThan(0)
      }
    })
  })
})

describe('parseYamlConfig', () => {
  describe('valid YAML parsing', () => {
    it('parses valid YAML configuration', () => {
      const input = `
databaseUrl: mongodb://localhost:27017/test
jwtSecret: secret123
port: 3000
`
      
      const result = parseYamlConfig(input)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.databaseUrl).toBe('mongodb://localhost:27017/test')
        expect(result.value.jwtSecret).toBe('secret123')
        expect(result.value.port).toBe(3000)
      }
    })

    it('parses YAML with nested objects', () => {
      const input = `
databaseUrl: mongodb://localhost:27017/test
jwtSecret: secret123
port: 3000
database:
  host: localhost
  port: 27017
  name: test
`
      
      const result = parseYamlConfig(input)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.database).toEqual({
          host: 'localhost',
          port: 27017,
          name: 'test',
        })
      }
    })
  })

  describe('invalid YAML handling', () => {
    it('handles empty input', () => {
      const result = parseYamlConfig('')
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('YAML parse error: Empty input')
        expect(result.error.line).toBe(1)
        expect(result.error.column).toBe(1)
      }
    })

    it('handles whitespace-only input', () => {
      const result = parseYamlConfig('   \n  \t  ')
      
      const result2 = parseYamlConfig('')
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('YAML parse error: Empty input')
      }
    })

    it('handles malformed YAML with invalid indentation', () => {
      const input = `
databaseUrl: test
  jwtSecret: secret
port: 3000
`
      
      const result = parseYamlConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('YAML parse error:')
        expect(result.error.line).toBeDefined()
        expect(result.error.column).toBeDefined()
      }
    })

    it('handles YAML with invalid syntax', () => {
      const input = `
databaseUrl: test
jwtSecret: [invalid: yaml}
port: 3000
`
      
      const result = parseYamlConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('YAML parse error:')
        expect(result.error.line).toBeDefined()
        expect(result.error.column).toBeDefined()
      }
    })

    it('rejects non-object YAML (string)', () => {
      const input = 'just a string'
      
      const result = parseYamlConfig(input)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('YAML must be a mapping object')
      }
    })
  })
})

describe('printJsonConfig', () => {
  it('formats configuration object as pretty JSON', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'mongodb://localhost:27017/test',
      jwtSecret: 'secret123',
      port: 3000,
    }
    
    const result = printJsonConfig(config)
    
    expect(result).toContain('"databaseUrl": "mongodb://localhost:27017/test"')
    expect(result).toContain('"jwtSecret": "secret123"')
    expect(result).toContain('"port": 3000')
    expect(JSON.parse(result)).toEqual(config)
  })

  it('handles configuration with additional fields', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'mongodb://localhost:27017/test',
      jwtSecret: 'secret123',
      port: 3000,
      redisUrl: 'redis://localhost:6379',
      nested: { key: 'value' },
    }
    
    const result = printJsonConfig(config)
    const parsed = JSON.parse(result)
    
    expect(parsed).toEqual(config)
  })
})

describe('printYamlConfig', () => {
  it('formats configuration object as YAML', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'mongodb://localhost:27017/test',
      jwtSecret: 'secret123',
      port: 3000,
    }
    
    const result = printYamlConfig(config)
    
    expect(result).toContain('databaseUrl: mongodb://localhost:27017/test')
    expect(result).toContain('jwtSecret: secret123')
    expect(result).toContain('port: 3000')
  })
})

describe('validateRequiredFields', () => {
  it('returns empty array for valid configuration', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'mongodb://localhost:27017/test',
      jwtSecret: 'secret123',
      port: 3000,
    }
    
    const missing = validateRequiredFields(config)
    
    expect(missing).toEqual([])
  })

  it('returns missing field names', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'mongodb://localhost:27017/test',
      // Missing jwtSecret and port
    } as any
    
    const missing = validateRequiredFields(config)
    
    expect(missing).toContain('jwtSecret')
    expect(missing).toContain('port')
    expect(missing).toHaveLength(2)
  })

  it('detects empty string values as missing', () => {
    const config: ConfigurationObject = {
      databaseUrl: '',
      jwtSecret: 'secret123',
      port: 3000,
    }
    
    const missing = validateRequiredFields(config)
    
    expect(missing).toContain('databaseUrl')
    expect(missing).toHaveLength(1)
  })

  it('detects null values as missing', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'mongodb://localhost:27017/test',
      jwtSecret: null as any,
      port: 3000,
    }
    
    const missing = validateRequiredFields(config)
    
    expect(missing).toContain('jwtSecret')
    expect(missing).toHaveLength(1)
  })

  it('detects undefined values as missing', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'mongodb://localhost:27017/test',
      jwtSecret: 'secret123',
      port: undefined as any,
    }
    
    const missing = validateRequiredFields(config)
    
    expect(missing).toContain('port')
    expect(missing).toHaveLength(1)
  })
})

describe('parseConfig and printConfig', () => {
  it('delegates to JSON parser for json format', () => {
    const input = '{"databaseUrl": "test", "jwtSecret": "secret", "port": 3000}'
    
    const result = parseConfig(input, 'json')
    
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.databaseUrl).toBe('test')
    }
  })

  it('delegates to YAML parser for yaml format', () => {
    const input = 'databaseUrl: test\njwtSecret: secret\nport: 3000'
    
    const result = parseConfig(input, 'yaml')
    
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.value.databaseUrl).toBe('test')
    }
  })

  it('delegates to JSON printer for json format', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'test',
      jwtSecret: 'secret',
      port: 3000,
    }
    
    const result = printConfig(config, 'json')
    
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('delegates to YAML printer for yaml format', () => {
    const config: ConfigurationObject = {
      databaseUrl: 'test',
      jwtSecret: 'secret',
      port: 3000,
    }
    
    const result = printConfig(config, 'yaml')
    
    expect(result).toContain('databaseUrl: test')
  })
})

// Property-Based Tests
describe('Property-Based Tests', () => {
  // Generator for valid ConfigurationObject
  const configObjectArbitrary = fc.record({
    databaseUrl: fc.string({ minLength: 1 }),
    jwtSecret: fc.string({ minLength: 1 }),
    port: fc.integer({ min: 1, max: 65535 }),
  }).chain(required => 
    fc.option(fc.record({
      redisUrl: fc.string(),
      logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
      maxConnections: fc.integer({ min: 1, max: 1000 }),
    }), { nil: undefined }).map(optional => ({
      ...required,
      ...(optional || {})
    }))
  )

  // Generator for invalid JSON strings
  const invalidJsonArbitrary = fc.oneof(
    fc.constant(''),
    fc.constant('   '),
    fc.constant('{'),
    fc.constant('}'),
    fc.constant('{"key": }'),
    fc.constant('{"key": "value",}'),
    fc.constant('[1, 2, 3]'),
    fc.constant('"just a string"'),
    fc.constant('null'),
    fc.constant('undefined'),
    fc.string().filter(s => {
      try {
        JSON.parse(s)
        return false
      } catch {
        return true
      }
    })
  )

  // Generator for configurations missing required fields
  const partialConfigArbitrary = fc.oneof(
    // Missing databaseUrl
    fc.record({
      jwtSecret: fc.string({ minLength: 1 }),
      port: fc.integer({ min: 1, max: 65535 }),
    }),
    // Missing jwtSecret
    fc.record({
      databaseUrl: fc.string({ minLength: 1 }),
      port: fc.integer({ min: 1, max: 65535 }),
    }),
    // Missing port
    fc.record({
      databaseUrl: fc.string({ minLength: 1 }),
      jwtSecret: fc.string({ minLength: 1 }),
    }),
    // Missing multiple fields
    fc.record({
      databaseUrl: fc.string({ minLength: 1 }),
    }),
    fc.record({
      jwtSecret: fc.string({ minLength: 1 }),
    }),
    fc.record({
      port: fc.integer({ min: 1, max: 65535 }),
    }),
    fc.record({})
  )

  describe('Property 1: Configuration Round-Trip Preservation', () => {
    /**
     * **Validates: Requirements 31.4**
     * 
     * For any valid Configuration_Object, parsing then printing then parsing SHALL produce an equivalent object.
     */
    it('JSON round-trip preserves configuration objects', () => {
      fc.assert(
        fc.property(configObjectArbitrary, (config: ConfigurationObject) => {
          const printed = printJsonConfig(config)
          const parseResult = parseJsonConfig(printed)
          
          expect(parseResult.success).toBe(true)
          if (parseResult.success) {
            expect(parseResult.value).toEqual(config)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('YAML round-trip preserves configuration objects', () => {
      fc.assert(
        fc.property(configObjectArbitrary, (config: ConfigurationObject) => {
          const printed = printYamlConfig(config)
          const parseResult = parseYamlConfig(printed)
          
          expect(parseResult.success).toBe(true)
          if (parseResult.success) {
            expect(parseResult.value).toEqual(config)
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 2: Invalid Configuration Error Reporting', () => {
    /**
     * **Validates: Requirements 31.2**
     * 
     * For any syntactically invalid configuration file, the Parser SHALL return a descriptive error message 
     * that includes the line and column number of the syntax error.
     */
    it('JSON parser reports errors with line and column information', () => {
      fc.assert(
        fc.property(invalidJsonArbitrary, (invalidJson) => {
          const result = parseJsonConfig(invalidJson)
          
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.message).toBeDefined()
            expect(typeof result.error.message).toBe('string')
            expect(result.error.message.length).toBeGreaterThan(0)
            
            // Should always have line and column information (even if defaults)
            expect(result.error.line).toBeDefined()
            expect(result.error.column).toBeDefined()
            expect(typeof result.error.line).toBe('number')
            expect(typeof result.error.column).toBe('number')
            expect(result.error.line!).toBeGreaterThan(0)
            expect(result.error.column!).toBeGreaterThan(0)
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 3: Required Field Validation', () => {
    /**
     * **Validates: Requirements 31.6**
     * 
     * For any Configuration_Object missing one or more required fields (database URL, JWT secret, or port), 
     * the validation SHALL reject the configuration and report all missing required fields.
     */
    it('validation reports all missing required fields', () => {
      fc.assert(
        fc.property(partialConfigArbitrary, (partialConfig: any) => {
          const missing = validateRequiredFields(partialConfig as ConfigurationObject)
          
          // Should report missing fields
          expect(Array.isArray(missing)).toBe(true)
          expect(missing.length).toBeGreaterThan(0)
          
          // Check that all actually missing fields are reported
          const requiredFields = ['databaseUrl', 'jwtSecret', 'port']
          const actuallyMissing = requiredFields.filter(field => 
            (partialConfig as any)[field] === undefined || 
            (partialConfig as any)[field] === null || 
            (partialConfig as any)[field] === ''
          )
          
          expect(missing.sort()).toEqual(actuallyMissing.sort())
        }),
        { numRuns: 100 }
      )
    })

    it('validation passes for complete configurations', () => {
      fc.assert(
        fc.property(configObjectArbitrary, (config: ConfigurationObject) => {
          const missing = validateRequiredFields(config)
          
          expect(missing).toEqual([])
        }),
        { numRuns: 100 }
      )
    })
  })
})