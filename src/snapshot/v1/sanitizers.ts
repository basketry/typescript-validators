/**
 * This code was generated by @basketry/typescript-validators@{{version}}
 *
 * Changes to this file may cause incorrect behavior and will be lost if
 * the code is regenerated.
 *
 * To make changes to the contents of this file:
 * 1. Edit source/path.ext
 * 2. Run the Basketry CLI
 *
 * About Basketry: https://github.com/basketry/basketry/wiki
 * About @basketry/typescript-validators: https://github.com/basketry/typescript-validators
 */

import * as types from './types';

function stripUndefinedValues<T extends object>(obj: T): T {
  // Strip undefined values.
  return Object.keys(obj).reduce(
    (acc, key) =>
      typeof obj[key] === 'undefined' ? acc : { ...acc, [key]: obj[key] },
    {},
  ) as T;
}

/**
 * Returns a new object that only contains properties defined
 * in the {@link types.CreateWidgetBody|CreateWidgetBody} type definition.
 * Properties with `undefined` values are not included.
 */
export function sanitizeCreateWidgetBody(
  obj: types.CreateWidgetBody,
): types.CreateWidgetBody {
  // Create new object based on type definition.
  const sanitized: types.CreateWidgetBody = {
    name: obj.name,
  };

  return stripUndefinedValues(sanitized);
}

/**
 * Returns a new object that only contains properties defined
 * in the {@link types.ExhaustiveParamsBody|ExhaustiveParamsBody} type definition.
 * Properties with `undefined` values are not included.
 */
export function sanitizeExhaustiveParamsBody(
  obj: types.ExhaustiveParamsBody,
): types.ExhaustiveParamsBody {
  // Create new object based on type definition.
  const sanitized: types.ExhaustiveParamsBody = {
    bar: obj.bar,
    foo: obj.foo,
  };

  return stripUndefinedValues(sanitized);
}

/**
 * Returns a new object that only contains properties defined
 * in the {@link types.Gizmo|Gizmo} type definition.
 * Properties with `undefined` values are not included.
 */
export function sanitizeGizmo(obj: types.Gizmo): types.Gizmo {
  // Create new object based on type definition.
  const sanitized: types.Gizmo = {
    id: obj.id,
    name: obj.name,
    size: obj.size,
  };

  return stripUndefinedValues(sanitized);
}

/**
 * Returns a new object that only contains properties defined
 * in the {@link types.GizmosResponse|GizmosResponse} type definition.
 * Properties with `undefined` values are not included.
 */
export function sanitizeGizmosResponse(
  obj: types.GizmosResponse,
): types.GizmosResponse {
  // Create new object based on type definition.
  const sanitized: types.GizmosResponse = {
    data: obj.data.map(sanitizeGizmo),
  };

  return stripUndefinedValues(sanitized);
}

/**
 * Returns a new object that only contains properties defined
 * in the {@link types.NewWidget|NewWidget} type definition.
 * Properties with `undefined` values are not included.
 */
export function sanitizeNewWidget(obj: types.NewWidget): types.NewWidget {
  // Create new object based on type definition.
  const sanitized: types.NewWidget = {
    buzz: obj.buzz,
    fiz: obj.fiz,
    fizbuzz: obj.fizbuzz,
    foo:
      typeof obj.foo === 'undefined'
        ? undefined
        : sanitizeNewWidgetFoo(obj.foo),
    name: obj.name,
    size: obj.size,
  };

  return stripUndefinedValues(sanitized);
}

/**
 * Returns a new object that only contains properties defined
 * in the {@link types.NewWidgetFoo|NewWidgetFoo} type definition.
 * Properties with `undefined` values are not included.
 */
export function sanitizeNewWidgetFoo(
  obj: types.NewWidgetFoo,
): types.NewWidgetFoo {
  // Create new object based on type definition.
  const sanitized: types.NewWidgetFoo = {
    buzz: obj.buzz,
    fiz: obj.fiz,
  };

  return stripUndefinedValues(sanitized);
}

/**
 * Returns a new object that only contains properties defined
 * in the {@link types.Widget|Widget} type definition.
 * Properties with `undefined` values are not included.
 */
export function sanitizeWidget(obj: types.Widget): types.Widget {
  // Create new object based on type definition.
  const sanitized: types.Widget = {
    buzz: obj.buzz,
    fiz: obj.fiz,
    fizbuzz: obj.fizbuzz,
    foo:
      typeof obj.foo === 'undefined' ? undefined : sanitizeWidgetFoo(obj.foo),
    id: obj.id,
    name: obj.name,
    size: obj.size,
  };

  return stripUndefinedValues(sanitized);
}

/**
 * Returns a new object that only contains properties defined
 * in the {@link types.WidgetFoo|WidgetFoo} type definition.
 * Properties with `undefined` values are not included.
 */
export function sanitizeWidgetFoo(obj: types.WidgetFoo): types.WidgetFoo {
  // Create new object based on type definition.
  const sanitized: types.WidgetFoo = {
    buzz: obj.buzz,
    fiz: obj.fiz,
  };

  return stripUndefinedValues(sanitized);
}

export function sanitizeExampleUnion(
  obj: types.ExampleUnion,
): types.ExampleUnion {
  return stripUndefinedValues(
    [
      sanitizeGizmo(obj as types.Gizmo),
      sanitizeWidget(obj as types.Widget),
    ].reduce((acc, val) => ({ ...acc, ...val }), {}),
  );
}

export function sanitizeCreateGizmoParams(
  params?: types.CreateGizmoParams,
): types.CreateGizmoParams {
  // Create new object based on method parameters.
  const sanitized: types.CreateGizmoParams = {
    size: params?.size,
  };

  return stripUndefinedValues(sanitized);
}

export function sanitizeCreateWidgetParams(
  params?: types.CreateWidgetParams,
): types.CreateWidgetParams {
  // Create new object based on method parameters.
  const sanitized: types.CreateWidgetParams = {
    body:
      typeof params?.body === 'undefined'
        ? undefined
        : sanitizeCreateWidgetBody(params?.body),
  };

  return stripUndefinedValues(sanitized);
}

export function sanitizeDeleteWidgetFooParams(
  params: types.DeleteWidgetFooParams,
): types.DeleteWidgetFooParams {
  // Create new object based on method parameters.
  const sanitized: types.DeleteWidgetFooParams = {
    id: params.id,
  };

  return stripUndefinedValues(sanitized);
}

export function sanitizeExhaustiveFormatsParams(
  params?: types.ExhaustiveFormatsParams,
): types.ExhaustiveFormatsParams {
  // Create new object based on method parameters.
  const sanitized: types.ExhaustiveFormatsParams = {
    integerInt32: params?.integerInt32,
    integerInt64: params?.integerInt64,
    integerNoFormat: params?.integerNoFormat,
    numberDouble: params?.numberDouble,
    numberFloat: params?.numberFloat,
    numberNoFormat: params?.numberNoFormat,
    stringDate: params?.stringDate,
    stringDateTime: params?.stringDateTime,
    stringNoFormat: params?.stringNoFormat,
  };

  return stripUndefinedValues(sanitized);
}

export function sanitizeExhaustiveParamsParams(
  params: types.ExhaustiveParamsParams,
): types.ExhaustiveParamsParams {
  // Create new object based on method parameters.
  const sanitized: types.ExhaustiveParamsParams = {
    body:
      typeof params.body === 'undefined'
        ? undefined
        : sanitizeExhaustiveParamsBody(params.body),
    headerBoolean: params.headerBoolean,
    headerBooleanArray: params.headerBooleanArray,
    headerEnum: params.headerEnum,
    headerEnumArray: params.headerEnumArray,
    headerInteger: params.headerInteger,
    headerIntegerArray: params.headerIntegerArray,
    headerNumber: params.headerNumber,
    headerNumberArray: params.headerNumberArray,
    headerString: params.headerString,
    headerStringArray: params.headerStringArray,
    pathBoolean: params.pathBoolean,
    pathBooleanArray: params.pathBooleanArray,
    pathEnum: params.pathEnum,
    pathEnumArray: params.pathEnumArray,
    pathInteger: params.pathInteger,
    pathIntegerArray: params.pathIntegerArray,
    pathNumber: params.pathNumber,
    pathNumberArray: params.pathNumberArray,
    pathString: params.pathString,
    pathStringArray: params.pathStringArray,
    queryBoolean: params.queryBoolean,
    queryBooleanArray: params.queryBooleanArray,
    queryEnum: params.queryEnum,
    queryEnumArray: params.queryEnumArray,
    queryInteger: params.queryInteger,
    queryIntegerArray: params.queryIntegerArray,
    queryNumber: params.queryNumber,
    queryNumberArray: params.queryNumberArray,
    queryString: params.queryString,
    queryStringArray: params.queryStringArray,
  };

  return stripUndefinedValues(sanitized);
}

export function sanitizeGetGizmosParams(
  params?: types.GetGizmosParams,
): types.GetGizmosParams {
  // Create new object based on method parameters.
  const sanitized: types.GetGizmosParams = {
    search: params?.search,
  };

  return stripUndefinedValues(sanitized);
}

export function sanitizeGetWidgetFooParams(
  params: types.GetWidgetFooParams,
): types.GetWidgetFooParams {
  // Create new object based on method parameters.
  const sanitized: types.GetWidgetFooParams = {
    id: params.id,
  };

  return stripUndefinedValues(sanitized);
}

export function sanitizeUpdateGizmoParams(
  params?: types.UpdateGizmoParams,
): types.UpdateGizmoParams {
  // Create new object based on method parameters.
  const sanitized: types.UpdateGizmoParams = {
    factors: params?.factors,
  };

  return stripUndefinedValues(sanitized);
}
