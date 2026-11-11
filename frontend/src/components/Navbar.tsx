import React from 'react';
import { NavLink } from 'react-router-dom';

export const Navbar: React.FC = () => {
  return (
    <div className="navbar-container">
      <div className="navbar-brand">
        <div className="brand-logo">
          <span className="material-symbols-outlined">account_balance</span>
        </div>
        <div className="brand-text">
          <span className="portal-title">School Admission Reservation Portal</span>
          <span className="portal-subtitle">
            Institutional Admission Authority — First-Come-First-Served System
          </span>
        </div>
      </div>

      <nav className="nav-links">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : ''}`
          }
        >
          Available Classes
        </NavLink>
        <NavLink
          to="/my-applications"
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : ''}`
          }
        >
          My Applications
        </NavLink>
        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : ''}`
          }
        >
          Admin: Cohorts
        </NavLink>
        <NavLink
          to="/admin/students"
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : ''}`
          }
        >
          Admin: Students & Transfers
        </NavLink>
      </nav>
    </div>
  );
};
