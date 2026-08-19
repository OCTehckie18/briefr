import React from 'react';
import { ArrowRight, GraduationCap, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import type { ProductTrack } from '../../store/AuthContext';

const tracks: Array<{ id: ProductTrack; title: string; description: string; details: string; icon: typeof GraduationCap }> = [
  { id: 'academic_gd', title: 'Academic GD', description: 'Assess group discussions with clear, evidence-based student reports.', details: 'Participants, rubrics, transcript evidence, and teacher review', icon: GraduationCap },
  { id: 'industry', title: 'Industry Meetings', description: 'Turn team meetings into manager-approved decisions and assigned work.', details: 'Action items, owners, worksheets, and change requests', icon: UsersRound },
];

export const TrackSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectTrack } = useAuth();
  const choose = (selectedTrack: ProductTrack) => {
    selectTrack(selectedTrack);
    navigate(user ? '/' : '/login');
  };

  return (
    <main className="track-selection" aria-labelledby="track-title">
      <section className="track-selection__shell">
        <div className="track-selection__header">
          <div className="brand-mark" aria-hidden="true">B</div>
          <div>
            <p className="eyebrow">Briefr workspace</p>
            <p className="track-selection__signed-in">{user ? `Signed in as ${user.name}` : 'Choose your workspace to continue'}</p>
          </div>
        </div>
        <div className="track-selection__intro-block">
          <h1 id="track-title">What are you working on?</h1>
          <p className="track-selection__intro">Select the experience that matches your work. You can switch workspaces later.</p>
        </div>
        <div className="track-options">
          {tracks.map(({ id, title, description, details, icon: Icon }) => (
            <button key={id} className={`track-option ${id === 'academic_gd' ? 'track-option--academic' : 'track-option--industry'}`} onClick={() => choose(id)}>
              <span className="track-option__topline"><span className="track-option__icon"><Icon size={25} strokeWidth={1.8} /></span><span className="track-option__arrow"><ArrowRight size={19} /></span></span>
              <span className="track-option__copy"><span className="track-option__title">{title}</span><span className="track-option__description">{description}</span><span className="track-option__details">{details}</span></span>
              <span className="track-option__cta">Continue <ArrowRight size={15} /></span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};
