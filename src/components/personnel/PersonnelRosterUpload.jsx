import { useState, useRef } from 'react';
import { usePersonnelActions } from '../../hooks/usePersonnel';
import { parsePersonnelCSV, downloadCSVTemplate } from '../../lib/personnelCsvParser';

export default function PersonnelRosterUpload() {
  const { importPersonnel, loading } = usePersonnelActions();
  const [file, setFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      setFile(null);
      setParseResult(null);
      setError(null);
      return;
    }

    // Check file type
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      setFile(null);
      setParseResult(null);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setParseResult(null);
    setImportResult(null);

    // Parse the CSV file
    try {
      const result = await parsePersonnelCSV(selectedFile);
      setParseResult(result);

      if (!result.valid) {
        setError('CSV file contains validation errors. Please fix them and try again.');
      }
    } catch (err) {
      setError(`Failed to parse CSV: ${err.message}`);
      setParseResult(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || !parseResult || !parseResult.valid) return;

    setError(null);
    setImportResult(null);

    try {
      const result = await importPersonnel(parseResult.data);
      setImportResult(result);

      // Clear the form on success
      setFile(null);
      setParseResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    }
  }

  function handleDownloadTemplate() {
    downloadCSVTemplate();
  }

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Import Personnel Roster
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload a CSV file to import or update personnel records
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
          data-testid="download-template-button"
        >
          Download Example CSV
        </button>
      </div>

      {error && (
        <div
          className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"
          data-testid="error-message"
        >
          {error}
        </div>
      )}

      {importResult && (
        <div
          className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm"
          data-testid="success-message"
        >
          <div className="font-medium mb-1">Import successful!</div>
          <div>
            {importResult.recordsProcessed} record(s) imported successfully
            {importResult.recordsFailed > 0 && (
              <span className="text-red-700">
                {' '}
                ({importResult.recordsFailed} failed)
              </span>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="file"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              CSV File
            </label>
            <input
              ref={fileInputRef}
              id="file"
              type="file"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              accept=".csv"
              required
              data-testid="file-input"
            />
            {file && (
              <p className="mt-1 text-sm text-gray-500">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {parseResult && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Validation Results
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Records found:</span>
                  <span
                    className="font-medium text-gray-900"
                    data-testid="records-found"
                  >
                    {parseResult.data.length}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Validation status:</span>
                  <span
                    className={`font-medium ${
                      parseResult.valid ? 'text-green-600' : 'text-red-600'
                    }`}
                    data-testid="validation-status"
                  >
                    {parseResult.valid ? 'Valid' : 'Invalid'}
                  </span>
                </div>

                {parseResult.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="font-medium text-red-700 mb-2">
                      Errors ({parseResult.errors.length}):
                    </div>
                    <ul
                      className="list-disc list-inside space-y-1 text-red-600"
                      data-testid="validation-errors"
                    >
                      {parseResult.errors.slice(0, 10).map((err, idx) => (
                        <li key={idx} className="text-xs">
                          {err}
                        </li>
                      ))}
                      {parseResult.errors.length > 10 && (
                        <li className="text-xs italic">
                          ... and {parseResult.errors.length - 10} more error(s)
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !file || !parseResult || !parseResult.valid}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="import-button"
          >
            {loading ? 'Importing...' : 'Import Personnel'}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-2">
          CSV Format Requirements
        </h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>
            • <strong>Required columns:</strong> RosterID, Email, FirstName, LastName
          </li>
          <li>
            • <strong>Optional columns:</strong> Rank, PhoneNumber, Squad, Flight,
            DetailEligible, Role
          </li>
          <li>
            • <strong>RosterID:</strong> Unique numerical identifier (1, 2, 3, ...)
          </li>
          <li>
            • <strong>DetailEligible:</strong> TRUE or FALSE
          </li>
          <li>
            • <strong>Role:</strong> user, admin, or uniform_admin (defaults to user)
          </li>
          <li>
            • Existing personnel (matched by email) will be updated
          </li>
        </ul>
      </div>
    </div>
  );
}
