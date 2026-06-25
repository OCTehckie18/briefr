export interface SpeakerTalkTime {
  name: string;
  percentage: number;
  color: string;
}

export interface TranscriptSegment {
  speaker: string;
  timestamp: string;
  text: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee: string;
  completed: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  status: 'Ready' | 'Processing' | 'Failed';
  engagementScore: number;
  sentimentScore: number;
  talkRatio: string;
  participants: number;
  summary: string;
  transcript: TranscriptSegment[];
  actionItems: ActionItem[];
  keyQuestions: string[];
  talkTime: SpeakerTalkTime[];
  engagementTrend: { time: string; engagement: number; sentiment: number }[];
}

export const mockMeetings: Meeting[] = [
  {
    id: '1',
    title: 'Q3 Product Strategy Alignment',
    date: 'June 24, 2026',
    duration: '42m 15s',
    status: 'Ready',
    engagementScore: 84,
    sentimentScore: 78,
    talkRatio: '45% / 55%',
    participants: 5,
    summary: 'The team aligned on the product roadmap for Q3, focusing on scaling user onboarding and reducing sign-up friction. Sarah presented the new designs, which were well-received. Mark raised concerns about database performance during load spikes, which will be addressed in a follow-up technical sync. A tentative release date is set for August 15th.',
    transcript: [
      { speaker: 'John Doe', timestamp: '00:02', text: "Alright, welcome everyone to our Q3 product strategy sync. Today we're aligning on the Q3 roadmap, with a major focus on the onboarding flow." },
      { speaker: 'Sarah Jenkins', timestamp: '01:15', text: "Thanks John. I'll share my screen to show the new onboarding mockups. We reduced the fields from seven to three, which user testing showed could improve conversion by 30%." },
      { speaker: 'Mark Chen', timestamp: '03:45', text: "The flows look really clean, Sarah. My only concern is whether we have the database read optimizations ready for the increased user creation queries. If we scale quickly, we might hit locks on the users table." },
      { speaker: 'Sarah Jenkins', timestamp: '05:10', text: "That's a valid point, Mark. Should we delay the analytics onboarding integration to let your team focus on the DB optimization?" },
      { speaker: 'Mark Chen', timestamp: '05:35', text: "No, I think we can parallelize it. I'll need David to assist with the index configuration though." },
      { speaker: 'David Kim', timestamp: '06:12', text: "Sure, Mark. Let's block out some time tomorrow morning to map out the schema updates." },
      { speaker: 'Emily Watson', timestamp: '07:45', text: "From a marketing perspective, the launch date of August 15th works perfectly. I'll begin drafting the email campaigns based on these mockups." },
      { speaker: 'John Doe', timestamp: '09:00', text: "Great. Let's make sure we have the analytics tracked properly from day one. Sarah, please coordinate with Emily on the metrics we need." }
    ],
    actionItems: [
      { id: 'a1', text: 'Optimize database indices for user creation queries', assignee: 'Mark Chen', completed: false },
      { id: 'a2', text: 'Review onboarding mockups and provide copy suggestions', assignee: 'Emily Watson', completed: true },
      { id: 'a3', text: 'Schedule onboarding analytics tracking design review', assignee: 'Sarah Jenkins', completed: false },
      { id: 'a4', text: 'Setup schema migration scripts for user table updates', assignee: 'David Kim', completed: false }
    ],
    keyQuestions: [
      'Can we parallelize the database optimizations alongside the frontend UI build?',
      'Are there any analytics trackers that could impact page load speed?'
    ],
    talkTime: [
      { name: 'John Doe', percentage: 25, color: 'var(--speaker-1)' },
      { name: 'Sarah Jenkins', percentage: 35, color: 'var(--speaker-2)' },
      { name: 'Mark Chen', percentage: 20, color: 'var(--speaker-3)' },
      { name: 'Emily Watson', percentage: 12, color: 'var(--speaker-4)' },
      { name: 'David Kim', percentage: 8, color: 'var(--speaker-5)' }
    ],
    engagementTrend: [
      { time: '05m', engagement: 72, sentiment: 65 },
      { time: '10m', engagement: 88, sentiment: 75 },
      { time: '15m', engagement: 95, sentiment: 82 },
      { time: '20m', engagement: 78, sentiment: 80 },
      { time: '25m', engagement: 85, sentiment: 85 },
      { time: '30m', engagement: 90, sentiment: 80 },
      { time: '35m', engagement: 82, sentiment: 78 },
      { time: '40m', engagement: 80, sentiment: 75 }
    ]
  },
  {
    id: '2',
    title: 'Weekly Engineering Standup',
    date: 'June 23, 2026',
    duration: '24m 50s',
    status: 'Ready',
    engagementScore: 71,
    sentimentScore: 68,
    talkRatio: '60% / 40%',
    participants: 4,
    summary: 'Regular engineering check-in. The team updated progress on bug fixes for the beta release. David completed the API error boundary middleware, which should prevent backend crashes from unexpected payloads. Mark is still investigating the sporadic memory leak in the parser microservice.',
    transcript: [
      { speaker: 'Mark Chen', timestamp: '00:10', text: "Morning guys. Let's do a quick round. I spent yesterday debugging the parser microservice memory issue. It seems related to unclosed file handles." },
      { speaker: 'David Kim', timestamp: '01:50', text: "I finished the API error boundary changes. It is deployed to staging and ready for testing. Also, user register endpoint got speed improvements." }
    ],
    actionItems: [
      { id: 'b1', text: 'Locate memory leak source in parser service', assignee: 'Mark Chen', completed: false },
      { id: 'b2', text: 'Test API error boundaries on staging environment', assignee: 'David Kim', completed: true }
    ],
    keyQuestions: [
      'Is the memory leak affecting production nodes?'
    ],
    talkTime: [
      { name: 'Mark Chen', percentage: 45, color: 'var(--speaker-3)' },
      { name: 'David Kim', percentage: 35, color: 'var(--speaker-5)' },
      { name: 'John Doe', percentage: 15, color: 'var(--speaker-1)' },
      { name: 'Sarah Jenkins', percentage: 5, color: 'var(--speaker-2)' }
    ],
    engagementTrend: [
      { time: '05m', engagement: 65, sentiment: 60 },
      { time: '10m', engagement: 75, sentiment: 70 },
      { time: '15m', engagement: 70, sentiment: 68 },
      { time: '20m', engagement: 78, sentiment: 72 }
    ]
  },
  {
    id: '3',
    title: 'Client Demo: Onboarding Flow V1',
    date: 'June 21, 2026',
    duration: '18m 05s',
    status: 'Ready',
    engagementScore: 92,
    sentimentScore: 89,
    talkRatio: '30% / 70%',
    participants: 3,
    summary: 'A demo session with Acme Corp highlighting the new onboarding UI. The clients loved the simplicity, and requested a customizable dark mode. Action item is to explore dark mode configurations.',
    transcript: [
      { speaker: 'Sarah Jenkins', timestamp: '00:30', text: "Hello! Today we're showing the Acme team the first look at the interactive onboarding flow." }
    ],
    actionItems: [
      { id: 'c1', text: 'Draft dark mode requirements for client custom theme', assignee: 'Sarah Jenkins', completed: false }
    ],
    keyQuestions: [
      'Can clients inject their custom CSS variables?'
    ],
    talkTime: [
      { name: 'Sarah Jenkins', percentage: 50, color: 'var(--speaker-2)' },
      { name: 'John Doe', percentage: 30, color: 'var(--speaker-1)' },
      { name: 'Client Rep', percentage: 20, color: 'var(--speaker-4)' }
    ],
    engagementTrend: [
      { time: '05m', engagement: 90, sentiment: 85 },
      { time: '10m', engagement: 95, sentiment: 90 },
      { time: '15m', engagement: 92, sentiment: 92 }
    ]
  },
  {
    id: '4',
    title: 'Sprint Planning Sync',
    date: 'June 18, 2026',
    duration: '55m 12s',
    status: 'Processing',
    engagementScore: 0,
    sentimentScore: 0,
    talkRatio: 'N/A',
    participants: 6,
    summary: 'Summary and transcripts are currently generating for this meeting.',
    transcript: [],
    actionItems: [],
    keyQuestions: [],
    talkTime: [],
    engagementTrend: []
  }
];
