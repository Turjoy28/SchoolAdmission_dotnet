import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '../api/client';
import type { ClassInfo, CreateClassRequest, CreateClassResponse } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';

export const CreateClassPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [totalSeats, setTotalSeats] = useState<number | ''>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Fetch real-time class list for admin dashboard (3s poll)
  const { data: classes, isLoading: isClassesLoading } = useQuery<ClassInfo[]>({
    queryKey: ['classes'],
    queryFn: () => api<ClassInfo[]>('/classes'),
    refetchInterval: 3000,
  });

  // 2. Create class mutation
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

  // 3. Delete class mutation
  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: (classId) =>
      api<void>(`/classes/${classId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setSuccessMessage('Class deleted successfully from the system.');
    },
    onError: (err) => {
      setErrorMessage(err.message);
    },
  });

  const handleDelete = (classId: string, className: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${className}"?\n\nThis will permanently remove the class and all associated student holds from the database.`
      )
    ) {
      setErrorMessage(null);
      setSuccessMessage(null);
      deleteMutation.mutate(classId);
    }
  };

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

  // Dashboard Aggregates
  const totalClasses = classes?.length ?? 0;
  const totalCapacity = classes?.reduce((acc, c) => acc + c.totalSeats, 0) ?? 0;
  const totalHolds = classes?.reduce((acc, c) => acc + c.heldSeats, 0) ?? 0;
  const totalConfirmed = classes?.reduce((acc, c) => acc + c.confirmedSeats, 0) ?? 0;
  const totalAvailable = classes?.reduce((acc, c) => acc + c.availableSeats, 0) ?? 0;

  const filteredClasses = (classes || []).filter((c) =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="page-container">
      {/* Return Navigation */}
      <div className="breadcrumb-bar">
        <Link to="/" className="breadcrumb-link">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Return to Student View
        </Link>
        <div className="breadcrumb-meta">
          <span className="font-mono text-xs">ADMIN CONSOLE</span>
          <span className="role-tag">Role: Registrar Administrator</span>
        </div>
      </div>

      {/* Header Banner */}
      <div className="admin-header-card">
        <div className="admin-header-icon">
          <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
        </div>
        <div className="admin-header-text">
          <div className="flex-row items-center gap-sm">
            <h1 className="section-heading">Registrar Administration Dashboard</h1>
            <span className="admin-badge">Live System Control</span>
          </div>
          <p className="section-desc">
            Manage academic cohorts, allocate seat quotas, and monitor live concurrency holds in real time. Deleting a class frees its database allocations immediately.
          </p>
        </div>
      </div>

      {/* Overview Statistics KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">CONFIGURED CLASSES</span>
            <span className="material-symbols-outlined text-muted text-sm">domain</span>
          </div>
          <div className="kpi-number font-mono">{totalClasses}</div>
          <span className="kpi-subtext">Active cohorts in database</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">TOTAL SEAT CAPACITY</span>
            <span className="material-symbols-outlined text-muted text-sm">meeting_room</span>
          </div>
          <div className="kpi-number font-mono">{totalCapacity}</div>
          <span className="kpi-subtext">Global institution seats</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">ACTIVE TEMPORARY HOLDS</span>
            <span className="material-symbols-outlined text-warning text-sm">hourglass_top</span>
          </div>
          <div className="kpi-number font-mono text-warning">{totalHolds}</div>
          <span className="kpi-subtext">Students in 10-min countdown</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">CONFIRMED ENROLLMENTS</span>
            <span className="material-symbols-outlined text-success text-sm">check_circle</span>
          </div>
          <div className="kpi-number font-mono text-success">{totalConfirmed}</div>
          <span className="kpi-subtext">Paid admissions</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">REMAINING AVAILABLE</span>
            <span className="material-symbols-outlined text-primary text-sm">event_seat</span>
          </div>
          <div className="kpi-number font-mono text-primary font-bold">{totalAvailable}</div>
          <span className="kpi-subtext">Seats open for application</span>
        </div>
      </div>

      <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

      {successMessage && (
        <div className="success-banner animate-fade-in">
          <span className="material-symbols-outlined">check_circle</span>
          <div className="flex-1">
            <strong>Notification: </strong>
            <span>{successMessage}</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setSuccessMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Main Admin Two-Column Layout */}
      <div className="admin-grid-layout">
        {/* Left Column: Create Class Form */}
        <div className="admin-column form-card">
          <div className="form-card-header">
            <div>
              <h2 className="form-title">Create New Cohort</h2>
              <span className="form-subtitle">Add a class with dedicated seat quota</span>
            </div>
            <div className="icon-badge">
              <span className="material-symbols-outlined">add_box</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-body">
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="class-name-input" className="form-label">
                  Class Name <span className="text-error">*</span>
                </label>
                <span className="font-mono text-xs text-muted">{name.length} / 100</span>
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
                1–100 characters. Duplicate class names are supported.
              </span>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="total-seats-input" className="form-label">
                  Total Seats Quota <span className="text-error">*</span>
                </label>
                <span className="font-mono text-xs text-muted">Integer</span>
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
              <span className="field-hint">Quota from 1 to 100,000 seats.</span>
            </div>

            {/* Quick Template Buttons */}
            <div className="quick-templates">
              <span className="text-xs text-muted font-bold">Quick Templates:</span>
              <div className="template-chips">
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => {
                    setName('Class 6 Morning Shift');
                    setTotalSeats(50);
                  }}
                >
                  Class 6 Morning (50)
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => {
                    setName('Class 7 Day Shift');
                    setTotalSeats(40);
                  }}
                >
                  Class 7 Day (40)
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => {
                    setName('Class 9 Science');
                    setTotalSeats(60);
                  }}
                >
                  Class 9 Science (60)
                </button>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined spin-icon">sync</span>
                    Creating Cohort...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">add_circle</span>
                    Create Admission Cohort
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Manage Existing Classes Dashboard */}
        <div className="admin-column form-card">
          <div className="form-card-header">
            <div>
              <h2 className="form-title">Configured Cohorts Ledger</h2>
              <span className="form-subtitle">Monitor allocations and delete outdated cohorts</span>
            </div>
            <div className="search-box-sm">
              <input
                type="text"
                placeholder="Search cohorts..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="search-input-sm"
              />
            </div>
          </div>

          {isClassesLoading ? (
            <div className="loading-state">
              <span className="material-symbols-outlined spin-icon text-2xl">sync</span>
              <span>Loading cohort registry...</span>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="empty-state-box">
              <span className="material-symbols-outlined text-3xl text-muted">domain_disabled</span>
              <p>No admission classes configured yet.</p>
              <span className="text-xs text-muted">Use the form on the left to create your first class.</span>
            </div>
          ) : (
            <div className="admin-classes-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cohort / Name</th>
                    <th>Total</th>
                    <th>Held</th>
                    <th>Confirmed</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.map((cls) => {
                    const occupancy = cls.totalSeats > 0
                      ? Math.round(((cls.heldSeats + cls.confirmedSeats) / cls.totalSeats) * 100)
                      : 0;
                    const isExhausted = cls.availableSeats === 0;

                    return (
                      <tr key={cls.id} className="admin-table-row">
                        <td>
                          <div className="table-class-info">
                            <strong className="table-class-name">{cls.name}</strong>
                            <span className="font-mono text-xs text-muted">
                              {cls.id.slice(0, 8)}...
                            </span>
                          </div>
                        </td>
                        <td className="font-mono font-bold">{cls.totalSeats}</td>
                        <td className="font-mono text-warning">
                          {cls.heldSeats > 0 ? (
                            <span className="badge badge-warning-sm">{cls.heldSeats}</span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="font-mono text-success">
                          {cls.confirmedSeats > 0 ? (
                            <span className="badge badge-success-sm">{cls.confirmedSeats}</span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="font-mono font-bold text-primary">
                          {cls.availableSeats}
                        </td>
                        <td>
                          <div className="table-occupancy-col">
                            <span className="text-xs">{occupancy}%</span>
                            <div className="mini-progress-track">
                              <div
                                className={`mini-progress-fill ${isExhausted ? 'fill-full' : 'fill-primary'}`}
                                style={{ width: `${Math.min(100, occupancy)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-danger-sm"
                            title="Delete this class and free allocations"
                            disabled={deleteMutation.isPending && deleteMutation.variables === cls.id}
                            onClick={() => handleDelete(cls.id, cls.name)}
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
