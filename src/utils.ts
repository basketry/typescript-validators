import { Property, Service, Type, getTypeByName } from 'basketry';

export function hasDateConverters(service: Service, types: Type[]): boolean {
  return types.some((type) => needsDateConversion(service, type));
}

export function needsDateConversion(service: Service, type: Type): boolean {
  for (const subtype of traverse(service, type)) {
    for (const property of subtype.properties) {
      if (isDateProperty(property)) return true;
    }
  }
  return false;
}

export function isDateProperty(property: Property): boolean {
  return (
    property.isPrimitive &&
    (property.typeName.value === 'date' ||
      property.typeName.value === 'date-time')
  );
}

function* traverse(service: Service, type: Type): Iterable<Type> {
  yield type;
  for (const prop of type.properties) {
    if (prop.isPrimitive) continue;

    const subtype = getTypeByName(service, prop.typeName.value);
    if (!subtype) continue;

    yield subtype;
    yield* traverse(service, subtype);
  }
}
