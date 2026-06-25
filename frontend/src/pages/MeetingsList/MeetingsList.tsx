import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { mockMeetings } from '../../data/mockMeetings';
import '../Dashboard/Dashboard.css';

export const MeetingsList: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          All Meetings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '4px' }}>
          Manage and access your full meeting archive.
        </p>
      </div>

      <Card>
        <CardHeader 
          title="Meeting Records" 
          subtitle="Click on any ready record to drill down into transcripts and summaries."
        />
        <div className="table-wrapper">
          <table className="meetings-table">
            <thead>
              <tr>
                <th>Meeting Title</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Engagement</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mockMeetings.map((meeting) => (
                <tr key={meeting.id} onClick={() => meeting.status === 'Ready' && navigate(`/meetings/${meeting.id}`)}>
                  <td className="meeting-title-cell">{meeting.title}</td>
                  <td>{meeting.date}</td>
                  <td>{meeting.duration}</td>
                  <td>
                    {meeting.status === 'Ready' ? (
                      <div className="engagement-bar-container">
                        <div className="engagement-bar-track">
                          <div 
                            className="engagement-bar-fill" 
                            style={{ width: `${meeting.engagementScore}%` }}
                          />
                        </div>
                        <span className="engagement-val">{meeting.engagementScore}%</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                    )}
                  </td>
                  <td>
                    <Badge variant={meeting.status === 'Ready' ? 'success' : meeting.status === 'Processing' ? 'warning' : 'danger'}>
                      {meeting.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
