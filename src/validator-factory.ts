import { camel, constant, pascal } from 'case';
import {
  Enum,
  File,
  getTypeByName,
  hasOnlyOptionalParameters,
  hasParameters,
  isRequired,
  Method,
  Parameter,
  Property,
  Scalar,
  Service,
  Type,
  Union,
  ValidationRule,
} from 'basketry';
import { header as warning } from '@basketry/typescript/lib/warning';
import {
  buildEnumValidatorName,
  buildParamsValidatorName,
  buildTypeGuardName,
  buildTypeValidatorName,
} from './name-factory';
import {
  buildMethodName,
  buildMethodParams,
  buildTypeName,
  buildInterfaceName,
  buildFilePath,
  buildMethodParamsTypeName,
} from '@basketry/typescript';
import { eslintDisable, format, from } from '@basketry/typescript/lib/utils';
import { NamespacedTypescriptValidatorsOptions } from './types';
import {
  MemberValidatorFactory,
  ValidatorMethodFactory,
} from './member-validator-factory';

export type GuardClauseFactory = (
  param: Parameter | Property,
  rule: ValidationRule,
) => string | undefined;

export class ValidatorFactory {
  constructor(
    private readonly service: Service,
    private readonly options?: NamespacedTypescriptValidatorsOptions,
  ) {}

  private readonly state = new ValidatorMethodFactory();

  build(): File[] {
    const imports = Array.from(this.buildImports()).join('\n');

    const methodParams = this.service.interfaces
      .map((int) => int.methods)
      .reduce((a, b) => a.concat(b), [])
      .sort((a, b) => a.name.value.localeCompare(b.name.value))
      .map((m) =>
        Array.from(this.buildMethodParamsValidator(m))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const types = this.service.types
      .sort((a, b) => a.name.value.localeCompare(b.name.value))
      .map((t) =>
        Array.from(this.buildTypeValidator(t))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const enums = this.service.enums
      .sort((a, b) => a.name.value.localeCompare(b.name.value))
      .map((e) =>
        Array.from(this.buildEnumValidator(e))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const unions = this.service.unions
      .sort((a, b) => a.name.value.localeCompare(b.name.value))
      .map((u) =>
        Array.from(this.buildUnionValidator(u))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const header = warning(
      this.service,
      require('../package.json'),
      this.options,
    );

    const disable = from(eslintDisable(this.options || {}));

    const standardTypes = Array.from(this.buildStandardTypes()).join('\n');

    const contents = [
      header,
      disable,
      imports,
      standardTypes,
      methodParams,
      types,
      enums,
      unions,
      Array.from(this.buildValidatedServiceWrappers()).join('\n'),
    ].join('\n\n');

    return [
      {
        path: buildFilePath(['validators.ts'], this.service, this.options),
        contents: format(contents, this.options),
      },
    ];
  }

  private *buildImports(): Iterable<string> {
    yield `import${
      this.options?.typescript?.typeImports ? ' type ' : ' '
    }* as types from "${
      this.options?.typescriptValidators?.typesImportPath ?? './types'
    }"`;

    yield `import ${
      this.options?.typescript?.typeImports ? ' type ' : ' '
    } * as sanitizers from "./sanitizers"`;
  }

  private readonly codes = new Set<string>();
  private *buildStandardTypes(): Iterable<string> {
    const codes = Array.from(this.codes)
      .sort((a, b) => a.localeCompare(b))
      .map((code) => `'${code}'`)
      .join(' | ');
    // yield `export type ValidationError = { code: ${codes}, title: string, path: string };`;
    // yield ' ';
    yield* this.state.buildInternalHelperMethods();
  }

  private *buildMethodParamsValidator(
    method: Method,
  ): Iterable<string | undefined> {
    yield* this.buildValidatorDescription(method);

    yield `export function ${buildParamsValidatorName(method)}(`;
    yield* buildMethodParams(method, 'types');
    yield `${hasParameters(method) ? ',' : ''}parentPath?: string`;
    yield `): ValidationError[] {`;

    if (hasOnlyOptionalParameters(method)) {
      yield 'if(!params) return [];';
    }

    const validatorFactory = new MemberValidatorFactory(
      this.state,
      'parentPath',
    );

    yield* validatorFactory.build(method.parameters);

    // if (hasParameters(method)) {
    //   yield 'const errors: ValidationError[] = [];';
    // }

    // let needsOnError = false;
    // const callsitesByProperty = new Map<string, string[]>();
    // for (const param of method.parameters) {
    //   const propertyClauses: string[] = [];
    //   // yield this.buildRequiredClause(param);
    //   // yield this.buildPrimitiveTypeClause(param);
    //   const customTypeClause = this.buildCustomTypeClause(param);
    //   if (customTypeClause) propertyClauses.push(customTypeClause);

    //   for (const line of this.buildPrimitiveRules(param)) {
    //     needsOnError = true;
    //     propertyClauses.push(line);
    //   }

    //   if (propertyClauses.length) {
    //     callsitesByProperty.set(param.name.value, propertyClauses);
    //   }

    //   for (const rule of param.rules) {
    //     for (const factory of this.factories) {
    //       yield factory(param, rule);
    //     }
    //   }
    // }

    // if (needsOnError) {
    //   yield 'const onError = (error: ValidationError) => { errors.push(error); };';
    // }
    // for (const [property, callsites] of callsitesByProperty) {
    //   yield ' ';
    //   yield `// ${property}`;
    //   yield* callsites;
    // }

    // if (hasParameters(method)) {
    //   yield 'return errors;';
    // } else {
    //   yield 'return [];';
    // }
    yield `}`;
  }

  private *buildTypeValidator(type: Type): Iterable<string | undefined> {
    yield `export function ${buildTypeValidatorName(
      type,
    )}(params: ${buildTypeName(
      type,
      'types',
    )}, parentPath?: string): ValidationError[] {`;

    // if (type.properties.length || type.rules.length) {
    //   yield 'const errors: ValidationError[] = [];';
    // }

    // TODO: build object rules
    // for (const rule of type.rules) {
    //   for (const factory of this.factories) {
    //     yield factory(type, rule);
    //   }
    // }

    const validatorFactory = new MemberValidatorFactory(
      this.state,
      'parentPath',
    );

    yield* validatorFactory.build(type.properties);

    // let needsOnError = false;
    // const callsitesByProperty = new Map<string, string[]>();
    // for (const property of type.properties) {
    //   const propertyClauses: string[] = [];
    //   // yield this.buildRequiredClause(property);
    //   // yield this.buildPrimitiveTypeClause(property);
    //   const customTypeClause = this.buildCustomTypeClause(property);
    //   if (customTypeClause) propertyClauses.push(customTypeClause);

    //   for (const line of this.buildPrimitiveRules(property)) {
    //     needsOnError = true;
    //     propertyClauses.push(line);
    //   }

    //   if (propertyClauses.length) {
    //     callsitesByProperty.set(property.name.value, propertyClauses);
    //   }

    //   for (const rule of property.rules) {
    //     for (const factory of this.factories) {
    //       yield factory(property, rule);
    //     }
    //   }
    // }

    // if (needsOnError) {
    //   yield 'const onError = (error: ValidationError) => { errors.push(error); };';
    // }
    // for (const [property, callsites] of callsitesByProperty) {
    //   yield ' ';
    //   yield `// ${property}`;
    //   yield* callsites;
    // }

    // if (type.properties.length || type.rules.length) {
    //   yield 'return errors;';
    // } else {
    //   yield 'return [];';
    // }

    yield `}`;

    yield* this.buildTypeGuard(type);
  }

  private *buildTypeGuard(type: Type): Iterable<string> {
    yield `export function ${buildTypeGuardName(
      type,
    )}(obj: any): obj is ${buildTypeName(
      type,
      'types',
    )} { return typeof obj !== 'undefined' && !${buildTypeValidatorName(
      type,
    )}(obj).length }`;
  }

  private *buildEnumValidator(e: Enum): Iterable<string | undefined> {
    this.state.touchStringEnumValidator();
    yield `export function ${buildEnumValidatorName(e)}(value: ${buildTypeName(
      e,
      'types',
    )}): ValidationError[] {`;

    yield 'const errors: ValidationError[] = [];';

    const values = `[${e.values
      .map((v) => `"${v.content.value}"`)
      .join(', ')}]`;

    const conditions = [
      `typeof value === 'string'`,
      `!${values}.includes(value)`,
    ];

    yield `if(${conditions.join(' && ')}) {${this.buildError(
      'string-enum',
      `Value must be one of ${values}`,
      '',
    )}}`;

    yield 'return [];';

    yield `}`;
  }

  private *buildValidatorDescription(
    method: Method,
    indent: number = 0,
  ): Iterable<string> {
    const s = ' '.repeat(indent);

    yield ``;
    yield `${s}/**`;
    yield `${s} * Validates input parameters for the ${buildMethodName(
      method,
    )}() method.`;
    yield `${s} */`;
  }

  private *buildUnionValidator(union: Union): Iterable<string | undefined> {
    yield `export function ${buildTypeValidatorName(
      union,
    )}(params: ${buildTypeName(union, 'types')}): ValidationError[] {`;

    if (union.discriminator) {
      const propertyName = camel(union.discriminator.value);

      const allowedValues = union.members
        .map((member) => {
          const type = getTypeByName(this.service, member.typeName.value);
          if (!type) return;
          const property = type.properties.find(
            (prop) => camel(prop.name.value) === propertyName,
          );
          if (!property) return;
          if (!('constant' in property)) return;
          return property.constant?.value;
        })
        .filter(
          (
            value: string | number | boolean | undefined,
          ): value is string | number | boolean => typeof value !== 'undefined',
        );

      const allowedValueString = allowedValues
        .map((v) => (typeof v === 'string' ? `"${v}"` : `${v}`))
        .join(', ');

      yield `switch(params.${propertyName}) {`;

      for (const customValue of union.members) {
        const type = getTypeByName(this.service, customValue.typeName.value);
        if (!type) continue;
        const property = type.properties.find(
          (prop) => camel(prop.name.value) === propertyName,
        );
        if (!property) continue;
        if (!('constant' in property)) continue;

        const k = property.constant?.value;
        if (!k) continue;

        if (typeof k === 'string') {
          yield `case '${k}': {`;
        } else {
          yield `case ${k}: {`;
        }

        yield `return ${buildTypeValidatorName(type)}(params as ${buildTypeName(
          type,
          'types',
        )})`;

        yield '}';
      }

      yield `default: {`;
      this.state.touchStringEnumValidator();
      yield ` return [{ code: 'STRING_ENUM', title: 'Property \`${propertyName}\` must be one of [${allowedValueString}]', path: '' }];`;
      yield '}';

      yield `}`;
    } else {
      yield 'const errors: ValidationError[] = [];';

      for (const member of union.members) {
        if (!member.isPrimitive) {
          const errorVariable = `${camel(member.typeName.value)}Errors`;
          yield '\n';
          yield `const ${errorVariable} = ${buildTypeValidatorName(
            member,
          )}(params as ${buildTypeName(member, 'types')})`;
          yield `if(!${errorVariable}.length) return [];`;
          yield `errors.push(...${errorVariable})`;
          yield '\n';
        }
      }

      yield `return errors;`;
    }

    yield `}`;
  }

  private buildError(id: string, title: string, path: string): string {
    const code = constant(id);
    this.codes.add(code);
    return `errors.push({code: '${code}', title: '${title}', path: '${path}' });`;
  }

  private *buildValidatedServiceWrappers(): Iterable<string> {
    yield `export type ResponseBuilder<T> = (validationErrors: ValidationError[], err: any) => T`;
    for (const int of sort(this.service.interfaces)) {
      const returnTypes = sort(
        Array.from(
          new Set(
            int.methods
              .map((m) =>
                getTypeByName(this.service, m.returnType?.typeName.value),
              )
              .filter((t): t is Type => !!t),
          ),
        ),
      );

      const hasVoid = int.methods.some((m) => !m.returnType);

      const handlers = returnTypes.map(
        (type) =>
          `${camel(
            `build_${type.name.value}`,
          )}: ResponseBuilder<${buildTypeName(type, 'types')}>`,
      );
      if (hasVoid) {
        handlers.push('buildVoid: ResponseBuilder<void>');
      }

      const handlersType = `{${handlers.join(',')}}`;

      const intName = buildInterfaceName(int, 'types');
      yield `export class ${pascal(
        `validated_${int.name.value}_service`,
      )} implements ${buildInterfaceName(int, 'types')} {`;
      yield `constructor(private readonly service: ${intName}, private readonly handlers: ${handlersType}){}`;
      yield '';
      for (const method of sort(int.methods)) {
        const methodName = buildMethodName(method);
        const returnType = getTypeByName(
          this.service,
          method.returnType?.typeName.value,
        );

        const sanitize = (call: string, isAsync: boolean): string => {
          if (returnType) {
            return `sanitizers.${camel(`sanitize_${returnType.name.value}`)}(${
              isAsync ? 'await' : ''
            } ${call})`;
          } else {
            return call;
          }
        };

        const sanitizeAsync = (call: string): string => {
          return sanitize(call, true);
        };

        const sanitizeSync = (call: string): string => {
          return sanitize(call, false);
        };

        const handlerName = returnType
          ? `this.handlers.${camel(`build_${returnType.name.value}`)}`
          : 'this.handlers.buildVoid';

        const hasParams = !!method.parameters.length;
        const hasRequiredParams = method.parameters.some(isRequired);
        const paramDef = method.parameters.length
          ? `params${hasRequiredParams ? '' : '?'}: ${buildMethodParamsTypeName(
              method,
              'types',
            )}`
          : '';
        yield `async ${methodName}(${paramDef}) {`;
        yield `${
          hasParams ? 'let' : 'const'
        } validationErrors: ValidationError[] = [];`;
        yield 'try {';
        if (hasParams) {
          yield `validationErrors = ${buildParamsValidatorName(
            method,
          )}(params)`;
          yield `if(validationErrors.length) {`;
          if (returnType) {
            yield `return ${sanitizeSync(
              `${handlerName}(validationErrors, undefined)`,
            )}`;
          } else {
            yield `return ${handlerName}(validationErrors, undefined)`;
          }
          yield '}';
        }
        if (hasParams) {
          yield `const sanitizedParams = sanitizers.${camel(
            `sanitize_${method.name.value}_params`,
          )}(params)`;
        }
        yield `return ${sanitizeAsync(
          `this.service.${methodName}(${hasParams ? 'sanitizedParams' : ''})`,
        )}`;
        yield '} catch (err) {';
        if (returnType) {
          yield `return ${sanitizeSync(
            `${handlerName}(validationErrors, err)`,
          )}`;
        } else {
          yield `return ${handlerName}(validationErrors, err)`;
        }
        yield '}';
        yield '}';
        yield '';
      }
      yield '}';
      yield '';
    }
  }
}

function sort<T extends { name: Scalar<string> }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.name.value.localeCompare(b.name.value));
}
