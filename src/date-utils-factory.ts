import { File, Scalar, Service, Type, getTypeByName } from 'basketry';
import { NamespacedTypescriptValidatorsOptions } from './types';
import { format, from } from '@basketry/typescript/lib/utils';
import { camel, pascal } from 'case';
import { header } from '@basketry/typescript/lib/warning';
import {
  hasDateConverters,
  isDateProperty,
  needsDateConversion,
} from './utils';

export class ConverterFactory {
  constructor(
    private readonly service: Service,
    private readonly options?: NamespacedTypescriptValidatorsOptions,
  ) {}

  build(): File[] {
    if (!hasDateConverters(this.service, this.service.types)) return [];

    return [
      {
        path: [`v${this.service.majorVersion.value}`, 'date-utils.ts'],
        contents: format(from(this.buildFile()), this.options),
      },
    ];
  }

  private buildMethodName(type: Type): string {
    return camel(`convert_${type.name.value}_dates`);
  }

  private *buildFile(): Iterable<string> {
    yield header(this.service, require('../package.json'), this.options);
    yield '';
    yield `import * as types from "${
      this.options?.typescriptValidators?.typesImportPath ?? './types'
    }"`;
    yield '';

    yield 'export function tryConvertDate(datish: any): any { if (datish instanceof Date) { return datish; } try { return new Date(datish); } catch { return datish; } }';
    yield '';

    for (const type of sort(this.service.types)) {
      yield* this.buildType(type);
      yield '';
    }
  }

  private *buildType(type: Type): Iterable<string> {
    if (!needsDateConversion(this.service, type)) return;

    const dates = type.properties.filter(
      (prop) =>
        prop.isPrimitive &&
        (prop.typeName.value === 'date' || prop.typeName.value === 'date-time'),
    );

    yield `export function ${this.buildMethodName(
      type,
    )}(obj: any): types.${pascal(type.name.value)} {`;
    yield `if (typeof obj !== 'object' || obj === null) return obj;`;
    yield `return {`;
    yield `...obj,`;
    for (const property of type.properties) {
      if (isDateProperty(property)) {
        yield `${property.name.value}: tryConvertDate(obj.${property.name.value}),`;
      } else {
        const subtype = getTypeByName(this.service, property.typeName.value);
        if (!subtype) continue;

        if (needsDateConversion(this.service, subtype)) {
          yield `${property.name.value}: ${this.buildMethodName(subtype)}(obj.${
            property.name.value
          }),`;
        }
      }
    }
    yield `};`;
    yield `}`;
  }
}

function sort<T extends { name: Scalar<string> }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.name.value.localeCompare(b.name.value));
}
