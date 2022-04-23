import { Generator } from 'basketry';
import { defaultFactories, ValidatorFactory } from './validator-factory';

export * from './name-factory';

const generator: Generator = (service) =>
  new ValidatorFactory(defaultFactories).build(service);

export default generator;
