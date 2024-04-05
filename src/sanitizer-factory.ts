import {
  File,
  Interface,
  Method,
  Scalar,
  Service,
  Type,
  Union,
  getTypeByName,
  getUnionByName,
  isRequired,
} from 'basketry';
import { format, from } from '@basketry/typescript/lib/utils';
import { NamespacedTypescriptValidatorsOptions } from './types';
import { camel, pascal } from 'case';
import {
  buildFilePath,
  buildMethodParamsTypeName,
  buildParameterName,
  buildPropertyName,
  buildTypeName,
} from '@basketry/typescript';
import { header } from '@basketry/typescript/lib/warning';

const typeModule = 'types';
const validatorModule = 'validators';

export class SanitizerFactory {
  public readonly target = 'typescript';

  constructor(
    private readonly service: Service,
    private readonly options?: NamespacedTypescriptValidatorsOptions,
  ) {}

  build(): File[] {
    return [
      {
        path: buildFilePath(['sanitizers.ts'], this.service, this.options),
        contents: format(from(this.buildFile()), this.options),
      },
    ];
  }

  private buildMethodName(member: Type | Union): string {
    return camel(`sanitize_${member.name.value}`);
  }

  private *buildFile(): Iterable<string> {
    yield header(this.service, require('../package.json'), this.options);
    yield '';
    yield `import * as ${typeModule} from "${
      this.options?.typescriptValidators?.typesImportPath ?? './types'
    }"`;
    if (this.service.unions.length) {
      yield `import * as ${validatorModule} from "./validators"`;
    }
    yield '';

    yield 'function compact<T extends object>(obj: T): T {';
    yield '// Strip undefined values.';
    yield `return Object.keys(obj).reduce((acc, key)=>typeof obj[key] === "undefined" ? acc : {...acc, [key]: obj[key]}, {}) as T;`;
    yield '}';
    yield '';

    for (const type of sort(this.service.types)) {
      yield '/**';
      yield ' * Returns a new object that only contains properties defined';
      yield ` * in the {@link ${buildTypeName(
        type,
        typeModule,
      )}|${buildTypeName(type)}} type definition.`;
      yield ' * Properties with `undefined` values are not included.';
      yield ' */';
      yield `export function ${camel(
        `sanitize_${type.name.value}`,
      )}(obj: ${buildTypeName(type, typeModule)}): ${buildTypeName(
        type,
        typeModule,
      )} {`;

      yield `const sanitized: ${buildTypeName(type, typeModule)} = {`;
      for (const prop of sort(type.properties)) {
        const name = `${buildPropertyName(prop)}`;
        const accessor = `obj.${name}`;
        const t = prop.isPrimitive
          ? undefined
          : getTypeByName(this.service, prop.typeName.value) ??
            getUnionByName(this.service, prop.typeName.value);

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

      yield 'return compact(sanitized)';

      yield '}';
      yield '';
    }

    for (const union of sort(this.service.unions)) {
      yield `export function ${camel(
        `sanitize_${union.name.value}`,
      )}(obj: ${buildTypeName(union, typeModule)}): ${buildTypeName(
        union,
        typeModule,
      )} {`;

      // Sort by number of properties in descending order.
      // This is to ensure that the most specific type is checked first.
      // Note that this is not a perfect solution becuase we don't sort
      // on the complexity of child types, but it's better than nothing,
      const members = union.members.sort((a, b) => {
        // TODO: Handle non-type members
        const aa = getTypeByName(this.service, a.typeName.value);
        const bb = getTypeByName(this.service, b.typeName.value);

        if (!aa || !bb) return 0;

        return bb.properties.length - aa.properties.length;
      });

      for (let i = 0; i < members.length - 1; i++) {
        // TODO: Handle primitive members
        const member = members[i];
        if (i > 0) yield 'else ';
        yield `if (validators.is${pascal(
          members[i].typeName.value,
        )}(obj)) { return ${camel(
          `sanitize_${member.typeName.value}`,
        )}(obj); }`;
      }

      const lastMember = members[members.length - 1];
      if (members.length > 1) yield 'else {';
      yield `return ${camel(`sanitize_${lastMember.typeName.value}`)}(obj);`;

      if (members.length > 1) yield '}';

      yield '}';
      yield '';
    }

    for (const [int, method] of this.service.interfaces
      .flatMap((i) => i.methods.map<[Interface, Method]>((m) => [i, m]))
      .sort(([, a], [, b]) => a.name.value.localeCompare(b.name.value))) {
      if (!method.parameters.length) continue;

      const hasRequiredParams = method.parameters.some(isRequired);
      const paramType = buildMethodParamsTypeName(method, typeModule);

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
      yield 'return compact(sanitized)';
      yield '}';
      yield '';
    }
  }
}

function sort<T extends { name: Scalar<string> }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.name.value.localeCompare(b.name.value));
}
