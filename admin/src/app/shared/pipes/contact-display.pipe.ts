import { Pipe, PipeTransform } from '@angular/core';
import { maskPhone, maskEmail } from '../../core/utils/security-utils';

@Pipe({
  name: 'phoneDisplay',
  standalone: true,
  pure: true
})
export class PhoneDisplayPipe implements PipeTransform {
  transform(contactNumber: string | string[] | null | undefined): string {
    if (!contactNumber) return '';
    return Array.isArray(contactNumber) ? contactNumber[0] || '' : String(contactNumber);
  }
}

@Pipe({
  name: 'emailDisplay',
  standalone: true,
  pure: true
})
export class EmailDisplayPipe implements PipeTransform {
  transform(email: string | string[] | null | undefined): string {
    if (!email) return '';
    return Array.isArray(email) ? email[0] || '' : String(email);
  }
}

@Pipe({
  name: 'maskPhone',
  standalone: true,
  pure: true
})
export class MaskPhonePipe implements PipeTransform {
  transform(phone: string | null | undefined, isUnmasked: boolean = false): string {
    if (isUnmasked) return phone || '';
    return maskPhone(phone);
  }
}

@Pipe({
  name: 'maskEmail',
  standalone: true,
  pure: true
})
export class MaskEmailPipe implements PipeTransform {
  transform(email: string | null | undefined, isUnmasked: boolean = false): string {
    if (isUnmasked) return email || '';
    return maskEmail(email);
  }
}