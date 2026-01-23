// Wrapper to add toJSONSchema() method for Copilot SDK compatibility
// Zod v3 doesn't have toJSONSchema(), but the SDK requires it

import { z, ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Wraps a Zod schema to be compatible with the Copilot SDK's expected interface.
 * The SDK checks for a toJSONSchema() method on the parameters object.
 * Zod v3 doesn't have this method, so we add it using zod-to-json-schema.
 */
export function wrapZodSchema<T extends ZodTypeAny>(schema: T): T & { toJSONSchema: () => Record<string, unknown> } {
  const wrapped = schema as T & { toJSONSchema: () => Record<string, unknown> };
  
  wrapped.toJSONSchema = () => {
    const jsonSchema = zodToJsonSchema(schema, { 
      target: 'jsonSchema7',
      $refStrategy: 'none'
    });
    // Remove the $schema property as the SDK doesn't need it
    const { $schema, ...rest } = jsonSchema as Record<string, unknown>;
    return rest;
  };
  
  return wrapped;
}

/**
 * Helper to create a wrapped z.object() schema.
 * Usage: p({ name: z.string() }) instead of z.object({ name: z.string() })
 */
export function p<T extends z.ZodRawShape>(shape: T) {
  return wrapZodSchema(z.object(shape));
}
