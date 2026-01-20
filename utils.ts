
import { KeyValue, HttpRequest, LoggedRequest, ExpectedResponse } from './types';

export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const getMethodColor = (method?: string): string => {
  const m = method?.toUpperCase() || '';
  switch (m) {
    case 'GET': return 'text-green-600';
    case 'POST': return 'text-yellow-600';
    case 'PUT': return 'text-blue-600';
    case 'DELETE': return 'text-red-600';
    case 'PATCH': return 'text-purple-600';
    case 'OPTIONS': return 'text-indigo-600';
    case 'HEAD': return 'text-teal-600';
    default: return 'text-gray-600';
  }
};

export const getMethodBadgeColor = (method?: string): string => {
  const m = method?.toUpperCase() || '';
  switch (m) {
    case 'GET': return 'bg-green-100 text-green-700';
    case 'POST': return 'bg-yellow-100 text-yellow-700';
    case 'PUT': return 'bg-blue-100 text-blue-700';
    case 'DELETE': return 'bg-red-100 text-red-700';
    case 'PATCH': return 'bg-purple-100 text-purple-700';
    case 'OPTIONS': return 'bg-indigo-100 text-indigo-700';
    case 'HEAD': return 'bg-teal-100 text-teal-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const sanitizeForCurl = (str: string): string => {
  if (!str) return '';
  // Only remove null bytes which break shell commands, preserve other chars
  return str.replace(/\x00/g, '');
};

const escapeShellArg = (arg: string): string => {
  return `'${String(arg).replace(/'/g, "'\\''")}'`;
};

export const generateCurl = (log: LoggedRequest): string => {
  let curl = `curl -X ${log.method} ${escapeShellArg(sanitizeForCurl(log.url))}`;

  if (log.requestHeaders) {
    Object.entries(log.requestHeaders).forEach(([key, value]) => {
      curl += ` \\\n  -H ${escapeShellArg(`${key}: ${value}`)}`;
    });
  }

  if (log.requestBody) {
    let body = log.requestBody;
    if (typeof body === 'object') {
      Object.entries(body).forEach(([key, value]) => {
        const val = Array.isArray(value) ? value[0] : value;
        curl += ` \\\n  --form ${escapeShellArg(`${key}=${val}`)}`;
      });
    } else {
      curl += ` \\\n  --data-raw ${escapeShellArg(sanitizeForCurl(String(body)))}`;
    }
  }

  return curl;
};

export const generateCurlFromRequest = (req: HttpRequest): string => {
  let curl = `curl -X ${req.method} ${escapeShellArg(sanitizeForCurl(req.url))}`;

  req.headers.filter(h => h.enabled && h.key).forEach(h => {
    curl += ` \\\n  -H ${escapeShellArg(`${h.key}: ${h.value}`)}`;
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.bodyType === 'raw' && req.bodyRaw) {
      curl += ` \\\n  --data-raw ${escapeShellArg(sanitizeForCurl(req.bodyRaw))}`;
    } else if (req.bodyType === 'x-www-form-urlencoded') {
      req.bodyForm.filter(f => f.enabled && f.key).forEach(f => {
        curl += ` \\\n  --data ${escapeShellArg(`${f.key}=${f.value}`)}`;
      });
    } else if (req.bodyType === 'form-data') {
      req.bodyForm.filter(f => f.enabled && f.key).forEach(f => {
        const prefix = f.type === 'file' ? '@' : '';
        curl += ` \\\n  --form ${escapeShellArg(`${f.key}=${prefix}${f.value}`)}`;
      });
    }
  }

  return curl;
};

export const parseCurl = (curlCommand: string): Partial<HttpRequest> | null => {
  if (!curlCommand || !curlCommand.trim().toLowerCase().startsWith('curl')) return null;

  const cleanCommand = curlCommand
    .replace(/\\\r?\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  const request: Partial<HttpRequest> = {
    headers: [],
    params: [],
    method: 'GET',
    bodyType: 'raw',
    bodyRaw: ''
  };

  const methodMatch = cleanCommand.match(/(?:-X|--request)\s+([A-Z]+)/i);
  if (methodMatch) {
    request.method = methodMatch[1].toUpperCase() as any;
  }

  const urlRegex = /(?:https?:\/\/[^\s'"]+)/i;
  const urlMatch = cleanCommand.match(urlRegex);
  if (urlMatch) {
    let urlStr = urlMatch[0];
    if ((urlStr.startsWith("'") && urlStr.endsWith("'")) || (urlStr.startsWith('"') && urlStr.endsWith('"'))) {
      urlStr = urlStr.slice(1, -1);
    }
    request.url = urlStr;

    try {
      const urlObj = new URL(urlStr);
      const params: KeyValue[] = [];
      urlObj.searchParams.forEach((value, key) => {
        params.push({ id: generateId(), key, value, enabled: true });
      });
      if (params.length > 0) request.params = params;
    } catch (e) { }
  }

  const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/g;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(cleanCommand)) !== null) {
    const headerContent = headerMatch[2];
    const separatorIndex = headerContent.indexOf(':');
    if (separatorIndex > 0) {
      const key = headerContent.substring(0, separatorIndex).trim();
      const value = headerContent.substring(separatorIndex + 1).trim();
      request.headers?.push({ id: generateId(), key, value, enabled: true });
    }
  }

  const dataRegex = /(?:--data-raw|--data-binary|--data-urlencode|--data|-d|--form|-F)\s+(['"])([\s\S]*?)\1/;
  const dataMatch = cleanCommand.match(dataRegex);

  if (dataMatch) {
    const matchedArg = dataMatch[0];
    if (matchedArg.includes('--form') || matchedArg.includes('-F')) {
      request.bodyType = 'form-data';
      const pair = dataMatch[2].split('=');
      if (pair.length >= 2) {
        request.bodyForm = [{ id: generateId(), key: pair[0], value: pair.slice(1).join('='), enabled: true, type: 'text' }];
      }
    } else {
      request.bodyRaw = dataMatch[2];
      request.bodyType = 'raw';
    }
    if (!methodMatch) request.method = 'POST';
  }

  return request;
};

export const paramsToQueryString = (params: KeyValue[]): string => {
  return params
    .filter(p => p.enabled && p.key)
    .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
};

export const queryStringToParams = (query: string): KeyValue[] => {
  if (!query) return [];
  return query.split('&').map(pair => {
    const [key, value] = pair.split('=');
    return {
      id: generateId(),
      key: decodeURIComponent(key || ''),
      value: decodeURIComponent(value || ''),
      enabled: true
    };
  });
};

export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const formatUrl = (urlString: string) => {
  try {
    const url = new URL(urlString);
    return {
      origin: url.origin,
      path: url.pathname + url.search
    };
  } catch (e) {
    return { origin: urlString, path: '' };
  }
};

export const formatTime = (timestamp: number): string => {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

// --- Swagger/OpenAPI Parser Types ---
export interface SwaggerParseResult {
  apiTitle: string;
  tagGroups: TagGroup[];
}

export interface TagGroup {
  name: string;
  description?: string;
  requests: HttpRequest[];
}

// --- Swagger Helper Functions ---

/**
 * Generate example value for a parameter based on its schema
 */
const generateExampleValue = (param: any): string => {
  // Check explicit example/default values
  if (param.example !== undefined) return String(param.example);
  if (param.default !== undefined) return String(param.default);
  if (param.schema?.example !== undefined) return String(param.schema.example);
  if (param.schema?.default !== undefined) return String(param.schema.default);

  // Generate based on type
  const type = param.type || param.schema?.type;
  const format = param.format || param.schema?.format;

  switch (type) {
    case 'integer':
      return format === 'int64' ? '0' : '0';
    case 'number':
      return '0.0';
    case 'boolean':
      return 'true';
    case 'array':
      return '';
    case 'string':
      if (format === 'date') return new Date().toISOString().split('T')[0];
      if (format === 'date-time') return new Date().toISOString();
      if (format === 'email') return 'user@example.com';
      if (format === 'uuid') return '00000000-0000-0000-0000-000000000000';
      if (param.enum && param.enum.length > 0) return param.enum[0];
      return '';
    default:
      return '';
  }
};

/**
 * Recursively generate example JSON from OpenAPI schema
 */
const generateExampleFromSchema = (schema: any, definitions?: any, visited: Set<string> = new Set()): any => {
  if (!schema) return null;

  // Handle $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/definitions/', '').replace('#/components/schemas/', '');
    if (visited.has(refPath)) return {}; // Prevent circular reference
    visited.add(refPath);
    const refSchema = definitions?.[refPath];
    if (refSchema) {
      return generateExampleFromSchema(refSchema, definitions, visited);
    }
    return {};
  }

  // Check for explicit example
  if (schema.example !== undefined) return schema.example;

  // Handle by type
  switch (schema.type) {
    case 'object': {
      const obj: Record<string, any> = {};
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
          obj[key] = generateExampleFromSchema(propSchema, definitions, new Set(visited));
        });
      }
      return obj;
    }
    case 'array': {
      const itemExample = generateExampleFromSchema(schema.items, definitions, new Set(visited));
      return itemExample !== null ? [itemExample] : [];
    }
    case 'string':
      if (schema.enum && schema.enum.length > 0) return schema.enum[0];
      if (schema.format === 'date') return new Date().toISOString().split('T')[0];
      if (schema.format === 'date-time') return new Date().toISOString();
      return 'string';
    case 'integer':
      return 0;
    case 'number':
      return 0.0;
    case 'boolean':
      return true;
    default:
      // Try allOf, oneOf, anyOf
      if (schema.allOf && Array.isArray(schema.allOf)) {
        let merged = {};
        schema.allOf.forEach((s: any) => {
          const part = generateExampleFromSchema(s, definitions, new Set(visited));
          if (typeof part === 'object' && part !== null) {
            merged = { ...merged, ...part };
          }
        });
        return merged;
      }
      if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
        return generateExampleFromSchema(schema.oneOf[0], definitions, visited);
      }
      if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
        return generateExampleFromSchema(schema.anyOf[0], definitions, visited);
      }
      return null;
  }
};

/**
 * Parse response schema from OpenAPI responses object
 */
const parseResponseSchema = (responses: any, definitions?: any): ExpectedResponse | undefined => {
  if (!responses) return undefined;

  // Try common success status codes
  const successResponse = responses['200'] || responses['201'] || responses['default'];
  if (!successResponse) return undefined;

  // OpenAPI 3.x: content.application/json.schema
  // Swagger 2.x: schema directly
  const schema = successResponse.content?.['application/json']?.schema || successResponse.schema;

  let example: string | undefined;
  if (schema) {
    const exampleObj = generateExampleFromSchema(schema, definitions);
    if (exampleObj !== null) {
      try {
        example = JSON.stringify(exampleObj, null, 2);
      } catch (e) {
        example = undefined;
      }
    }
  }

  // Get status code
  let status = 200;
  if (responses['201']) status = 201;

  return {
    status,
    description: successResponse.description,
    schema,
    example
  };
};

/**
 * Parse Swagger/OpenAPI JSON and return structured result with tag groups
 */
export const parseSwagger = (jsonContent: string): SwaggerParseResult | null => {
  try {
    const spec = JSON.parse(jsonContent);

    if (!spec.paths) return null;

    const apiTitle = spec.info?.title || 'Imported API';

    // Get definitions for $ref resolution (Swagger 2.x vs OpenAPI 3.x)
    const definitions = spec.definitions || spec.components?.schemas || {};

    // Build tag descriptions map
    const tagDescriptions: Record<string, string> = {};
    if (spec.tags && Array.isArray(spec.tags)) {
      spec.tags.forEach((tag: any) => {
        if (tag.name) {
          tagDescriptions[tag.name] = tag.description || '';
        }
      });
    }

    // Group requests by tag
    const tagMap: Map<string, HttpRequest[]> = new Map();
    // Force relative paths to allow Environment configuration overrides
    const rawBaseUrl = spec.basePath || '';
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');

    Object.entries(spec.paths).forEach(([pathName, methods]: [string, any]) => {
      Object.entries(methods).forEach(([methodName, details]: [string, any]) => {
        if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodName.toLowerCase())) {
          return;
        }

        const reqId = generateId();
        const cleanPath = pathName.replace(/^\/+/, '');
        let url = `${baseUrl}/${cleanPath}`;

        const headers: KeyValue[] = [];
        const params: KeyValue[] = [];
        let bodyType: HttpRequest['bodyType'] = 'none';
        let bodyRaw = '';
        let bodyForm: KeyValue[] = [];

        // Get path parameters for URL substitution hints
        const pathParams: Record<string, string> = {};

        // Process parameters (both path-level and operation-level)
        const allParams = [...(methods.parameters || []), ...(details.parameters || [])];

        allParams.forEach((param: any) => {
          const exampleValue = generateExampleValue(param);
          const description = param.description || '';

          if (param.in === 'query') {
            params.push({
              id: generateId(),
              key: param.name,
              value: exampleValue,
              enabled: true,
              description
            });
          } else if (param.in === 'header') {
            headers.push({
              id: generateId(),
              key: param.name,
              value: exampleValue,
              enabled: true,
              description
            });
          } else if (param.in === 'path') {
            pathParams[param.name] = exampleValue || `{${param.name}}`;
          }
        });

        // Substitute path parameters in URL
        Object.entries(pathParams).forEach(([name, value]) => {
          url = url.replace(`{${name}}`, value || `{${name}}`);
        });

        // Body (OpenAPI v3)
        if (details.requestBody && details.requestBody.content) {
          const content = details.requestBody.content;
          if (content['application/json']) {
            bodyType = 'raw';
            headers.push({ id: generateId(), key: 'Content-Type', value: 'application/json', enabled: true });
            // Generate body example from schema
            const bodySchema = content['application/json'].schema;
            if (bodySchema) {
              const bodyExample = generateExampleFromSchema(bodySchema, definitions);
              if (bodyExample !== null) {
                try {
                  bodyRaw = JSON.stringify(bodyExample, null, 2);
                } catch (e) {
                  bodyRaw = '{}';
                }
              } else {
                bodyRaw = '{}';
              }
            } else {
              bodyRaw = '{}';
            }
          } else if (content['application/x-www-form-urlencoded']) {
            bodyType = 'x-www-form-urlencoded';
            headers.push({ id: generateId(), key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true });
            // Parse form fields from schema
            const formSchema = content['application/x-www-form-urlencoded'].schema;
            if (formSchema?.properties) {
              Object.entries(formSchema.properties).forEach(([key, propSchema]: [string, any]) => {
                bodyForm.push({
                  id: generateId(),
                  key,
                  value: generateExampleValue({ ...propSchema, name: key }),
                  enabled: true,
                  type: 'text',
                  description: propSchema.description
                });
              });
            }
          } else if (content['multipart/form-data']) {
            bodyType = 'form-data';
            const formSchema = content['multipart/form-data'].schema;
            if (formSchema?.properties) {
              Object.entries(formSchema.properties).forEach(([key, propSchema]: [string, any]) => {
                bodyForm.push({
                  id: generateId(),
                  key,
                  value: generateExampleValue({ ...propSchema, name: key }),
                  enabled: true,
                  type: propSchema.format === 'binary' ? 'file' : 'text',
                  description: propSchema.description
                });
              });
            }
          }
        }

        // Body (Swagger v2)
        if (details.parameters) {
          const bodyParam = details.parameters.find((p: any) => p.in === 'body');
          if (bodyParam && bodyParam.schema) {
            bodyType = 'raw';
            const bodyExample = generateExampleFromSchema(bodyParam.schema, definitions);
            if (bodyExample !== null) {
              try {
                bodyRaw = JSON.stringify(bodyExample, null, 2);
              } catch (e) {
                bodyRaw = '{}';
              }
            } else {
              bodyRaw = '{}';
            }
            headers.push({ id: generateId(), key: 'Content-Type', value: 'application/json', enabled: true });
          }

          const formDataParams = details.parameters.filter((p: any) => p.in === 'formData');
          if (formDataParams.length > 0) {
            const consumes = details.consumes || spec.consumes || [];
            if (consumes.includes('multipart/form-data')) {
              bodyType = 'form-data';
            } else {
              bodyType = 'x-www-form-urlencoded';
              headers.push({ id: generateId(), key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true });
            }
            formDataParams.forEach((p: any) => {
              bodyForm.push({
                id: generateId(),
                key: p.name,
                value: generateExampleValue(p),
                enabled: true,
                type: p.type === 'file' ? 'file' : 'text',
                description: p.description
              });
            });
          }
        }

        // Parse response schema
        const expectedResponse = parseResponseSchema(details.responses, definitions);

        const request: HttpRequest = {
          id: reqId,
          name: details.summary || details.operationId || `${methodName.toUpperCase()} ${pathName}`,
          description: details.description,
          url: url,
          method: methodName.toUpperCase() as any,
          headers,
          params,
          bodyType,
          bodyRaw,
          bodyForm,
          bodyRawType: 'json',
          expectedResponse
        };

        // Group by first tag, or 'default' if no tags
        const tagName = (details.tags && details.tags.length > 0) ? details.tags[0] : 'default';
        if (!tagMap.has(tagName)) {
          tagMap.set(tagName, []);
        }
        tagMap.get(tagName)!.push(request);
      });
    });

    // Convert map to TagGroup array
    const tagGroups: TagGroup[] = [];
    tagMap.forEach((requests, name) => {
      tagGroups.push({
        name,
        description: tagDescriptions[name],
        requests
      });
    });

    // Sort tag groups alphabetically, but keep 'default' at the end
    tagGroups.sort((a, b) => {
      if (a.name === 'default') return 1;
      if (b.name === 'default') return -1;
      return a.name.localeCompare(b.name);
    });

    return {
      apiTitle,
      tagGroups
    };
  } catch (e) {
    console.error("Failed to parse Swagger", e);
    return null;
  }
};

