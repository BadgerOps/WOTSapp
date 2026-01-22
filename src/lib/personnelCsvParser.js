import Papa from 'papaparse';

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (flexible - allows various formats)
 */
export function isValidPhoneNumber(phone) {
  if (!phone) return true; // Phone is optional
  // Allow formats like: 555-0123, (555) 555-0123, +1-555-555-0123, 5550123
  const phoneRegex = /^[\d\s\-\(\)\+]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7;
}

/**
 * Validate roster ID (must be a positive integer)
 */
export function isValidRosterId(rosterId) {
  if (!rosterId) return false;
  const num = parseInt(rosterId, 10);
  return !isNaN(num) && num > 0 && num.toString() === rosterId.toString();
}

/**
 * Validate role (must be one of the allowed roles)
 */
export function isValidRole(role) {
  if (!role) return true; // Role is optional, defaults to 'user'
  const validRoles = ['user', 'admin', 'uniform_admin'];
  return validRoles.includes(role.toLowerCase());
}

/**
 * Parse boolean value from various formats
 */
export function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (!value) return false;
  const strValue = String(value).toLowerCase().trim();
  return strValue === 'true' || strValue === 'yes' || strValue === '1';
}

/**
 * Validate class format (NN-NN, e.g., 26-03)
 */
export function isValidClassFormat(classValue) {
  if (!classValue) return true; // Class is optional
  const classRegex = /^\d{2}-\d{2}$/;
  return classRegex.test(classValue.trim());
}

/**
 * Validate a single personnel record
 */
export function validatePersonnelRecord(record, rowNumber) {
  const errors = [];

  // Required fields
  if (!record.rosterId) {
    errors.push(`Row ${rowNumber}: Roster ID is required`);
  } else if (!isValidRosterId(record.rosterId)) {
    errors.push(`Row ${rowNumber}: Roster ID must be a positive number`);
  }

  if (!record.email || record.email.trim() === '') {
    errors.push(`Row ${rowNumber}: Email is required`);
  } else if (!isValidEmail(record.email.trim())) {
    errors.push(`Row ${rowNumber}: Invalid email format`);
  }

  if (!record.firstName || record.firstName.trim() === '') {
    errors.push(`Row ${rowNumber}: First name is required`);
  }

  if (!record.lastName || record.lastName.trim() === '') {
    errors.push(`Row ${rowNumber}: Last name is required`);
  }

  // Optional but validated fields
  if (record.phoneNumber && !isValidPhoneNumber(record.phoneNumber)) {
    errors.push(`Row ${rowNumber}: Invalid phone number format`);
  }

  if (record.class && !isValidClassFormat(record.class)) {
    errors.push(`Row ${rowNumber}: Invalid class format. Must be NN-NN (e.g., 26-03)`);
  }

  if (record.role && !isValidRole(record.role)) {
    errors.push(`Row ${rowNumber}: Invalid role. Must be one of: user, admin, uniform_admin`);
  }

  return errors;
}

/**
 * Parse and validate CSV file for personnel import
 *
 * Expected columns: RosterID, Email, FirstName, LastName, Rank, PhoneNumber, Class, Flight, DetailEligible, CQ_Eligible
 *
 * @param {File} file - The CSV file to parse
 * @returns {Promise<{data: Array, errors: Array, valid: boolean}>}
 */
export function parsePersonnelCSV(file) {
  return new Promise((resolve) => {
    const results = {
      data: [],
      errors: [],
      valid: true,
    };

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Normalize header names (remove spaces, standardize casing)
        const headerMap = {
          'rosterid': 'rosterId',
          'roster id': 'rosterId',
          'roster_id': 'rosterId',
          'id': 'rosterId',
          'email': 'email',
          'firstname': 'firstName',
          'first name': 'firstName',
          'first_name': 'firstName',
          'lastname': 'lastName',
          'last name': 'lastName',
          'last_name': 'lastName',
          'rank': 'rank',
          'phonenumber': 'phoneNumber',
          'phone number': 'phoneNumber',
          'phone_number': 'phoneNumber',
          'phone': 'phoneNumber',
          'class': 'class',
          'squad': 'class', // Legacy support
          'flight': 'flight',
          'detaileligible': 'detailEligible',
          'detail eligible': 'detailEligible',
          'detail_eligible': 'detailEligible',
          'cqeligible': 'cqEligible',
          'cq eligible': 'cqEligible',
          'cq_eligible': 'cqEligible',
          'role': 'role',
        };

        const normalized = header.toLowerCase().trim();
        return headerMap[normalized] || header;
      },
      complete: (parseResults) => {
        if (parseResults.errors.length > 0) {
          results.errors = parseResults.errors.map(err =>
            `Parse error at row ${err.row}: ${err.message}`
          );
          results.valid = false;
          resolve(results);
          return;
        }

        // Validate each record
        parseResults.data.forEach((row, index) => {
          const rowNumber = index + 2; // +2 for 1-based index and header row

          // Validate the record
          const validationErrors = validatePersonnelRecord(row, rowNumber);
          if (validationErrors.length > 0) {
            results.errors.push(...validationErrors);
            results.valid = false;
          } else {
            // Transform and clean the record
            const cleanRecord = {
              rosterId: parseInt(row.rosterId, 10),
              email: row.email.trim().toLowerCase(),
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              rank: row.rank ? row.rank.trim() : '',
              phoneNumber: row.phoneNumber ? row.phoneNumber.trim() : '',
              class: row.class ? row.class.trim() : '',
              flight: row.flight ? row.flight.trim() : '',
              detailEligible: parseBoolean(row.detailEligible),
              cqEligible: parseBoolean(row.cqEligible),
              userId: null, // Will be linked when user signs in
              role: row.role ? row.role.trim().toLowerCase() : 'user', // Default to 'user' role
            };

            results.data.push(cleanRecord);
          }
        });

        resolve(results);
      },
      error: (error) => {
        results.errors.push(`File parsing error: ${error.message}`);
        results.valid = false;
        resolve(results);
      },
    });
  });
}

/**
 * Generate a CSV template for download
 */
export function generateCSVTemplate() {
  const headers = [
    'RosterID',
    'Email',
    'FirstName',
    'LastName',
    'Rank',
    'PhoneNumber',
    'Class',
    'Flight',
    'DetailEligible',
    'CQ_Eligible',
  ];

  const exampleRows = [
    [
      '1',
      'john.doe@example.com',
      'John',
      'Doe',
      'A1C',
      '555-0123',
      '25-001',
      'Alpha',
      'TRUE',
      'TRUE',
    ],
    [
      '2',
      'jane.smith@example.com',
      'Jane',
      'Smith',
      'SrA',
      '555-0124',
      '25-001',
      'Bravo',
      'TRUE',
      'FALSE',
    ],
  ];

  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => row.join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV template
 */
export function downloadCSVTemplate() {
  const csvContent = generateCSVTemplate();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'personnel_roster_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
