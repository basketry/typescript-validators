import {
  File,
  Interface,
  Method,
  Scalar,
  Service,
  Type,
  getTypeByName,
  isRequired,
} from 'basketry';
import { format, from } from '@basketry/typescript/lib/utils';
import { NamespacedTypescriptValidatorsOptions } from './types';
import { camel, pascal } from 'case';
import {
  buildInterfaceName,
  buildMethodName,
  buildParameterName,
  buildPropertyName,
  buildTypeName,
} from '@basketry/typescript';
import { header } from '@basketry/typescript/lib/warning';

export class SanitizerFactory {
  public readonly target = 'typescript';

  constructor(
    private readonly service: Service,
    private readonly options?: NamespacedTypescriptValidatorsOptions,
  ) {}

  build(): File[] {
    return [
      {
        path: [`v${this.service.majorVersion.value}`, 'sanitizers.ts'],
        contents: format(from(this.buildFile()), this.options),
      },
    ];
  }

  private buildMethodName(type: Type): string {
    return camel(`sanitize_${type.name.value}`);
  }

  private *buildFile(): Iterable<string> {
    yield header(this.service, require('../package.json'), this.options);
    yield '';
    yield `import * as types from "${
      this.options?.typescriptValidators?.typesImportPath ?? './types'
    }"`;
    yield '';

    yield 'function stripUndefinedValues<T extends object>(obj: T): T {';
    yield '// Strip undefined values.';
    yield `return Object.keys(obj).reduce((acc, key)=>typeof obj[key] === "undefined" ? acc : {...acc, [key]: obj[key]}, {}) as T;`;
    yield '}';
    yield '';

    for (const type of sort(this.service.types)) {
      yield '/**';
      yield ' * Returns a new object that only contains properties defined';
      yield ` * in the {@link ${buildTypeName(type, 'types')}|${buildTypeName(
        type,
      )}} type definition.`;
      yield ' * Properties with `undefined` values are not included.';
      yield ' */';
      yield `export function ${camel(
        `sanitize_${type.name.value}`,
      )}(obj: ${buildTypeName(type, 'types')}): ${buildTypeName(
        type,
        'types',
      )} {`;

      yield '// Create new object based on type definition.';
      yield `const sanitized: ${buildTypeName(type, 'types')} = {`;
      for (const prop of sort(type.properties)) {
        const name = `${buildPropertyName(prop)}`;
        const accessor = `obj.${name}`;
        const t = prop.isPrimitive
          ? undefined
          : getTypeByName(this.service, prop.typeName.value);

        if (t) {
          const method = this.buildMethodName(t);
          if (prop.isArray) {
            if (isRequired(prop)) {
              yield `${name}: ${accessor}.map(${method}),`;
            } else {
              yield `${name}: typeof ${accessor} === 'undefined' ? undefined : ${accessor}.map(${method}),`;
            }
          } else {
            if (isRequired(prop)) {
              yield `${name}: ${method}(${accessor}),`;
            } else {
              yield `${name}: typeof ${accessor} === 'undefined' ? undefined : ${method}(${accessor}),`;
            }
          }
        } else {
          yield `${name}: ${accessor},`;
        }
      }
      yield `}`;
      yield '';

      yield 'return stripUndefinedValues(sanitized)';

      yield '}';
      yield '';
    }

    for (const [int, method] of this.service.interfaces
      .flatMap((i) => i.methods.map<[Interface, Method]>((m) => [i, m]))
      .sort(([, a], [, b]) => a.name.value.localeCompare(b.name.value))) {
      if (!method.parameters.length) continue;

      const intName = buildInterfaceName(int, 'types');
      const methodName = buildMethodName(method);
      const hasRequiredParams = method.parameters.some(isRequired);
      const paramType = `Parameters<${intName}['${methodName}']>[0]`;

      yield `export function ${camel(
        `sanitize_${method.name.value}_params`,
      )}(params${hasRequiredParams ? '' : '?'}: ${paramType}): ${paramType} {`;

      yield '// Create new object based on method parameters.';
      yield `const sanitized: ${paramType} = {`;

      for (const param of sort(method.parameters)) {
        const name = `${buildParameterName(param)}`;
        const accessor = `params${hasRequiredParams ? '' : '?'}.${name}`;
        const t = param.isPrimitive
          ? undefined
          : getTypeByName(this.service, param.typeName.value);

        if (t) {
          const sanitizer = this.buildMethodName(t);
          if (param.isArray) {
            if (isRequired(param)) {
              yield `${name}: ${accessor}.map(${sanitizer}),`;
            } else {
              yield `${name}: typeof ${accessor} === 'undefined' ? undefined : ${accessor}.map(${sanitizer}),`;
            }
          } else {
            if (isRequired(param)) {
              yield `${name}: ${sanitizer}(${accessor}),`;
            } else {
              yield `${name}: typeof ${accessor} === 'undefined' ? undefined : ${sanitizer}(${accessor}),`;
            }
          }
        } else {
          yield `${name}: ${accessor},`;
        }
      }

      yield '}';
      yield '';
      yield 'return stripUndefinedValues(sanitized)';
      yield '}';
      yield '';
    }
  }
}

function sort<T extends { name: Scalar<string> }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.name.value.localeCompare(b.name.value));
}
