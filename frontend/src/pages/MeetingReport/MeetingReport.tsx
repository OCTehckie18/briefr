import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  Search, 
  Clock, 
  Video 
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { mockMeetings } from '../../data/mockMeetings';
import type { ActionItem } from '../../data/mockMeetings';
import './MeetingReport.css';

export const MeetingReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Find specific meeting
  const currentMeeting = mockMeetings.find(m => m.id === id);

  if (!currentMeeting) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h2>Meeting not found</h2>
        <button onClick={() => navigate('/')} style={{ marginTop: '16px' }}>Back to Dashboard</button>
      </div>
    );
  }

  // Manage Action Items state locally for interactive checkboxes
  const [actionItems, setActionItems] = useState<ActionItem[]>(currentMeeting.actionItems);
  const [searchText, setSearchText] = useState('');

  const handleToggleAction = (actionId: string) => {
    setActionItems(prev => 
      prev.map(item => item.id === actionId ? { ...item, completed: !item.completed } : item)
    );
  };

  // Helper to highlight search matches in transcript text
  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === search.toLowerCase() 
            ? <mark key={index}>{part}</mark> 
            : part
        )}
      </>
    );
  };

  // Define Speaker coloring map based on mock data colors
  const getSpeakerColor = (speakerName: string) => {
    const speakerData = currentMeeting.talkTime.find(s => s.name === speakerName);
    return speakerData ? speakerData.color : 'var(--text-secondary)';
  };

  // Sub-tabs contents
  const leftTabs = [
    {
      id: 'summary',
      label: 'AI Summary',
      content: (
        <Card>
          <p style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>{currentMeeting.summary}</p>
        </Card>
      )
    },
    {
      id: 'actions',
      label: `Action Items (${actionItems.filter(a => !a.completed).length})`,
      content: (
        <div className="action-items-list">
          {actionItems.length > 0 ? (
            actionItems.map(item => (
              <div key={item.id} className={`action-item-row ${item.completed ? 'completed' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={item.completed} 
                  onChange={() => handleToggleAction(item.id)}
                  className="action-checkbox"
                />
                <div className="action-content">
                  <span className="action-text">{item.text}</span>
                  <div className="action-meta">
                    <span className="action-assignee">Assignee: {item.assignee}</span>
                    <Badge variant={item.completed ? 'success' : 'warning'}>
                      {item.completed ? 'Completed' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No action items specified.</p>
          )}
        </div>
      )
    },
    {
      id: 'questions',
      label: 'Key Questions',
      content: (
        <div className="questions-list">
          {currentMeeting.keyQuestions.length > 0 ? (
            currentMeeting.keyQuestions.map((q, idx) => (
              <div key={idx} className="question-card">
                {q}
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No key questions detected.</p>
          )}
        </div>
      )
    }
  ];

  const rightTabs = [
    {
      id: 'transcript',
      label: 'Transcript',
      content: (
        <Card className="transcript-card" padding="none">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }} className="transcript-header">
            <div className="transcript-search">
              <Search size={16} className="text-muted" />
              <input 
                type="text" 
                placeholder="Search transcript..." 
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {currentMeeting.transcript.length} phrases
            </span>
          </div>

          <div style={{ padding: '20px' }} className="transcript-scroll-area">
            {currentMeeting.transcript.length > 0 ? (
              currentMeeting.transcript.map((seg, index) => (
                <div key={index} className="transcript-segment">
                  <div className="segment-meta">
                    <span className="speaker-badge" style={{ color: getSpeakerColor(seg.speaker) }}>
                      {seg.speaker}
                    </span>
                    <span className="segment-time">{seg.timestamp}</span>
                  </div>
                  <p className="segment-text">
                    {highlightText(seg.text, searchText)}
                  </p>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No transcript data.</p>
            )}
          </div>
        </Card>
      )
    },
    {
      id: 'analytics',
      label: 'Meeting Analytics',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Talk Time Share */}
          <Card>
            <CardHeader title="Speaker Talk-Time" subtitle="Percentage share of vocal activity" />
            <div className="donut-chart-container">
              <div style={{ width: '130px', height: '130px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currentMeeting.talkTime}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="percentage"
                    >
                      {currentMeeting.talkTime.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="donut-legend">
                {currentMeeting.talkTime.map((speaker, index) => (
                  <div key={index} className="legend-item">
                    <div className="legend-left">
                      <div className="legend-color-dot" style={{ backgroundColor: speaker.color }} />
                      <span className="legend-name">{speaker.name}</span>
                    </div>
                    <span className="legend-percent">{speaker.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Sentiment Timeline */}
          <Card>
            <CardHeader title="Engagement Timeline" subtitle="Fluctuations in engagement levels" />
            <div style={{ height: '180px', width: '100%', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentMeeting.engagementTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderColor: 'var(--card-border)', 
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--border-radius-md)'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="engagement" 
                    stroke="var(--primary)" 
                    strokeWidth={2}
                    dot={false}
                    name="Engagement"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sentiment" 
                    stroke="var(--info)" 
                    strokeWidth={2}
                    dot={false}
                    name="Sentiment"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )
    }
  ];

  return (
    <motion.div 
      className="meeting-report"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Back & Breadcrumb */}
      <div className="back-btn-container" onClick={() => navigate('/')}>
        <ChevronLeft size={16} />
        <span>Back to Dashboard</span>
      </div>

      {/* Header */}
      <div className="report-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
            {currentMeeting.title}
          </h1>
          <div className="meeting-meta">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} />
              {currentMeeting.date}
            </span>
            <div className="meta-divider" />
            <span>Duration: {currentMeeting.duration}</span>
            <div className="meta-divider" />
            <span>{currentMeeting.participants} Participants</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Badge variant="success">Analyzed</Badge>
        </div>
      </div>

      {/* Layout Grid */}
      <div className="report-grid">
        {/* Left Column */}
        <div className="left-column">
          {/* Mock Player */}
          <div className="video-player-placeholder">
            <div className="player-overlay">
              <div className="player-icon-container">
                <Video size={28} />
              </div>
              <h3 className="player-title">Meeting Recording</h3>
              <p className="player-subtitle">Video playback integration is currently on hold</p>
            </div>
          </div>

          {/* AI Insights & Actions */}
          <Tabs tabs={leftTabs} defaultTab="summary" />
        </div>

        {/* Right Column */}
        <div className="right-column">
          <Tabs tabs={rightTabs} defaultTab="transcript" />
        </div>
      </div>
    </motion.div>
  );
};
