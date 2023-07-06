import { camel, constant, pascal } from 'case';
import {
  Enum,
  File,
  getTypeByName,
  hasOnlyOptionalParameters,
  hasParameters,
  HttpParameter,
  isRequired,
  Method,
  Parameter,
  Property,
  Scalar,
  Service,
  Type,
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
  buildParameterName as originalBuildParameterName,
  buildPropertyName,
  buildRootTypeName,
  buildTypeName,
  buildInterfaceName,
} from '@basketry/typescript';
import { eslintDisable, format, from } from '@basketry/typescript/lib/utils';
import { NamespacedTypescriptValidatorsOptions } from './types';

function buildParameterName(
  param: Property | Parameter | HttpParameter,
): string {
  return param.kind === 'Parameter' || param.kind === 'HttpParameter'
    ? originalBuildParameterName(param)
    : buildPropertyName(param);
}

export type GuardClauseFactory = (
  param: Parameter | Property,
  rule: ValidationRule,
) => string | undefined;

export class ValidatorFactory {
  public readonly target = 'typescript';

  constructor(
    private readonly service: Service,
    private readonly options?: NamespacedTypescriptValidatorsOptions,
  ) {}

  build(): File[] {
    const imports = Array.from(this.buildImports()).join('\n');

    const methodParams = this.service.interfaces
      .map((int) => int.methods)
      .reduce((a, b) => a.concat(b), [])
      .map((m) =>
        Array.from(this.buildMethodParamsValidator(m))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const types = this.service.types
      .map((t) =>
        Array.from(this.buildTypeValidator(t))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const enums = this.service.enums
      .map((e) =>
        Array.from(this.buildEnumValidator(e))
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

    // Needs to be at the end so that we can capture all error code enum values
    const standardTypes = Array.from(this.buildStandardTypes()).join('\n');

    const contents = [
      header,
      disable,
      imports,
      standardTypes,
      methodParams,
      types,
      enums,
      Array.from(this.buildValidatedServiceWrappers()).join('\n'),
    ].join('\n\n');

    return [
      {
        path: [`v${this.service.majorVersion.value}`, 'validators.ts'],
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
    yield `export type ValidationError = { code: ${codes}, title: string, path: string };`;
  }

  private *buildMethodParamsValidator(
    method: Method,
  ): Iterable<string | undefined> {
    yield* this.buildValidatorDescription(method);

    yield `export function ${buildParamsValidatorName(method)}(`;
    yield* buildMethodParams(method, 'types');
    yield `): ValidationError[] {`;

    if (hasParameters(method)) {
      yield 'const errors: ValidationError[] = [];';
    }

    if (hasOnlyOptionalParameters(method)) {
      yield 'if(!params) return [];';
    }

    for (const param of method.parameters) {
      yield this.buildRequiredClause(param);
      yield this.buildPrimitiveTypeClause(param);
      yield this.buildCustomTypeClause(param);

      for (const rule of param.rules) {
        for (const factory of this.factories) {
          yield factory(param, rule);
        }
      }
    }

    if (hasParameters(method)) {
      yield 'return errors;';
    } else {
      yield 'return [];';
    }
    yield `}`;
  }

  private *buildTypeValidator(type: Type): Iterable<string | undefined> {
    yield `export function ${buildTypeValidatorName(
      type,
    )}(params: ${buildTypeName(type, 'types')}): ValidationError[] {`;

    if (type.properties.length || type.rules.length) {
      yield 'const errors: ValidationError[] = [];';
    }

    // TODO: build object rules
    // for (const rule of type.rules) {
    //   for (const factory of this.factories) {
    //     yield factory(type, rule);
    //   }
    // }

    for (const property of type.properties) {
      yield this.buildRequiredClause(property);
      yield this.buildPrimitiveTypeClause(property);
      yield this.buildCustomTypeClause(property);

      for (const rule of property.rules) {
        for (const factory of this.factories) {
          yield factory(property, rule);
        }
      }
    }

    if (type.properties.length || type.rules.length) {
      yield 'return errors;';
    } else {
      yield 'return [];';
    }

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
          ? `params${
              hasRequiredParams ? '' : '?'
            }: Parameters<${intName}['${methodName}']>[0]`
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

  buildConditions(
    param: Parameter | Property,
    conditions: (n: string) => string[],
  ): string[] {
    const paramName = buildParameterName(param);
    if (param.isArray) {
      return [
        `Array.isArray(params.${paramName})`,
        `!params.${paramName}.some((x) => ${conditions('x').join(' && ')})`,
      ];
    } else {
      return conditions(`params.` + paramName);
    }
  }

  buildMessage(param: Parameter | Property, message: string): string {
    return param.isArray ? `Each item in ${message}` : message;
  }

  buildRequiredClause(param: Parameter | Property): string | undefined {
    if (isRequired(param)) {
      const paramName = buildParameterName(param);
      return `if(typeof params.${paramName} === 'undefined') {${this.buildError(
        'required',
        `"${paramName}" is required`,
        paramName,
      )}}`;
    }
    return;
  }

  buildPrimitiveTypeClause(param: Parameter | Property): string | undefined {
    if (param.isPrimitive && param.typeName.value !== 'untyped') {
      const rootTypeName = buildRootTypeName(param, 'types');
      const paramName = buildParameterName(param);

      const conditions: string[] = [];

      const rootCondition = (variable: string) => {
        if (
          param.typeName.value === 'date' ||
          param.typeName.value === 'date-time'
        ) {
          return `!(${variable} instanceof Date)`;
        } else if (
          param.typeName.value === 'integer' ||
          param.typeName.value === 'long'
        ) {
          return `typeof ${variable} !== '${rootTypeName}' || ${variable} % 1`;
        } else {
          return `typeof ${variable} !== '${rootTypeName}'`;
        }
      };

      if (param.isArray) {
        conditions.push(
          ...[
            `Array.isArray(params.${paramName})`,
            `params.${paramName}.some(x => ${rootCondition('x')}${
              rootTypeName === 'number' ? ' || Number.isNaN(x)' : ''
            })`,
          ],
        );
      } else {
        conditions.push(
          ...[
            `typeof params.${paramName} !== 'undefined'`,
            `(${rootCondition(`params.${paramName}`)}${
              rootTypeName === 'number'
                ? ` || Number.isNaN(params.${paramName})`
                : ''
            })`,
          ],
        );
      }

      const requiredType =
        param.typeName.value === 'integer' || param.typeName.value === 'long'
          ? 'an integer'
          : `a ${rootTypeName}`;

      const message = `"${paramName}" must be ${requiredType}`;

      return `if(${conditions.join(' && ')}) {${this.buildError(
        'type',
        this.buildMessage(
          param,
          `${message}${isRequired(param) ? '' : ` if supplied`}`,
        ),
        paramName,
      )}}`;
    }
    return;
  }

  buildCustomTypeClause(param: Parameter | Property): string | undefined {
    if (!param.isPrimitive) {
      const typeValidatorName = buildTypeValidatorName(param);
      const paramName = buildParameterName(param);
      if (param.isArray) {
        return `if(typeof params.${paramName} !== 'undefined') {params.${paramName}.forEach( arrayItem => errors.push(...${typeValidatorName}(arrayItem)));}`;
      } else {
        return `if(typeof params.${paramName} !== 'undefined') { errors.push(...${typeValidatorName}(params.${paramName})); }`;
      }
    }
    return;
  }

  buildStringEnumRuleClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'string-enum') {
      const paramName = buildParameterName(param);
      const values = `[${rule.values.map((v) => `"${v.value}"`).join(', ')}]`;

      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'string'`,
        `!${values}.includes(${name})`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(param, `"${paramName}" must be one of ${values}`),
        paramName,
      )}}`;
    }
    return;
  };

  buildStringMaxLengthClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'string-max-length') {
      const paramName = buildParameterName(param);
      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'string'`,
        `${name}.length > ${rule.length.value}`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(
          param,
          `"${paramName}" max length is ${rule.length.value}`,
        ),
        paramName,
      )}}`;
    }
    return;
  };

  buildStringMinLengthClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'string-min-length') {
      const paramName = buildParameterName(param);
      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'string'`,
        `${name}.length < ${rule.length.value}`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(
          param,
          `"${paramName}" min length is ${rule.length.value}`,
        ),
        paramName,
      )}}`;
    }
    return;
  };

  buildStringPatternClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'string-pattern') {
      const paramName = buildParameterName(param);
      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'string'`,
        `/${rule.pattern.value}/.test(${name})`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(
          param,
          `"${paramName}" must match the pattern /${rule.pattern.value}/`,
        ),
        paramName,
      )}}`;
    }
    return;
  };

  buildNumberMultipleOfClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'number-multiple-of') {
      const paramName = buildParameterName(param);
      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'number'`,
        `${name} % ${rule.value.value} !== 0`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(
          param,
          `"${paramName}" must be a multiple of ${rule.value.value}`,
        ),
        paramName,
      )}}`;
    }
    return;
  };

  buildNumberGreaterThanClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'number-gt') {
      const paramName = buildParameterName(param);
      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'number'`,
        `${name} <= ${rule.value.value}`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(
          param,
          `"${paramName}" must be greater than ${rule.value.value}`,
        ),
        paramName,
      )}}`;
    }
    return;
  };

  buildNumberGreaterOrEqualClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'number-gte') {
      const paramName = buildParameterName(param);
      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'number'`,
        `${name} < ${rule.value.value}`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(
          param,
          `"${paramName}" must be greater than or equal to ${rule.value.value}`,
        ),
        paramName,
      )}}`;
    }
    return;
  };

  buildNumberLessThanClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'number-lt') {
      const paramName = buildParameterName(param);
      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'number'`,
        `${name} >= ${rule.value.value}`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(
          param,
          `"${paramName}" must be less than ${rule.value.value}`,
        ),
        paramName,
      )}}`;
    }
    return;
  };

  buildNumberLessOrEqualClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'number-lte') {
      const paramName = buildParameterName(param);
      const conditions = this.buildConditions(param, (name) => [
        `typeof ${name} === 'number'`,
        `${name} > ${rule.value.value}`,
      ]);

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        this.buildMessage(
          param,
          `"${paramName}" must be less than or equal to ${rule.value.value}`,
        ),
        paramName,
      )}}`;
    }
    return;
  };

  buildArrayMaxItemsClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'array-max-items') {
      const paramName = buildParameterName(param);
      const conditions = [
        `Array.isArray(params.${paramName})`,
        `params.${paramName}.length > ${rule.max.value}`,
      ];

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        `"${paramName}" max length is ${rule.max.value}`,
        paramName,
      )}}`;
    }
    return;
  };

  buildArrayMinItemsClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'array-min-items') {
      const paramName = buildParameterName(param);
      const conditions = [
        `Array.isArray(params.${paramName})`,
        `params.${paramName}.length < ${rule.min.value}`,
      ];

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        `"${paramName}" min length is ${rule.min.value}`,
        paramName,
      )}}`;
    }
    return;
  };

  buildArrayUniqueItemsClause: GuardClauseFactory = (param, rule) => {
    if (rule.id === 'array-unique-items') {
      const paramName = buildParameterName(param);
      const conditions = [
        `Array.isArray(params.${paramName})`,
        `params.${param.name.value}.length === new Set(${paramName}).length`,
      ];

      return `if(${conditions.join(' && ')}) {${this.buildError(
        rule.id,
        `"${paramName}" must contain unique values`,
        paramName,
      )}}`;
    }
    return;
  };

  private readonly factories = [
    this.buildStringEnumRuleClause.bind(this),
    this.buildStringMaxLengthClause.bind(this),
    this.buildStringMinLengthClause.bind(this),
    this.buildStringPatternClause.bind(this),
    this.buildNumberMultipleOfClause.bind(this),
    this.buildNumberGreaterThanClause.bind(this),
    this.buildNumberGreaterOrEqualClause.bind(this),
    this.buildNumberLessThanClause.bind(this),
    this.buildNumberLessOrEqualClause.bind(this),
    this.buildArrayMaxItemsClause.bind(this),
    this.buildArrayMinItemsClause.bind(this),
    this.buildArrayUniqueItemsClause.bind(this),
  ];
}

function sort<T extends { name: Scalar<string> }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.name.value.localeCompare(b.name.value));
}
