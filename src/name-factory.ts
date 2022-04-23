import { buildTypeName } from '@basketry/typescript';
import { Enum, Method, Parameter, Property, ReturnType, Type } from 'basketry';
import { camel } from 'case';

function prefix(validatorModule: string | undefined, name: string) {
  return validatorModule ? `${validatorModule}.${name}` : name;
}

export function buildParamsValidatorName(
  method: Method,
  validatorModule?: string,
): string {
  return prefix(validatorModule, camel(`validate_${method.name}_params`));
}

export function buildTypeValidatorName(
  type: Type | Parameter | Property | ReturnType,
  validatorModule?: string,
): string {
  return prefix(validatorModule, camel(`validate_${buildTypeName(type)}`));
}

export function buildEnumValidatorName(
  e: Enum,
  validatorModule?: string,
): string {
  return prefix(validatorModule, camel(`validate_${e.name}`));
}

export function buildTypeGuardName(
  type: Type,
  validatorModule?: string,
): string {
  return prefix(validatorModule, camel(`is_${type.name}`));
}
