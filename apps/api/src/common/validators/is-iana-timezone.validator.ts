import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

@ValidatorConstraint({ async: false })
class IsIANATimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && VALID_TIMEZONES.has(value);
  }

  defaultMessage(): string {
    return 'timezone must be a valid IANA timezone string (e.g., "America/New_York")';
  }
}

export function IsIANATimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIANATimezoneConstraint,
    });
  };
}
