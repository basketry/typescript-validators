import { constant } from 'case';
import { format } from 'prettier';
import {
  Enum,
  File,
  FileFactory,
  hasOnlyOptionalParameters,
  hasParameters,
  isRequired,
  Method,
  Parameter,
  Property,
  Service,
  Type,
  ValidationRule,
} from 'basketry';
import { warning } from './warning';
import {
  buildEnumValidatorName,
  buildParamsValidatorName,
  buildTypeGuardName,
  buildTypeValidatorName,
} from './name-factory';
import {
  buildMethodName,
  buildMethodParams,
  buildParameterName,
  buildRootTypeName,
  buildTypeName,
} from '@basketry/typescript';

export type GuardClauseFactory = (
  param: Parameter | Property,
  rule: ValidationRule,
) => string | undefined;

export class ValidatorFactory implements FileFactory {
  public readonly target = 'typescript';

  constructor(private readonly factories: GuardClauseFactory[]) {}

  build(service: Service): File[] {
    const imports = Array.from(this.buildImports()).join('\n');
    const standardTypes = Array.from(this.buildStandardTypes()).join('\n');

    const methodParams = service.interfaces
      .map((int) => int.methods)
      .reduce((a, b) => a.concat(b), [])
      .map((m) =>
        Array.from(this.buildMethodParamsValidator(m))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const types = service.types
      .map((t) =>
        Array.from(this.buildTypeValidator(t))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const enums = service.enums
      .map((e) =>
        Array.from(this.buildEnumValidator(e))
          .filter((x) => x)
          .join('\n'),
      )
      .join('\n\n');

    const contents = [
      warning,
      imports,
      standardTypes,
      methodParams,
      types,
      enums,
    ].join('\n\n');
    const formatted = format(contents, {
      singleQuote: true,
      useTabs: false,
      tabWidth: 2,
      trailingComma: 'all',
      parser: 'typescript',
    });

    return [
      {
        path: [`v${service.majorVersion.value}`, 'validators.ts'],
        contents: formatted,
      },
    ];
  }

  private *buildImports(): Iterable<string> {
    yield 'import * as types from "./types"';
  }

  private *buildStandardTypes(): Iterable<string> {
    yield 'export type ValidationError = { code: string, title: string, path: string };';
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
      yield buildRequiredClause(param);
      yield buildNonLocalTypeClause(param);
      yield buildLocalTypeClause(param);

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
      yield buildRequiredClause(property);
      yield buildNonLocalTypeClause(property);
      yield buildLocalTypeClause(property);

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

    const values = `[${e.values.map((v) => `"${v.value}"`).join(', ')}]`;

    const conditions = [
      `typeof value === 'string'`,
      `!${values}.includes(value)`,
    ];

    yield `if(${conditions.join(' && ')}) {${buildError(
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
}

function buildError(id: string, title: string, path: string): string {
  return `errors.push({code: '${constant(
    id,
  )}', title: '${title}', path: '${path}' });`;
}

function buildConditions(
  param: Parameter,
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

function buildMessage(param: Parameter | Property, message: string): string {
  return param.isArray ? `Each item in ${message}` : message;
}

function buildRequiredClause(param: Parameter | Property): string | undefined {
  if (isRequired(param)) {
    const paramName = buildParameterName(param);
    return `if(typeof params.${paramName} === 'undefined') {${buildError(
      'required',
      `"${paramName}" is required`,
      paramName,
    )}}`;
  }
  return;
}

function buildNonLocalTypeClause(
  param: Parameter | Property,
): string | undefined {
  if (!param.isLocal && !param.isUnknown) {
    const rootTypeName = buildRootTypeName(param, 'types');
    const paramName = buildParameterName(param);

    const conditions: string[] = [];

    const rootCondition = (variable: string) => {
      if (
        param.typeName.value === 'date' ||
        param.typeName.value === 'date-time'
      ) {
        return `!(${variable} instanceof Date)`;
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

    const message = `"${paramName}" must be a ${rootTypeName}`;

    return `if(${conditions.join(' && ')}) {${buildError(
      'type',
      buildMessage(
        param,
        `${message}${isRequired(param) ? '' : ` if supplied`}`,
      ),
      paramName,
    )}}`;
  }
  return;
}

function buildLocalTypeClause(param: Parameter | Property): string | undefined {
  if (param.isLocal && !param.isUnknown) {
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

export const buildStringEnumRuleClause: GuardClauseFactory = (param, rule) => {
  if (rule.id === 'string-enum') {
    const paramName = buildParameterName(param);
    const values = `[${rule.values.map((v) => `"${v.value}"`).join(', ')}]`;

    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'string'`,
      `!${values}.includes(${name})`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(param, `"${paramName}" must be one of ${values}`),
      paramName,
    )}}`;
  }
  return;
};

export const buildStringMaxLengthClause: GuardClauseFactory = (param, rule) => {
  if (rule.id === 'string-max-length') {
    const paramName = buildParameterName(param);
    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'string'`,
      `${name}.length > ${rule.length.value}`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(param, `"${paramName}" max length is ${rule.length.value}`),
      paramName,
    )}}`;
  }
  return;
};

export const buildStringMinLengthClause: GuardClauseFactory = (param, rule) => {
  if (rule.id === 'string-min-length') {
    const paramName = buildParameterName(param);
    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'string'`,
      `$${name}.length < ${rule.length.value}`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(param, `"${paramName}" min length is ${rule.length.value}`),
      paramName,
    )}}`;
  }
  return;
};

export const buildStringPatternClause: GuardClauseFactory = (param, rule) => {
  if (rule.id === 'string-pattern') {
    const paramName = buildParameterName(param);
    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'string'`,
      `/${rule.pattern.value}/.test(${name})`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(
        param,
        `"${paramName}" must match the pattern /${rule.pattern.value}/`,
      ),
      paramName,
    )}}`;
  }
  return;
};

export const buildNumberMultipleOfClause: GuardClauseFactory = (
  param,
  rule,
) => {
  if (rule.id === 'number-multiple-of') {
    const paramName = buildParameterName(param);
    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'number'`,
      `${name} % ${rule.value.value} !== 0`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(
        param,
        `"${paramName}" must be a multiple of ${rule.value.value}`,
      ),
      paramName,
    )}}`;
  }
  return;
};

export const buildNumberGreaterThanClause: GuardClauseFactory = (
  param,
  rule,
) => {
  if (rule.id === 'number-gt') {
    const paramName = buildParameterName(param);
    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'number'`,
      `${name} <= ${rule.value.value}`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(
        param,
        `"${paramName}" must be greater than ${rule.value.value}`,
      ),
      paramName,
    )}}`;
  }
  return;
};

export const buildNumberGreaterOrEqualClause: GuardClauseFactory = (
  param,
  rule,
) => {
  if (rule.id === 'number-gte') {
    const paramName = buildParameterName(param);
    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'number'`,
      `${name} < ${rule.value.value}`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(
        param,
        `"${paramName}" must be greater than or equal to ${rule.value.value}`,
      ),
      paramName,
    )}}`;
  }
  return;
};

export const buildNumberLessThanClause: GuardClauseFactory = (param, rule) => {
  if (rule.id === 'number-lt') {
    const paramName = buildParameterName(param);
    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'number'`,
      `${name} >= ${rule.value.value}`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(
        param,
        `"${paramName}" must be less than ${rule.value.value}`,
      ),
      paramName,
    )}}`;
  }
  return;
};

export const buildNumberLessOrEqualClause: GuardClauseFactory = (
  param,
  rule,
) => {
  if (rule.id === 'number-lte') {
    const paramName = buildParameterName(param);
    const conditions = buildConditions(param, (name) => [
      `typeof ${name} === 'number'`,
      `${name} > ${rule.value.value}`,
    ]);

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      buildMessage(
        param,
        `"${paramName}" must be less than or equal to ${rule.value.value}`,
      ),
      paramName,
    )}}`;
  }
  return;
};

export const buildArrayMaxItemsClause: GuardClauseFactory = (param, rule) => {
  if (rule.id === 'array-max-items') {
    const paramName = buildParameterName(param);
    const conditions = [
      `Array.isArray(params.${paramName})`,
      `params.${paramName}.length > ${rule.max.value}`,
    ];

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      `"${paramName}" max length is ${rule.max.value}`,
      paramName,
    )}}`;
  }
  return;
};

export const buildArrayMinItemsClause: GuardClauseFactory = (param, rule) => {
  if (rule.id === 'array-min-items') {
    const paramName = buildParameterName(param);
    const conditions = [
      `Array.isArray(params.${paramName})`,
      `params.${paramName}.length < ${rule.min.value}`,
    ];

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      `"${paramName}" min length is ${rule.min.value}`,
      paramName,
    )}}`;
  }
  return;
};

export const buildArrayUniqueItemsClause: GuardClauseFactory = (
  param,
  rule,
) => {
  if (rule.id === 'array-unique-items') {
    const paramName = buildParameterName(param);
    const conditions = [
      `Array.isArray(params.${paramName})`,
      `params.${param.name.value}.length === new Set(${paramName}).length`,
    ];

    return `if(${conditions.join(' && ')}) {${buildError(
      rule.id,
      `"${paramName}" must contain unique values`,
      paramName,
    )}}`;
  }
  return;
};

export const defaultFactories = [
  buildStringEnumRuleClause,
  buildStringMaxLengthClause,
  buildStringMinLengthClause,
  buildStringPatternClause,
  buildNumberMultipleOfClause,
  buildNumberGreaterThanClause,
  buildNumberGreaterOrEqualClause,
  buildNumberLessThanClause,
  buildNumberLessOrEqualClause,
  buildArrayMaxItemsClause,
  buildArrayMinItemsClause,
  buildArrayUniqueItemsClause,
];
