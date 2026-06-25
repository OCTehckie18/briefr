import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { 
  Video, 
  Users, 
  Activity, 
  CheckSquare, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { mockMeetings } from '../../data/mockMeetings';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Filter ready meetings for analytics
  const processedMeetings = mockMeetings.filter(m => m.status === 'Ready');

  // Chart data
  const chartData = processedMeetings.map(m => ({
    name: m.title.substring(0, 10) + '...',
    engagement: m.engagementScore,
    sentiment: m.sentimentScore
  })).reverse();

  // Totals calculations
  const totalMeetings = mockMeetings.length;
  const avgEngagement = Math.round(
    processedMeetings.reduce((acc, curr) => acc + curr.engagementScore, 0) / processedMeetings.length
  );
  
  const totalTasks = processedMeetings.reduce((acc, curr) => acc + curr.actionItems.length, 0);
  const completedTasks = processedMeetings.reduce(
    (acc, curr) => acc + curr.actionItems.filter(item => item.completed).length,
    0
  );
  const taskCompletionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Page Header */}
      <motion.div className="dashboard-header" variants={itemVariants}>
        <h1 className="dashboard-title">Workspace Analytics</h1>
        <p className="dashboard-subtitle">Here is what happened in your meetings this week.</p>
      </motion.div>

      {/* KPI Cards Grid */}
      <motion.div className="kpi-grid" variants={itemVariants}>
        <Card hoverable className="kpi-card">
          <div className="kpi-title">
            <Video size={16} />
            <span>Total Meetings</span>
          </div>
          <div className="kpi-value-container">
            <span className="kpi-value">{totalMeetings}</span>
            <span className="kpi-trend up">
              <ArrowUpRight size={14} style={{ display: 'inline' }} /> +12%
            </span>
          </div>
        </Card>

        <Card hoverable className="kpi-card">
          <div className="kpi-title">
            <Activity size={16} />
            <span>Avg Engagement</span>
          </div>
          <div className="kpi-value-container">
            <span className="kpi-value">{avgEngagement}%</span>
            <span className="kpi-trend up">
              <ArrowUpRight size={14} style={{ display: 'inline' }} /> +4.2%
            </span>
          </div>
        </Card>

        <Card hoverable className="kpi-card">
          <div className="kpi-title">
            <Users size={16} />
            <span>Total Participants</span>
          </div>
          <div className="kpi-value-container">
            <span className="kpi-value">18</span>
            <span className="kpi-trend down">
              <ArrowDownRight size={14} style={{ display: 'inline' }} /> -2%
            </span>
          </div>
        </Card>

        <Card hoverable className="kpi-card">
          <div className="kpi-title">
            <CheckSquare size={16} />
            <span>Action Items Solved</span>
          </div>
          <div className="kpi-value-container">
            <span className="kpi-value">{taskCompletionRate}%</span>
            <span className="kpi-trend up">
              <ArrowUpRight size={14} style={{ display: 'inline' }} /> {completedTasks}/{totalTasks}
            </span>
          </div>
        </Card>
      </motion.div>

      {/* Main Dashboard Section */}
      <motion.div className="dashboard-grid" variants={itemVariants}>
        {/* Trend Area Chart */}
        <Card>
          <CardHeader 
            title="Meeting Performance Trend" 
            subtitle="Overall engagement vs sentiment tracking across recent meetings"
          />
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--info)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--info)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderColor: 'var(--card-border)', 
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--border-radius-md)'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="var(--primary)" 
                  fillOpacity={1} 
                  fill="url(#colorEngagement)" 
                  strokeWidth={2}
                  name="Engagement"
                />
                <Area 
                  type="monotone" 
                  dataKey="sentiment" 
                  stroke="var(--info)" 
                  fillOpacity={1} 
                  fill="url(#colorSentiment)" 
                  strokeWidth={2}
                  name="Sentiment"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Dynamic Sidebar Feature */}
        <Card className="flex-col">
          <CardHeader title="AI Assistant Insights" subtitle="Highlighted action points" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                <Sparkles size={16} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Unresolved Action Items</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  You have {totalTasks - completedTasks} open items. Focus on database optimizations for onboarding scale.
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '8px', borderRadius: '8px' }}>
                <Clock size={16} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Optimal Meeting Duration</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Meetings under 25 minutes yield an average engagement increase of 15%. Focus standups on speed.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Recent Meetings Table */}
      <motion.div className="recent-meetings-section" variants={itemVariants}>
        <Card>
          <CardHeader 
            title="Recent Meeting Records" 
            subtitle="View, search and manage your recorded video meets"
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
      </motion.div>
    </motion.div>
  );
};
