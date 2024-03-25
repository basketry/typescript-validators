import { Generator } from 'basketry';
import { ValidatorFactory } from './validator-factory';
import { SanitizerFactory } from './sanitizer-factory';
import { ConverterFactory } from './date-utils-factory';

export * from './name-factory';
export * from './types';

const generator: Generator = (service, options) => [
  ...new ValidatorFactory(service, options).build(),
  ...new SanitizerFactory(service, options).build(),
  ...new ConverterFactory(service, options).build(),
];

export default generator;
