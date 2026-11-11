import React from 'react';
import { useStudentId } from '../hooks/useStudentId';

interface StudentIdBarProps {
  studentHook: ReturnType<typeof useStudentId>;
}

export const StudentIdBar: React.FC<StudentIdBarProps> = ({ studentHook }) => {
  const { savedId, inputId, setInputId, save, clear, error, hasValidId } = studentHook;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };

  return (
    <div className="student-bar-wrapper">
      <div className="student-bar-container">
        <div className="student-input-group">
          <label htmlFor="student-brn-input" className="student-label">
            <span className="material-symbols-outlined icon-badge">badge</span>
            Student ID (17-Digit BRN):
          </label>
          <div className="input-field-wrapper">
            <input
              id="student-brn-input"
              type="text"
              inputMode="numeric"
              maxLength={17}
              placeholder="e.g. 20081234567890123"
              className={`student-input font-mono ${error ? 'input-error' : ''}`}
              value={inputId}
              onChange={(e) => setInputId(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            type="button"
            className="btn btn-save"
            onClick={save}
            title="Save Student ID to browser storage"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            Save ID
          </button>
          {savedId && (
            <button
              type="button"
              className="btn btn-clear"
              onClick={clear}
              title="Clear stored Student ID"
            >
              Clear
            </button>
          )}
        </div>

        <div className="student-status-badge">
          {hasValidId ? (
            <div className="status-pill status-pill-active">
              <span className="pulse-dot"></span>
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span>Active ID: </span>
              <strong className="font-mono">{savedId}</strong>
            </div>
          ) : (
            <div className="status-pill status-pill-warning">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>Please enter and save your 17-digit student ID first.</span>
            </div>
          )}
        </div>
      </div>
      {error && <div className="student-error-text">{error}</div>}
    </div>
  );
};
