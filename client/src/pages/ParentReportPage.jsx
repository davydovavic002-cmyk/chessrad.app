import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiJson } from '../api';
import { useI18n } from '../i18n/I18nContext';
import '../styles/journal.css';

export default function ParentReportPage() {
  const { token } = useParams();
  const { t } = useI18n();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJson(`/api/journal/public/${token}`)
      .then(({ res, data }) => {
        if (res.ok) setEntry(data.entry);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="journal-page page-wrap"><p>{t('loading')}</p></div>;

  if (!entry) {
    return (
      <div className="journal-page page-wrap" style={{ textAlign: 'center', paddingTop: 80 }}>
        <h1>{t('parent_report_not_found')}</h1>
      </div>
    );
  }

  return (
    <div className="parent-report page-wrap">
      <div className="parent-report-card glass-strong">
        <h1>{t('parent_report_title')}</h1>
        <p>
          <strong>{t('parent_report_student')}:</strong> {entry.student_name}
        </p>
        <p>
          <strong>{t('parent_report_teacher')}:</strong> {entry.teacher_name}
        </p>
        <p>
          <strong>{t('journal_lesson_date')}:</strong> {entry.lesson_date}
        </p>
        {entry.title && <h2>{entry.title}</h2>}
        <div className="parent-report-body">
          {entry.parent_message || entry.content}
        </div>
        {entry.topics_done?.length > 0 && (
          <div>
            <h3>{t('journal_topics_done')}</h3>
            <div className="journal-tags done">
              {entry.topics_done.map((topic) => (
                <span key={topic}>✓ {topic}</span>
              ))}
            </div>
          </div>
        )}
        {entry.topics_planned?.length > 0 && (
          <div>
            <h3>{t('journal_topics_planned')}</h3>
            <div className="journal-tags planned">
              {entry.topics_planned.map((topic) => (
                <span key={topic}>○ {topic}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
