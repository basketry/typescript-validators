import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import generateTypes from '@basketry/typescript';
import { defaultFactories, ValidatorFactory } from '../validator-factory';

const pkg = require('../../package.json');
const withVersion = `${pkg.name}@${pkg.version}`;
const withoutVersion = `${pkg.name}@{{version}}`;

const service = require('basketry/lib/example-ir.json');

const snapshotFiles = [
  ...generateTypes(service),
  ...new ValidatorFactory(defaultFactories, service).build(),
];

for (const file of snapshotFiles) {
  const path = file.path.slice(0, file.path.length - 1);
  const filename = file.path[file.path.length - 1];

  const fullpath = [process.cwd(), 'src', 'snapshot', ...path];

  mkdirSync(join(...fullpath), { recursive: true });
  writeFileSync(
    join(...fullpath, filename),
    file.contents.replace(withVersion, withoutVersion),
  );
}
