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
    const service = require('basketry/lib/example-ir.json');

    // ACT
    const int = generateTypes(service);
    const validator = new ValidatorFactory(defaultFactories, service).build();

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
