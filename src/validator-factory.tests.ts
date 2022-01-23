import { readFileSync } from 'fs';
import { join } from 'path';
import generateTypes from '@basketry/typescript';
import { defaultFactories, ValidatorFactory } from './validator-factory';

const pkg = require('../package.json');
const withVersion = `${pkg.name}@${pkg.version}`;
const withoutVersion = `${pkg.name}@{{version}}`;

describe('parser', () => {
  it('recreates a valid snapshot', () => {
    // ARRANGE
    const service = JSON.parse(
      readFileSync(join('src', 'snapshot', 'service.json')).toString(),
    );

    // ACT
    const int = generateTypes(service);
    const validator = new ValidatorFactory(defaultFactories).build(service);

    // ASSERT
    for (const file of [...int, ...validator]) {
      const path = join('src', 'snapshot', ...file.path);
      const snapshot = readFileSync(path)
        .toString()
        .replace(withoutVersion, withVersion);
      expect(file.contents).toStrictEqual(snapshot);
    }
  });
});
