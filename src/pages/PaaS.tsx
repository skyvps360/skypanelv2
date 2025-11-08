/**
 * PaaS Page
 * Main PaaS page that handles routing for all PaaS features
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PaaSDashboard } from '@/components/paas/PaaSDashboard';
import { ApplicationForm } from '@/components/paas/ApplicationForm';
import { ApplicationDetails } from '@/components/paas/ApplicationDetails';
import { AddOns } from '@/components/paas/AddOns';
import { Billing } from '@/components/paas/Billing';

export const PaaS: React.FC = () => {
  return (
    <div className="container mx-auto py-6">
      <Routes>
        <Route index element={<PaaSDashboard />} />
        <Route path="apps" element={<PaaSDashboard />} />
        <Route path="apps/new" element={<ApplicationForm />} />
        <Route path="apps/:appId" element={<ApplicationDetails />} />
        <Route path="apps/:appId/edit" element={<ApplicationForm />} />
        <Route path="addons" element={<AddOns />} />
        <Route path="billing" element={<Billing />} />
        <Route path="*" element={<Navigate to="/paas" replace />} />
      </Routes>
    </div>
  );
};

export default PaaS;
