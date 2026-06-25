import React from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

export const Placeholder: React.FC = () => {
  const location = useLocation();
  const pageName = location.pathname.substring(1).toUpperCase() || 'DASHBOARD';

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{pageName} Page</h2>
      <p style={{ color: 'var(--text-secondary)' }}>This page is currently under development as a frontend mockup placeholder.</p>
    </Card>
  );
};
