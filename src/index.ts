import { Generator } from 'basketry';
import { ValidatorFactory } from './validator-factory';

export * from './name-factory';

const generator: Generator = (service, options) =>
  new ValidatorFactory(service, options).build();

export default generator;
