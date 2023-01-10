import { Generator } from 'basketry';
import { defaultFactories, ValidatorFactory } from './validator-factory';

export * from './name-factory';

const generator: Generator = (service, options) =>
  new ValidatorFactory(defaultFactories, service, options).build();

export default generator;
