import { buildParameterName, buildPropertyName } from '@basketry/typescript';
import { Parameter, Property, ValidationRule, isRequired } from 'basketry';
import { buildTypeValidatorName } from './name-factory';

/**
 * Tracks state across all method and type validators so
 * that only the required internal helpers will be generated
 */
export class ValidatorMethodFactory {
  private readonly codes = new Set<string>();

  touchStringEnumValidator() {
    this.codes.add('STRING_ENUM');
  }

  private needsRequiredValidator = false;
  touchRequiredValidator() {
    this.needsRequiredValidator = true;
    this.codes.add('REQUIRED');
  }

  private needsArrayValidator = false;
  touchArrayValidator() {
    this.needsArrayValidator = true;
  }

  private needsArrayMaxItemsValidator = false;
  touchArrayMaxItemsValidator() {
    this.needsArrayMaxItemsValidator = true;
    this.codes.add('ARRAY_MAX_ITEMS');
  }

  private needsArrayMinItemsValidator = false;
  touchArrayMinItemsValidator() {
    this.needsArrayMinItemsValidator = true;
    this.codes.add('ARRAY_MIN_ITEMS');
  }

  private needsArrayUniqueItemsValidator = false;
  touchArrayUniqueItemsValidator() {
    this.needsArrayUniqueItemsValidator = true;
    this.codes.add('ARRAY_UNIQUE_ITEMS');
  }

  private needsPassthroughValidator = false;
  touchPassthroughValidator() {
    this.needsPassthroughValidator = true;
  }

  private needsStringValidator = false;
  touchStringValidator() {
    this.needsStringValidator = true;
    this.codes.add('TYPE');
  }

  private needsNumberValidator = false;
  touchNumberValidator() {
    this.needsNumberValidator = true;
    this.codes.add('TYPE');
  }

  private needsIntegerValidator = false;
  touchIntegerValidator() {
    this.needsIntegerValidator = true;
    this.codes.add('TYPE');
  }

  private needsBooleanValidator = false;
  touchBooleanValidator() {
    this.needsBooleanValidator = true;
    this.codes.add('TYPE');
  }

  private needsDateValidator = false;
  touchDateValidator() {
    this.needsDateValidator = true;
    this.codes.add('TYPE');
  }

  private needsStringMaxLengthValidator = false;
  touchStringMaxLengthValidator() {
    this.needsStringMaxLengthValidator = true;
    this.codes.add('STRING_MAX_LENGTH');
  }

  private needsStringMinLengthValidator = false;
  touchStringMinLengthValidator() {
    this.needsStringMinLengthValidator = true;
    this.codes.add('STRING_MIN_LENGTH');
  }

  private needsStringPatternValidator = false;
  touchStringPatternValidator() {
    this.needsStringPatternValidator = true;
    this.codes.add('STRING_PATTERN');
  }

  private needsNumberMultipleOfValidator = false;
  touchNumberMultipleOfValidator() {
    this.needsNumberMultipleOfValidator = true;
    this.codes.add('NUMBER_MULTIPLE_OF');
  }

  private needsNumberGreaterThanValidator = false;
  touchNumberGreaterThanValidator() {
    this.needsNumberGreaterThanValidator = true;
    this.codes.add('NUMBER_GT');
  }

  private needsNumberGreaterOrEqualValidator = false;
  touchNumberGreaterOrEqualValidator() {
    this.needsNumberGreaterOrEqualValidator = true;
    this.codes.add('NUMBER_GTE');
  }

  private needsNumberLessThanValidator = false;
  touchNumberLessThanValidator() {
    this.needsNumberLessThanValidator = true;
    this.codes.add('NUMBER_LT');
  }

  private needsNumberLessOrEqualValidator = false;
  touchNumberLessOrEqualValidator() {
    this.needsNumberLessOrEqualValidator = true;
    this.codes.add('NUMBER_LTE');
  }

  *buildInternalHelperMethods(): Iterable<string> {
    yield this.buildValidationErrorType();
    yield '';
    yield this.buildValidationFunctionType();
    yield '';
    yield this.buildValidatorClass();
    yield '';

    yield* this.buildRequiredValidator();
    yield* this.buildArrayItemValidator();
    yield* this.buildArrayMaxItemsValidator();
    yield* this.buildArrayMinItemsValidator();
    yield* this.buildArrayUniqueItemsValidator();
    yield* this.buildPassthroughValidator();
    yield* this.buildNativeTypeValidator();
    yield* this.buildStringValidator();
    yield* this.buildNumberValidator();
    yield* this.buildIntegerValidator();
    yield* this.buildBooleanValidator();
    yield* this.buildDateValidator();
    yield* this.buildStringMaxLengthValidator();
    yield* this.buildStringMinLengthValidator();
    yield* this.buildStringPatternValidator();
    yield* this.buildNumberMultipleOfValidator();
    yield* this.buildNumberGreaterThanValidator();
    yield* this.buildNumberGreaterOrEqualValidator();
    yield* this.buildNumberLessThanValidator();
    yield* this.buildNumberLessOrEqualValidator();
  }

  private buildValidationErrorType(): string {
    return `export type ValidationError = {
        code: ${Array.from(this.codes)
          .sort((a, b) => a.localeCompare(b))
          .map((c) => `'${c}'`)
          .join(' | ')};
        title: string;
        path: string;
      };`;
  }

  private buildValidationFunctionType(): string {
    return `type ValidationFunction = (
        value: any,
        path: string,
        isRequired: boolean,
      ) => ValidationError[];`;
  }

  private buildValidatorClass(): string {
    return `class Validator {
        constructor(private readonly parentPath?: string) {}
        private _errors: ValidationError[] = [];
        get errors(): ValidationError[] {
          return this._errors;
        }
      
        required(value: any, path: string) {
          return {
            ensure: (...validators: ValidationFunction[]) =>
              this.run(value, path, [required, ...validators], true),
          };
        }
      
        optional(value: any, path: string) {
          return {
            ensure: (...validators: ValidationFunction[]) =>
              this.run(value, path, validators, false),
          };
        }
      
        private run(
          value: any,
          path: string,
          validators: ValidationFunction[],
          isRequired: boolean,
        ) {
          for (const validator of validators) {
            this._errors.push(
              ...validator(
                value,
                this.parentPath ? \`\${this.parentPath}.\${path}\` : path,
                isRequired,
              ),
            );
          }
        }
      }`;
  }

  private *buildArrayItemValidator(): Iterable<string> {
    if (this.needsArrayValidator) {
      yield ' ';
      yield `const array: (
        ...validators: ValidationFunction[]
      ) => ValidationFunction =
        (...validators) =>
        (value, path, isRequired) => {
          if (Array.isArray(value)) {
            const errors: ValidationError[] = [];
      
            for (const [index, item] of value.entries()) {
              for (const validator of validators) {
                errors.push(...validator(item, \`\${path}[\${index}]\`, isRequired));
              }
            }
      
            return errors;
          } else if (typeof value !== 'undefined') {
            return [
              {
                code: 'TYPE',
                title: \`"\${path}" must be an array\${
                  isRequired ? '' : ' if supplied'
                }\`,
                path,
              },
            ];
          } else {
            return [];
          }
        };`;
    }
  }

  private *buildPassthroughValidator(): Iterable<string> {
    if (this.needsPassthroughValidator) {
      yield `const using: (
            validator: (value: any, parentPath?: string) => ValidationError[],
          ) => ValidationFunction = (validator) => (value, path) =>
        validator(value, path);`;
    }
  }

  private *buildRequiredValidator(): Iterable<string> {
    if (this.needsRequiredValidator) {
      yield ' ';
      yield `const required: ValidationFunction = (value, path) => {
        if (typeof value === 'undefined') {
          return [{ code: 'REQUIRED', title: \`"\${path}" is required\`, path }];
        }
        return [];
      };`;
    }
  }

  private *buildNativeTypeValidator(): Iterable<string> {
    if (
      this.needsStringValidator ||
      this.needsNumberValidator ||
      this.needsBooleanValidator
    ) {
      const primitive: ('string' | 'number' | 'boolean')[] = [];
      if (this.needsStringValidator) primitive.push('string');
      if (this.needsNumberValidator) primitive.push('number');
      if (this.needsBooleanValidator) primitive.push('boolean');
      yield ' ';
      yield `function nativeType(
        value: any,
        path: string,
        primitive: ${primitive.map((p) => `'${p}'`).join(' | ')},
        isRequired: boolean,
      ): ValidationError[] {
        if (
          typeof value !== primitive &&
          (isRequired || typeof value !== 'undefined')
        ) {
          return [{
            code: 'TYPE',
            title: \`"\${path}" must be a \${primitive}\${
              isRequired ? ' if supplied' : ''
            }\`,
            path,
          }];
        }
        return [];
      }`;
    }
  }

  private *buildStringValidator(): Iterable<string> {
    if (this.needsStringValidator) {
      yield ' ';
      yield `const string: ValidationFunction =
        (value, path, isRequred) => {
        return nativeType(value, path, 'string', isRequred);
        };`;
    }
  }

  private *buildNumberValidator(): Iterable<string> {
    if (this.needsStringValidator) {
      yield ' ';
      yield `const number: ValidationFunction =
        (value, path, isRequred) => {
        return nativeType(value, path, 'number', isRequred);
        };`;
    }
  }

  private *buildIntegerValidator(): Iterable<string> {
    if (this.needsIntegerValidator) {
      yield `const integer: ValidationFunction = (value, path, isRequired) => {
        if (
          (typeof value === 'number' && value % 1 !== 0) ||
          (typeof value !== 'number' && (isRequired || typeof value !== 'undefined'))
        ) {
          return [
            {
              code: 'TYPE',
              title: \`"\${path}" must be an integer\${
                isRequired ? ' if supplied' : ''
              }\`,
              path,
            },
          ];
        }
        return [];
      };`;
    }
  }

  private *buildBooleanValidator(): Iterable<string> {
    if (this.needsBooleanValidator) {
      yield ' ';
      yield `const boolean: ValidationFunction =
        (value, path, isRequred) => {
        return nativeType(value, path, 'boolean', isRequred);
        };`;
    }
  }

  private *buildDateValidator(): Iterable<string> {
    if (this.needsDateValidator) {
      yield ' ';
      yield `const date: ValidationFunction = (value, path, isRequired) => {
        if (value instanceof Date) return [];
        if (isRequired || typeof value !== 'undefined') {
          return [
            {
              code: 'TYPE',
              title: \`"\${path}" must be a Date\${isRequired ? ' if supplied' : ''}\`,
              path,
            },
          ];
        }
        return [];
      };`;
    }
  }

  private *buildStringMaxLengthValidator(): Iterable<string> {
    if (this.needsStringMaxLengthValidator) {
      yield ' ';
      yield `const maxLength: (
        max: number,
      ) => ValidationFunction = (max) => (value, path, isRequired) => {
        if (typeof value === 'string' && value.length > max) {
          return [
            {
              code: 'STRING_MAX_LENGTH',
              title: \`"\${path}" must be at most \${max} characters\${
                isRequired ? '' : ' if supplied'
              }\`,
              path,
            },
          ];
        }
        return [];
      };`;
    }
  }

  private *buildStringMinLengthValidator(): Iterable<string> {
    if (this.needsStringMinLengthValidator) {
      yield ' ';
      yield `const minLength: (
        min: number,
      ) => ValidationFunction = (min) => (value, path, isRequired) => {
        if (typeof value === 'string' && value.length < min) {
          return [
            {
              code: 'STRING_MIN_LENGTH',
              title: \`"\${path}" must be at most \${min} characters\${
                isRequired ? '' : ' if supplied'
              }\`,
              path,
            },
          ];
        }
        return [];
      };`;
    }
  }

  private *buildStringPatternValidator(): Iterable<string> {
    if (this.needsStringPatternValidator) {
      yield ' ';
      yield `const pattern: (
        regex: RegExp,
      ) => ValidationFunction = (regex) => (value, path, isRequired) => {
        if (typeof value === 'string' && !regex.test(value)) {
          return [
            {
              code: 'STRING_PATTERN',
              title: \`"\${path}" must match the pattern "\${regex}"\${
                isRequired ? '' : ' if supplied'
              }\`,
              path,
            },
          ];
        }
        return [];
      };`;
    }
  }

  private *buildNumberMultipleOfValidator(): Iterable<string> {
    if (this.needsNumberMultipleOfValidator) {
      yield `const multipleOf: (factor: number) => ValidationFunction =
        (factor) => (value, path, isRequired) => {
        if (isRequired || typeof value !== 'undefined') {
            if (typeof value === 'number' && value % factor !== 0) {
            return [{
                code: 'NUMBER_MULTIPLE_OF',
                title: \`"\${path}" must be a multiple of \${factor}\${
                    isRequired ? '' : ' if supplied'
                }\`,
                path,
            }];
            }
        }
        return [];
        };`;
    }
  }

  private *buildNumberGreaterThanValidator(): Iterable<string> {
    if (this.needsNumberGreaterThanValidator) {
      yield `const gt: (min: number) => ValidationFunction =
      (min) => (value, path, isRequired) => {
        if (isRequired || typeof value !== 'undefined') {
          if (typeof value === 'number' && value <= min) {
            return [
              {
                code: 'NUMBER_GT',
                title: \`"\${path}" must be greater than \${min}\${
                  isRequired ? ' if supplied' : ''
                }\`,
                path,
              },
            ];
          }
        }
        return [];
      };`;
    }
  }

  private *buildNumberGreaterOrEqualValidator(): Iterable<string> {
    if (this.needsNumberGreaterOrEqualValidator) {
      yield `const gte: (min: number) => ValidationFunction =
      (min) => (value, path, isRequired) => {
        if (isRequired || typeof value !== 'undefined') {
          if (typeof value === 'number' && value < min) {
            return [
              {
                code: 'NUMBER_GTE',
                title: \`"\${path}" must be greater than or equal to \${min}\${
                  isRequired ? ' if supplied' : ''
                }\`,
                path,
              },
            ];
          }
        }
        return [];
      };`;
    }
  }

  private *buildNumberLessThanValidator(): Iterable<string> {
    if (this.needsNumberLessThanValidator) {
      yield `const lt: (max: number) => ValidationFunction =
      (max) => (value, path, isRequired) => {
        if (isRequired || typeof value !== 'undefined') {
          if (typeof value === 'number' && value >= max) {
            return [
              {
                code: 'NUMBER_LT',
                title: \`"\${path}" must be less than \${max}\${
                  isRequired ? ' if supplied' : ''
                }\`,
                path,
              },
            ];
          }
        }
        return [];
      };`;
    }
  }

  private *buildNumberLessOrEqualValidator(): Iterable<string> {
    if (this.needsNumberLessOrEqualValidator) {
      yield `const lte: (max: number) => ValidationFunction =
      (max) => (value, path, isRequired) => {
        if (isRequired || typeof value !== 'undefined') {
          if (typeof value === 'number' && value > max) {
            return [
              {
                code: 'NUMBER_LTE',
                title: \`"\${path}" must be less than or equal to \${max}\${
                  isRequired ? ' if supplied' : ''
                }\`,
                path,
              },
            ];
          }
        }
        return [];
      };`;
    }
  }

  private *buildArrayMaxItemsValidator(): Iterable<string> {
    if (this.needsArrayMaxItemsValidator) {
      yield `const maxItems: (max: number) => ValidationFunction =
      (max) => (value, path, isRequired) => {
        if (Array.isArray(value) && value.length > max) {
          return [
            {
              code: 'ARRAY_MAX_ITEMS',
              title: \`"\${path}" must have at most \${max} items\${
                isRequired ? '' : ' if supplied'
              }\`,
              path,
            },
          ];
        }
        return [];
      };`;
    }
  }

  private *buildArrayMinItemsValidator(): Iterable<string> {
    if (this.needsArrayMinItemsValidator) {
      yield `const minItems: (min: number) => ValidationFunction =
      (min) => (value, path, isRequired) => {
        if (Array.isArray(value) && value.length < min) {
          return [
            {
              code: 'ARRAY_MIN_ITEMS',
              title: \`"\${path}" must have at least \${min} items\${
                isRequired ? '' : ' if supplied'
              }\`,
              path,
            },
          ];
        }
        return [];
      };`;
    }
  }

  private *buildArrayUniqueItemsValidator(): Iterable<string> {
    if (this.needsArrayUniqueItemsValidator) {
      yield `const uniqueItems: () => ValidationFunction = () => (
      value,
      path,
      isRequired,
    ) => {
      if (Array.isArray(value)) {
        const seen = new Set();
        const errors: ValidationError[] = [];
  
        for (const [index, item] of value.entries()) {
          if (seen.has(item)) {
            errors.push({
              code: 'ARRAY_UNIQUE_ITEMS',
              title: \`"\${path}" must have unique items\${
                isRequired ? '' : ' if supplied'
              }\`,
              path: \`\${path}[\${index}]\`,
            });
          } else {
            seen.add(item);
          }
        }
  
        return errors;
      }
      return [];
    };`;
    }
  }
}

export class MemberValidatorFactory {
  constructor(
    private readonly state: ValidatorMethodFactory,
    private readonly parentPathExpression?: string,
  ) {}

  *build(members: (Property | Parameter)[]): Iterable<string> {
    yield `const validator = new Validator(${
      this.parentPathExpression ?? ''
    });`;

    yield ' ';

    for (const member of members.sort((a, b) =>
      a.name.value.localeCompare(b.name.value),
    )) {
      if (isRequired(member)) this.state.touchRequiredValidator();
      const validatorMethodName = isRequired(member) ? 'required' : 'optional';

      const accessor = `params.${buildMemberName(member)}`;
      yield `validator.${validatorMethodName}(${accessor}, '${member.name.value}').ensure(`;

      if (member.isArray) {
        for (const rule of member.rules) {
          yield* this.buildArrayMaxItemsValiation(rule);
          yield* this.buildArrayMinItemsValiation(rule);
          yield* this.buildArrayUniqueItemsValiation(rule);
        }
        this.state.touchArrayValidator();
        yield 'array(';
      }

      if (member.isPrimitive) {
        yield* this.buildStringTypeValidation(member);
        yield* this.buildNumberTypeValidation(member);
        yield* this.buildIntegerTypeValidation(member);
        yield* this.buildBooleanTypeValidation(member);
        yield* this.buildDateTypeValidation(member);

        for (const rule of member.rules) {
          yield* this.buildStringMaxLengthValidation(rule);
          yield* this.buildStringMinLengthValidation(rule);
          yield* this.buildStringPatternValidation(rule);
          yield* this.buildNumberMultipleOfValidation(rule);
          yield* this.buildNumberGreaterThanValidation(rule);
          yield* this.buildNumberGreaterOrEqualValidation(rule);
          yield* this.buildNumberLessThanValidation(rule);
          yield* this.buildNumberLessOrEqualValidation(rule);
        }
      } else {
        this.state.touchPassthroughValidator();
        yield `using(${buildTypeValidatorName(member)})`;
      }

      if (member.isArray) yield '),';
      yield ');';
    }
    yield ' ';
    yield 'return validator.errors;';
  }

  private *buildStringTypeValidation(
    member: Property | Parameter,
  ): Iterable<string> {
    if (member.isPrimitive && member.typeName.value === 'string') {
      this.state.touchStringValidator();
      yield 'string,';
    }
  }

  private *buildNumberTypeValidation(
    member: Property | Parameter,
  ): Iterable<string> {
    if (member.isPrimitive) {
      switch (member.typeName.value) {
        case 'number':
        case 'float':
        case 'double': {
          this.state.touchNumberValidator();
          yield 'number,';
        }
      }
    }
  }

  private *buildIntegerTypeValidation(
    member: Property | Parameter,
  ): Iterable<string> {
    if (member.isPrimitive) {
      switch (member.typeName.value) {
        case 'integer':
        case 'long': {
          this.state.touchIntegerValidator();
          yield 'integer,';
        }
      }
    }
  }

  private *buildBooleanTypeValidation(
    member: Property | Parameter,
  ): Iterable<string> {
    if (member.isPrimitive && member.typeName.value === 'boolean') {
      this.state.touchBooleanValidator();
      yield 'boolean,';
    }
  }

  private *buildDateTypeValidation(
    member: Property | Parameter,
  ): Iterable<string> {
    if (member.isPrimitive) {
      switch (member.typeName.value) {
        case 'date':
        case 'date-time': {
          this.state.touchDateValidator();
          yield 'date,';
        }
      }
    }
  }

  private *buildStringMaxLengthValidation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'string-max-length') {
      this.state.touchStringMaxLengthValidator();
      yield `maxLength(${rule.length.value}),`;
    }
  }

  private *buildStringMinLengthValidation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'string-min-length') {
      this.state.touchStringMinLengthValidator();
      yield `minLength(${rule.length.value}),`;
    }
  }

  private *buildStringPatternValidation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'string-pattern') {
      this.state.touchStringPatternValidator();
      yield `pattern(/${rule.pattern.value}/),`;
    }
  }

  private *buildNumberMultipleOfValidation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'number-multiple-of') {
      this.state.touchNumberMultipleOfValidator();
      yield `multipleOf(${rule.value.value}),`;
    }
  }

  private *buildNumberGreaterThanValidation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'number-gt') {
      this.state.touchNumberGreaterThanValidator();
      yield `gt(${rule.value.value}),`;
    }
  }

  private *buildNumberGreaterOrEqualValidation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'number-gte') {
      this.state.touchNumberGreaterOrEqualValidator();
      yield `gte(${rule.value.value}),`;
    }
  }

  private *buildNumberLessThanValidation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'number-lt') {
      this.state.touchNumberLessThanValidator();
      yield `lt(${rule.value.value}),`;
    }
  }

  private *buildNumberLessOrEqualValidation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'number-lte') {
      this.state.touchNumberLessOrEqualValidator();
      yield `lte(${rule.value.value}),`;
    }
  }

  private *buildArrayMaxItemsValiation(rule: ValidationRule): Iterable<string> {
    if (rule.id === 'array-max-items') {
      this.state.touchArrayMaxItemsValidator();
      yield `maxItems(${rule.max.value}),`;
    }
  }

  private *buildArrayMinItemsValiation(rule: ValidationRule): Iterable<string> {
    if (rule.id === 'array-min-items') {
      this.state.touchArrayMinItemsValidator();
      yield `minItems(${rule.min.value}),`;
    }
  }

  private *buildArrayUniqueItemsValiation(
    rule: ValidationRule,
  ): Iterable<string> {
    if (rule.id === 'array-unique-items') {
      this.state.touchArrayUniqueItemsValidator();
      yield `uniqueItems(),`;
    }
  }
}

function buildMemberName(member: Property | Parameter) {
  if (member.kind === 'Property') {
    return buildPropertyName(member);
  } else {
    return buildParameterName(member);
  }
}
