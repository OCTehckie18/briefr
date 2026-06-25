import React from 'react';
import './Card.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  hoverable = false,
  className = '',
  ...props
}) => {
  const classes = [
    'card',
    padding !== 'none' ? `card-padding-${padding}` : '',
    hoverable ? 'card-hoverable' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  className = ''
}) => {
  return (
    <div className={`card-header ${className}`}>
      <div>
        {typeof title === 'string' ? <h3 className="card-title">{title}</h3> : title}
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="card-action">{action}</div>}
    </div>
  );
};
