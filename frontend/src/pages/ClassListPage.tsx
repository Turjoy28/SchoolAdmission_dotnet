import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '../api/client';
import type { ClassInfo, HoldCreatedResponse } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';

interface ClassListPageProps {
  savedStudentId: string;
}

export const ClassListPage: React.FC<ClassListPageProps> = ({ savedStudentId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterShift, setFilterShift] = useState<'all' | 'morning' | 'day'>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Poll classes every 3 seconds as required by PRD
  const { data: classes, isLoading, error } = useQuery<ClassInfo[]>({
    queryKey: ['classes'],
    queryFn: () => api<ClassInfo[]>('/classes'),
    refetchInterval: 3000,
  });

  // Apply mutation (POST /classes/{classId}/holds)
  const applyMutation = useMutation<
    HoldCreatedResponse,
    ApiError,
    { classId: string; studentId: string }
  >({
    mutationFn: ({ classId, studentId }) =>
      api<HoldCreatedResponse>(`/classes/${classId}/holds`, {
        method: 'POST',
        studentId,
      }),
    onSuccess: (data) => {
      // Invalidate queries so lists refresh immediately
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['my-holds'] });
      // Navigate to hold docket
      navigate(`/holds/${data.holdId}`);
    },
    onError: (err) => {
      setActionError(err.message);
    },
  });

  // Delete mutation (DELETE /classes/{classId})
  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: (classId) =>
      api<void>(`/classes/${classId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (err) => {
      setActionError(err.message);
    },
  });

  const handleDelete = (classId: string, className: string) => {
    if (window.confirm(`Are you sure you want to delete "${className}"? This will also remove any active holds for this class.`)) {
      setActionError(null);
      deleteMutation.mutate(classId);
    }
  };

  const handleApply = (classId: string) => {
    setActionError(null);
    if (!savedStudentId || savedStudentId.length !== 17) {
      setActionError('Please enter and save your 17-digit student ID in the top bar before applying.');
      return;
    }
    applyMutation.mutate({ classId, studentId: savedStudentId });
  };

  const filteredClasses = (classes || []).filter((c) => {
    if (filterShift === 'morning') return c.name.toLowerCase().includes('morning');
    if (filterShift === 'day') return c.name.toLowerCase().includes('day');
    return true;
  });

  return (
    <div className="page-container">
      {/* Information Banner & Health Metric */}
      <div className="protocol-card">
        <div className="protocol-content">
          <div className="protocol-icon-box">
            <span className="material-symbols-outlined">verified_user</span>
          </div>
          <div>
            <div className="protocol-header">
              <h2 className="protocol-title">First-Come, First-Served Real-Time Allocation Protocol</h2>
              <span className="sync-badge">
                <span className="pulse-dot"></span>
                TanStack Query Sync Active (3s poll)
              </span>
            </div>
            <p className="protocol-text">
              Seats are allocated strictly first-come, first-served. Clicking "Apply" secures a temporary 10-minute hold for your verified 17-digit Student ID.
            </p>
          </div>
        </div>
      </div>

      {/* Error Banners */}
      <ErrorBanner
        message={actionError || (error ? (error as Error).message : null)}
        onDismiss={() => setActionError(null)}
      />

      {/* Overview & Filter Strip */}
      <div className="section-header-bar">
        <div>
          <span className="section-badge font-mono">SESSION 2025–2026 • CENTRAL REGISTRAR</span>
          <h1 className="section-heading">Available Class Cohorts</h1>
        </div>

        <div className="filter-pill-group">
          <button
            className={`filter-tab ${filterShift === 'all' ? 'filter-tab-active' : ''}`}
            onClick={() => setFilterShift('all')}
          >
            All Offerings ({classes?.length ?? 0})
          </button>
          <button
            className={`filter-tab ${filterShift === 'morning' ? 'filter-tab-active' : ''}`}
            onClick={() => setFilterShift('morning')}
          >
            Morning Shift
          </button>
          <button
            className={`filter-tab ${filterShift === 'day' ? 'filter-tab-active' : ''}`}
            onClick={() => setFilterShift('day')}
          >
            Day Shift
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="loading-card">
          <span className="material-symbols-outlined spin-icon">sync</span>
          <span>Loading classes from admission ledger...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredClasses.length === 0 && (
        <div className="empty-state-card">
          <span className="material-symbols-outlined empty-icon">school</span>
          <h3>No classes currently available</h3>
          <p>The school administration has not opened admission for any cohorts matching this filter.</p>
          <button className="btn btn-primary" onClick={() => navigate('/admin')}>
            Go to Admin & Create Class
          </button>
        </div>
      )}

      {/* Bento Grid */}
      <div className="classes-grid">
        {filteredClasses.map((cls) => {
          const isFull = cls.availableSeats <= 0;
          const isMorning = cls.name.toLowerCase().includes('morning');
          const isDay = cls.name.toLowerCase().includes('day');
          const shiftLabel = isMorning ? 'Morning Shift' : isDay ? 'Day Shift' : 'General Shift';

          const occupancyPercent =
            cls.totalSeats > 0
              ? Math.min(100, Math.round(((cls.heldSeats + cls.confirmedSeats) / cls.totalSeats) * 100))
              : 0;

          return (
            <div key={cls.id} className="class-card">
              <div className="class-card-header">
                <div>
                  <span className="class-shift-tag">{shiftLabel}</span>
                  <h3 className="class-title">{cls.name}</h3>
                </div>
                <div className={`availability-badge ${isFull ? 'badge-exhausted' : 'badge-available'}`}>
                  {isFull ? 'CAPACITY EXHAUSTED' : `${cls.availableSeats} SEATS LEFT`}
                </div>
              </div>

              {/* Seat Metric Cards */}
              <div className="seat-metrics-row">
                <div className="metric-box">
                  <span className="metric-label">TOTAL SEATS</span>
                  <span className="metric-value font-mono">{cls.totalSeats}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">ACTIVE HOLDS</span>
                  <span className="metric-value font-mono text-warning">{cls.heldSeats}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">CONFIRMED</span>
                  <span className="metric-value font-mono text-success">{cls.confirmedSeats}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">AVAILABLE</span>
                  <span className="metric-value font-mono text-primary font-bold">{cls.availableSeats}</span>
                </div>
              </div>

              {/* Capacity Progress Bar */}
              <div className="capacity-bar-wrapper">
                <div className="capacity-bar-info">
                  <span>Occupancy: {occupancyPercent}%</span>
                  <span>{cls.totalSeats - cls.availableSeats} of {cls.totalSeats} seats allocated</span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${isFull ? 'fill-full' : 'fill-primary'}`}
                    style={{ width: `${occupancyPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Card Footer / Apply & Delete Buttons */}
              <div className="class-card-footer">
                <span className="font-mono text-muted text-xs">ID: {cls.id.slice(0, 8)}...</span>
                <div className="class-card-actions">
                  <button
                    type="button"
                    className="btn btn-danger-outline"
                    title="Delete this class"
                    disabled={deleteMutation.isPending && deleteMutation.variables === cls.id}
                    onClick={() => handleDelete(cls.id, cls.name)}
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Delete
                  </button>
                  <button
                    type="button"
                    className={`btn ${isFull ? 'btn-disabled' : 'btn-primary'}`}
                    disabled={isFull || applyMutation.isPending}
                    onClick={() => handleApply(cls.id)}
                  >
                    {applyMutation.isPending && applyMutation.variables?.classId === cls.id ? (
                      <>
                        <span className="material-symbols-outlined spin-icon text-sm">sync</span>
                        Securing Hold...
                      </>
                    ) : isFull ? (
                      'No Seats Available'
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">how_to_reg</span>
                        Apply for Seat
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
