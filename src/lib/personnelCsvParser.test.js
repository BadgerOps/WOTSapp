import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPhoneNumber,
  isValidRosterId,
  isValidRole,
  isValidClassFormat,
  parseBoolean,
  validatePersonnelRecord,
  parsePersonnelCSV,
  generateCSVTemplate,
} from './personnelCsvParser';

describe('personnelCsvParser', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('john.doe@us.af.mil')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate correct phone numbers', () => {
      expect(isValidPhoneNumber('555-0123')).toBe(true);
      expect(isValidPhoneNumber('(555) 555-0123')).toBe(true);
      expect(isValidPhoneNumber('+1-555-555-0123')).toBe(true);
      expect(isValidPhoneNumber('5550123')).toBe(true);
    });

    it('should allow empty phone numbers (optional)', () => {
      expect(isValidPhoneNumber('')).toBe(true);
      expect(isValidPhoneNumber(null)).toBe(true);
      expect(isValidPhoneNumber(undefined)).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhoneNumber('abc')).toBe(false);
      expect(isValidPhoneNumber('123')).toBe(false); // too short
      expect(isValidPhoneNumber('not-a-phone')).toBe(false);
    });
  });

  describe('isValidRosterId', () => {
    it('should validate correct roster IDs', () => {
      expect(isValidRosterId('1')).toBe(true);
      expect(isValidRosterId('42')).toBe(true);
      expect(isValidRosterId('100')).toBe(true);
      expect(isValidRosterId(1)).toBe(true);
      expect(isValidRosterId(42)).toBe(true);
    });

    it('should reject invalid roster IDs', () => {
      expect(isValidRosterId('')).toBe(false);
      expect(isValidRosterId(null)).toBe(false);
      expect(isValidRosterId(undefined)).toBe(false);
      expect(isValidRosterId('0')).toBe(false);
      expect(isValidRosterId('-1')).toBe(false);
      expect(isValidRosterId('abc')).toBe(false);
      expect(isValidRosterId('1.5')).toBe(false);
    });
  });

  describe('isValidClassFormat', () => {
    it('should validate correct class format (NN-NN)', () => {
      expect(isValidClassFormat('26-01')).toBe(true);
      expect(isValidClassFormat('26-03')).toBe(true);
      expect(isValidClassFormat('25-12')).toBe(true);
      expect(isValidClassFormat('00-00')).toBe(true);
    });

    it('should allow empty class (optional)', () => {
      expect(isValidClassFormat('')).toBe(true);
      expect(isValidClassFormat(null)).toBe(true);
      expect(isValidClassFormat(undefined)).toBe(true);
    });

    it('should reject invalid class formats', () => {
      expect(isValidClassFormat('26')).toBe(false);
      expect(isValidClassFormat('2601')).toBe(false);
      expect(isValidClassFormat('26-1')).toBe(false);
      expect(isValidClassFormat('6-01')).toBe(false);
      expect(isValidClassFormat('AB-CD')).toBe(false);
      expect(isValidClassFormat('Alpha')).toBe(false);
    });
  });

  describe('parseBoolean', () => {
    it('should parse true values', () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean('TRUE')).toBe(true);
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('True')).toBe(true);
      expect(parseBoolean('yes')).toBe(true);
      expect(parseBoolean('YES')).toBe(true);
      expect(parseBoolean('1')).toBe(true);
    });

    it('should parse false values', () => {
      expect(parseBoolean(false)).toBe(false);
      expect(parseBoolean('FALSE')).toBe(false);
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('no')).toBe(false);
      expect(parseBoolean('0')).toBe(false);
      expect(parseBoolean('')).toBe(false);
      expect(parseBoolean(null)).toBe(false);
      expect(parseBoolean(undefined)).toBe(false);
    });
  });

  describe('validatePersonnelRecord', () => {
    it('should validate a correct record', () => {
      const record = {
        rosterId: '1',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        rank: 'A1C',
        phoneNumber: '555-0123',
        class: '26-01',
        flight: 'Barrow',
        detailEligible: 'TRUE',
        cqEligible: 'TRUE',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors).toHaveLength(0);
    });

    it('should require roster ID', () => {
      const record = {
        rosterId: '',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors).toContain('Row 2: Roster ID is required');
    });

    it('should validate roster ID format', () => {
      const record = {
        rosterId: 'abc',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors.some(err => err.includes('Roster ID must be a positive number'))).toBe(true);
    });

    it('should require email', () => {
      const record = {
        rosterId: '1',
        email: '',
        firstName: 'John',
        lastName: 'Doe',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors).toContain('Row 2: Email is required');
    });

    it('should validate email format', () => {
      const record = {
        rosterId: '1',
        email: 'not-an-email',
        firstName: 'John',
        lastName: 'Doe',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors.some(err => err.includes('Invalid email format'))).toBe(true);
    });

    it('should require firstName', () => {
      const record = {
        rosterId: '1',
        email: 'john@example.com',
        firstName: '',
        lastName: 'Doe',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors).toContain('Row 2: First name is required');
    });

    it('should require lastName', () => {
      const record = {
        rosterId: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: '',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors).toContain('Row 2: Last name is required');
    });

    it('should not require rank (optional)', () => {
      const record = {
        rosterId: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors).toHaveLength(0);
    });

    it('should validate phone number if provided', () => {
      const record = {
        rosterId: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: 'abc',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors.some(err => err.includes('Invalid phone number'))).toBe(true);
    });

    it('should validate class format if provided', () => {
      const record = {
        rosterId: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        class: 'invalid',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors.some(err => err.includes('Invalid class format'))).toBe(true);
    });

    it('should allow valid roles', () => {
      const record = {
        rosterId: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'admin',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid roles', () => {
      const record = {
        rosterId: '1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'invalid_role',
      };

      const errors = validatePersonnelRecord(record, 2);
      expect(errors.some(err => err.includes('Invalid role'))).toBe(true);
    });
  });

  describe('isValidRole', () => {
    it('should validate correct roles', () => {
      expect(isValidRole('user')).toBe(true);
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('uniform_admin')).toBe(true);
      expect(isValidRole('USER')).toBe(true);
      expect(isValidRole('ADMIN')).toBe(true);
    });

    it('should allow empty role (optional)', () => {
      expect(isValidRole('')).toBe(true);
      expect(isValidRole(null)).toBe(true);
      expect(isValidRole(undefined)).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(isValidRole('superuser')).toBe(false);
      expect(isValidRole('moderator')).toBe(false);
      expect(isValidRole('invalid')).toBe(false);
    });
  });

  describe('parsePersonnelCSV', () => {
    it('should parse valid CSV file', async () => {
      const csvContent = `RosterID,Email,FirstName,LastName,Rank,PhoneNumber,Class,Flight,DetailEligible,CQ_Eligible
1,john.doe@example.com,John,Doe,A1C,555-0123,26-01,Barrow,TRUE,TRUE
2,jane.smith@example.com,Jane,Smith,SrA,555-0124,26-02,Long,TRUE,FALSE`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await parsePersonnelCSV(file);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toHaveLength(2);

      expect(result.data[0]).toMatchObject({
        rosterId: 1,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        rank: 'A1C',
        phoneNumber: '555-0123',
        class: '26-01',
        flight: 'Barrow',
        detailEligible: true,
        cqEligible: true,
      });

      expect(result.data[1]).toMatchObject({
        rosterId: 2,
        email: 'jane.smith@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        rank: 'SrA',
        phoneNumber: '555-0124',
        class: '26-02',
        flight: 'Long',
        detailEligible: true,
        cqEligible: false,
      });
    });

    it('should handle CSV with flexible header names', async () => {
      const csvContent = `roster id,email,first name,last name,rank,phone,class,flight,detail eligible,cq eligible
1,test@example.com,Test,User,AB,555-9999,26-03,Brow,TRUE,FALSE`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await parsePersonnelCSV(file);

      expect(result.valid).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].rosterId).toBe(1);
      expect(result.data[0].email).toBe('test@example.com');
      expect(result.data[0].firstName).toBe('Test');
      expect(result.data[0].lastName).toBe('User');
      expect(result.data[0].class).toBe('26-03');
      expect(result.data[0].cqEligible).toBe(false);
    });

    it('should handle legacy Squad header as Class', async () => {
      const csvContent = `RosterID,Email,FirstName,LastName,Rank,PhoneNumber,Squad,Flight,DetailEligible
1,test@example.com,Test,User,AB,555-9999,26-01,Barrow,TRUE`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await parsePersonnelCSV(file);

      expect(result.valid).toBe(true);
      expect(result.data[0].class).toBe('26-01');
    });

    it('should detect validation errors', async () => {
      const csvContent = `RosterID,Email,FirstName,LastName,Rank,PhoneNumber,Class,Flight,DetailEligible,CQ_Eligible
abc,invalid-email,John,Doe,A1C,555-0123,26-01,Barrow,TRUE,TRUE
2,jane@example.com,Jane,,SrA,555-0124,26-02,Long,TRUE,FALSE`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await parsePersonnelCSV(file);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('Roster ID'))).toBe(true);
      expect(result.errors.some(err => err.includes('Invalid email'))).toBe(true);
      expect(result.errors.some(err => err.includes('Last name is required'))).toBe(true);
    });

    it('should clean and normalize data', async () => {
      const csvContent = `RosterID,Email,FirstName,LastName,Rank,PhoneNumber,Class,Flight,DetailEligible,CQ_Eligible
1,  JOHN.DOE@EXAMPLE.COM  ,  John  ,  Doe  ,  a1c  ,  555-0123  ,  26-01  ,  Barrow  ,TRUE,FALSE`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await parsePersonnelCSV(file);

      expect(result.valid).toBe(true);
      expect(result.data[0].rosterId).toBe(1);
      expect(result.data[0].email).toBe('john.doe@example.com'); // lowercased
      expect(result.data[0].firstName).toBe('John'); // trimmed
      expect(result.data[0].rank).toBe('a1c'); // kept as entered
      expect(result.data[0].class).toBe('26-01'); // trimmed
    });

    it('should handle detailEligible and cqEligible boolean conversion', async () => {
      const csvContent = `RosterID,Email,FirstName,LastName,Rank,PhoneNumber,Class,Flight,DetailEligible,CQ_Eligible
1,test1@example.com,Test,One,A1C,555-0001,26-01,Barrow,TRUE,FALSE
2,test2@example.com,Test,Two,A1C,555-0002,26-01,Long,true,yes
3,test3@example.com,Test,Three,A1C,555-0003,26-01,Brow,FALSE,1`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await parsePersonnelCSV(file);

      expect(result.valid).toBe(true);
      expect(result.data[0].detailEligible).toBe(true);
      expect(result.data[0].cqEligible).toBe(false);
      expect(result.data[1].detailEligible).toBe(true);
      expect(result.data[1].cqEligible).toBe(true);
      expect(result.data[2].detailEligible).toBe(false);
      expect(result.data[2].cqEligible).toBe(true);
    });

    it('should parse role field and default to user', async () => {
      const csvContent = `RosterID,Email,FirstName,LastName,Role
1,test1@example.com,Test,One,admin
2,test2@example.com,Test,Two,uniform_admin
3,test3@example.com,Test,Three,`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await parsePersonnelCSV(file);

      expect(result.valid).toBe(true);
      expect(result.data[0].role).toBe('admin');
      expect(result.data[1].role).toBe('uniform_admin');
      expect(result.data[2].role).toBe('user');
    });

    it('should normalize role to lowercase', async () => {
      const csvContent = `RosterID,Email,FirstName,LastName,Role
1,test1@example.com,Test,One,ADMIN
2,test2@example.com,Test,Two,Admin`;

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const result = await parsePersonnelCSV(file);

      expect(result.valid).toBe(true);
      expect(result.data[0].role).toBe('admin');
      expect(result.data[1].role).toBe('admin');
    });
  });

  describe('generateCSVTemplate', () => {
    it('should generate valid CSV template', () => {
      const template = generateCSVTemplate();

      expect(template).toContain('RosterID,Email,FirstName,LastName,Rank');
      expect(template).toContain('john.doe@example.com');
      expect(template).toContain('jane.smith@example.com');

      // Should have header + 2 example rows
      const lines = template.split('\n');
      expect(lines.length).toBe(3);
    });

    it('should have all required columns', () => {
      const template = generateCSVTemplate();
      const firstLine = template.split('\n')[0];

      expect(firstLine).toContain('RosterID');
      expect(firstLine).toContain('Email');
      expect(firstLine).toContain('FirstName');
      expect(firstLine).toContain('LastName');
      expect(firstLine).toContain('Rank');
      expect(firstLine).toContain('PhoneNumber');
      expect(firstLine).toContain('Class');
      expect(firstLine).toContain('Flight');
      expect(firstLine).toContain('DetailEligible');
      expect(firstLine).toContain('CQ_Eligible');
    });
  });
});
