import { NamespacedTypescriptOptions } from '@basketry/typescript/lib/types';

export declare type TypescriptValidatorsOptions = {
  typesImportPath?: string;
  validatorsOnly?: boolean;
};

export declare type NamespacedTypescriptValidatorsOptions =
  NamespacedTypescriptOptions & {
    typescriptValidators?: TypescriptValidatorsOptions;
  };
