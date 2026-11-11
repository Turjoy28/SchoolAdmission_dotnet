import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '../api/client';
import type { CreateClassRequest, CreateClassResponse } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';

export const CreateClassPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [totalSeats, setTotalSeats] = useState<number | ''>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation<CreateClassResponse, ApiError, CreateClassRequest>({
    mutationFn: (newClass) =>
      api<CreateClassResponse>('/classes', {
        method: 'POST',
        body: newClass,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setSuccessMessage(`Class "${data.name}" created successfully with ${data.totalSeats} seats.`);
      setName('');
      setTotalSeats('');
    },
    onError: (err) => {
      setErrorMessage(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setErrorMessage('Class name must be between 1 and 100 characters.');
      return;
    }

    const seatsNum = Number(totalSeats);
    if (!totalSeats || isNaN(seatsNum) || seatsNum < 1 || seatsNum > 100000) {
      setErrorMessage('Total seats must be a whole number between 1 and 100,000.');
      return;
    }

    createMutation.mutate({
      name: trimmedName,
      totalSeats: seatsNum,
    });
  };

  return (
    <div className="page-container">
      {/* Return Navigation */}
      <div className="breadcrumb-bar">
        <Link to="/" className="breadcrumb-link">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Return to Available Classes
        </Link>
        <div className="breadcrumb-meta">
          <span className="font-mono text-xs">POST /classes</span>
          <span className="role-tag">Role: Unrestricted Registrar Admin</span>
        </div>
      </div>

      {/* Header Banner */}
      <div className="admin-header-card">
        <div className="admin-header-icon">
          <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
        </div>
        <div className="admin-header-text">
          <div className="flex-row items-center gap-sm">
            <h1 className="section-heading">Admin Management: Create Admission Class</h1>
            <span className="admin-badge">Open Admin Console</span>
          </div>
          <p className="section-desc">
            Administrative interface for setting up classes and total capacity. Concurrency control and seat allocations are enforced automatically by the server. Duplicate class names are allowed.
          </p>
        </div>
      </div>

      <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

      {successMessage && (
        <div className="success-banner animate-fade-in">
          <span className="material-symbols-outlined">check_circle</span>
          <div className="flex-1">
            <strong>Class Created: </strong>
            <span>{successMessage}</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/')}>
            View in Class List
          </button>
        </div>
      )}

      {/* Form Card */}
      <div className="form-card-container">
        <div className="form-card">
          <div className="form-card-header">
            <div>
              <h2 className="form-title">Class Specification</h2>
              <span className="form-subtitle">Define academic partition and capacity quotas</span>
            </div>
            <div className="icon-badge">
              <span className="material-symbols-outlined">add_box</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-body">
            {/* Class Name Field */}
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="class-name-input" className="form-label">
                  Class Name <span className="text-error">*</span>
                </label>
                <span className="font-mono text-xs text-muted">
                  {name.length} / 100
                </span>
              </div>
              <input
                id="class-name-input"
                type="text"
                maxLength={100}
                placeholder="e.g., Class 6 - Morning Shift"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <span className="field-hint">
                1–100 characters after trimming. Duplicate class names are accepted by the system.
              </span>
            </div>

            {/* Total Seats Field */}
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="total-seats-input" className="form-label">
                  Total Seats <span className="text-error">*</span>
                </label>
                <span className="font-mono text-xs text-muted">Quota Unit</span>
              </div>
              <input
                id="total-seats-input"
                type="number"
                min={1}
                max={100000}
                placeholder="e.g., 50"
                className="form-input font-mono"
                value={totalSeats}
                onChange={(e) => {
                  const val = e.target.value;
                  setTotalSeats(val === '' ? '' : parseInt(val, 10));
                }}
                required
              />
              <span className="field-hint">
                Whole integer between 1 and 100,000 seats.
              </span>
            </div>

            {/* Ledger notice */}
            <div className="ledger-notice-box">
              <span className="material-symbols-outlined text-secondary">shield</span>
              <div className="notice-text">
                <strong>Auto-Managed Ledger:</strong>
                <span>
                  Initial state sets <code className="font-mono">Held = 0</code>, <code className="font-mono">Confirmed = 0</code>, and <code className="font-mono">Available = Total</code>.
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined spin-icon">sync</span>
                    Creating Class...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">add</span>
                    Create Admission Class
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
