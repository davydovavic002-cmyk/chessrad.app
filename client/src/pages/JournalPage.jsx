import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { apiJson } from '../api';
import BackButton from '../components/BackButton';
import Modal from '../components/Modal';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthContext';
import '../styles/features-game.css';
import '../styles/journal.css';

function monthRange(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = new Date(y, m, 1).toISOString().slice(0, 10);
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { from, to, year: y, month: m };
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function JournalPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [tab, setTab] = useState('entries');
  const [entries, setEntries] = useState([]);
  const [planItems, setPlanItems] = useState([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    id: null,
    lessonDate: new Date().toISOString().slice(0, 10),
    title: '',
    content: '',
    topicsDone: [],
    topicsPlanned: [],
    parentMessage: '',
    parentEmail: '',
    topicInputDone: '',
    topicInputPlanned: '',
  });
  const [planForm, setPlanForm] = useState({ title: '', description: '', planDate: '', status: 'planned' });
  const [templates, setTemplates] = useState([]);
  const [pgnArchive, setPgnArchive] = useState([]);
  const [tplName, setTplName] = useState('');
  const [tplNotes, setTplNotes] = useState('');
  const [weakTopics, setWeakTopics] = useState([]);
  const [parentLinkEmail, setParentLinkEmail] = useState('');

  const range = useMemo(() => monthRange(cursor), [cursor]);

  const loadStudents = useCallback(async () => {
    const { data } = await apiJson('/api/schedule/students');
    setStudents(data.students || []);
    if (!studentId && data.students?.[0]) setStudentId(String(data.students[0].id));
  }, [studentId]);

  const loadEntries = useCallback(async () => {
    if (!studentId) return;
    const { data } = await apiJson(`/api/journal?studentId=${studentId}`);
    setEntries(data.entries || []);
  }, [studentId]);

  const loadPlan = useCallback(async () => {
    if (!studentId) return;
    const { data } = await apiJson(
      `/api/plan?studentId=${studentId}&from=${range.from}&to=${range.to}`
    );
    setPlanItems(data.items || []);
  }, [studentId, range.from, range.to]);

  const loadTemplates = useCallback(async () => {
    const { data } = await apiJson('/api/templates');
    if (data.success) setTemplates(data.items || []);
  }, []);

  const loadPgnArchive = useCallback(async () => {
    const q = studentId ? `?studentId=${studentId}` : '';
    const { data } = await apiJson(`/api/pgn-archive${q}`);
    if (data.success) setPgnArchive(data.items || []);
  }, [studentId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (!studentId) return;
    apiJson(`/api/student/progress?studentId=${studentId}`).then(({ data }) => {
      if (data.success) setWeakTopics(data.weakTopics || data.progress?.topicsPlanned || []);
    });
  }, [studentId]);

  async function linkParent() {
    if (!parentLinkEmail.trim() || !studentId) return;
    const { data } = await apiJson('/api/parent/link', {
      method: 'POST',
      body: JSON.stringify({ studentId: Number(studentId), parentEmail: parentLinkEmail.trim() }),
    });
    if (data.success) {
      Swal.fire({ icon: 'success', title: t('parent_link_ok'), timer: 2000, showConfirmButton: false });
      setParentLinkEmail('');
    }
  }

  useEffect(() => {
    loadEntries();
    loadPlan();
    loadPgnArchive();
  }, [loadEntries, loadPlan, loadPgnArchive]);

  useEffect(() => {
    if (tab === 'templates') loadTemplates();
  }, [tab, loadTemplates]);

  function openNewEntry(dateStr) {
    setForm({
      id: null,
      lessonDate: dateStr || new Date().toISOString().slice(0, 10),
      title: '',
      content: '',
      topicsDone: [],
      topicsPlanned: [],
      parentMessage: '',
      parentEmail: '',
      topicInputDone: '',
      topicInputPlanned: '',
    });
    setEditOpen(true);
  }

  function openEditEntry(entry) {
    setForm({
      id: entry.id,
      lessonDate: entry.lesson_date,
      title: entry.title || '',
      content: entry.content || '',
      topicsDone: entry.topics_done || [],
      topicsPlanned: entry.topics_planned || [],
      parentMessage: entry.parent_message || '',
      parentEmail: entry.parent_email || '',
      topicInputDone: '',
      topicInputPlanned: '',
    });
    setEditOpen(true);
  }

  async function saveEntry() {
    const { data } = await apiJson('/api/journal', {
      method: 'POST',
      body: JSON.stringify({
        id: form.id,
        studentId: Number(studentId),
        lessonDate: form.lessonDate,
        title: form.title,
        content: form.content,
        topicsDone: form.topicsDone,
        topicsPlanned: form.topicsPlanned,
        parentMessage: form.parentMessage,
        parentEmail: form.parentEmail,
      }),
    });
    if (data.success) {
      setEditOpen(false);
      loadEntries();
      Swal.fire({ icon: 'success', title: t('save'), timer: 1200, showConfirmButton: false });
    }
  }

  async function sendToParents(entry) {
    const { data } = await apiJson(`/api/journal/${entry.id}/share`, {
      method: 'POST',
      body: JSON.stringify({ parentEmail: entry.parent_email }),
    });
    if (data.success) {
      if (data.shareUrl) await navigator.clipboard.writeText(data.shareUrl);
      Swal.fire({
        icon: 'success',
        title: t('journal_sent'),
        text: data.emailed ? undefined : t('journal_share_copied'),
      });
      loadEntries();
    }
  }

  async function addPlanItem() {
    if (!planForm.title || !planForm.planDate) return;
    await apiJson('/api/plan', {
      method: 'POST',
      body: JSON.stringify({
        studentId: Number(studentId),
        planDate: planForm.planDate,
        title: planForm.title,
        description: planForm.description,
        status: planForm.status,
      }),
    });
    setPlanForm({ title: '', description: '', planDate: '', status: 'planned' });
    loadPlan();
  }

  async function togglePlanStatus(item) {
    const next = item.status === 'done' ? 'planned' : 'done';
    await apiJson('/api/plan', {
      method: 'POST',
      body: JSON.stringify({
        id: item.id,
        studentId: Number(studentId),
        planDate: item.plan_date,
        title: item.title,
        description: item.description,
        status: next,
      }),
    });
    loadPlan();
  }

  async function sendWeeklyReports() {
    const { data } = await apiJson('/api/journal/weekly-reports', { method: 'POST', body: JSON.stringify({}) });
    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: t('weekly_sent', { n: data.sent || 0 }),
      });
    }
  }

  async function saveTemplate() {
    if (!tplName.trim()) return;
    await apiJson('/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name: tplName.trim(), tabs: [], notes: tplNotes }),
    });
    setTplName('');
    setTplNotes('');
    loadTemplates();
  }

  async function deleteTemplate(id) {
    await apiJson(`/api/templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  }

  const entryDates = new Set(entries.map((e) => e.lesson_date));
  const planDates = new Set(planItems.map((p) => p.plan_date));
  const dim = daysInMonth(range.year, range.month);
  const firstDow = (new Date(range.year, range.month, 1).getDay() + 6) % 7;

  if (user?.role !== 'teacher' && user?.role !== 'admin') {
    return (
      <div className="journal-page page-wrap">
        <BackButton to="/lobby" title={t('back_to_lobby')} />
        <p>{t('admin_denied')}</p>
      </div>
    );
  }

  return (
    <div className="journal-page page-wrap">
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      <header className="game-hud">
        <span className="game-hud__badge">TEACHER HQ</span>
        <h1>{t('journal_title')}</h1>
        <select
          className="form-input journal-select"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.username}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary btn-sm" onClick={sendWeeklyReports}>
          {t('weekly_report_btn')}
        </button>
      </header>

      {weakTopics.length > 0 && (
        <section className="journal-weak-topics game-panel">
          <h3>{t('weak_topics_label')}</h3>
          <ul className="weak-topics-list">
            {weakTopics.map((topic) => (
              <li key={topic}>
                <span>{topic}</span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/puzzle?theme=${encodeURIComponent(topic)}`)}
                >
                  {t('weak_topics_train')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="journal-parent-link">
        <input
          className="form-input"
          placeholder={t('parent_link_email_ph')}
          value={parentLinkEmail}
          onChange={(e) => setParentLinkEmail(e.target.value)}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={linkParent}>
          {t('parent_link_btn')}
        </button>
      </div>

      <div className="journal-tabs">
        <button
          type="button"
          className={tab === 'entries' ? 'active' : ''}
          onClick={() => setTab('entries')}
        >
          {t('journal_entries_tab')}
        </button>
        <button
          type="button"
          className={tab === 'plan' ? 'active' : ''}
          onClick={() => setTab('plan')}
        >
          {t('journal_plan_tab')}
        </button>
        <button
          type="button"
          className={tab === 'templates' ? 'active' : ''}
          onClick={() => setTab('templates')}
        >
          {t('journal_templates_tab')}
        </button>
        <button
          type="button"
          className={tab === 'archive' ? 'active' : ''}
          onClick={() => setTab('archive')}
        >
          {t('pgn_archive_title')}
        </button>
      </div>

      {tab === 'templates' ? (
        <div className="journal-side game-panel" style={{ padding: 16 }}>
          <h3>{t('journal_templates_tab')}</h3>
          <p className="subtitle">{t('templates_hint')}</p>
          <input
            className="form-input"
            placeholder={t('template_name_ph')}
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
          />
          <textarea
            className="form-input mt-2"
            rows={3}
            placeholder={t('template_notes_ph')}
            value={tplNotes}
            onChange={(e) => setTplNotes(e.target.value)}
          />
          <button type="button" className="btn btn-primary btn-sm mt-2" onClick={saveTemplate}>
            {t('template_save')}
          </button>
          <div className="journal-entries-list" style={{ marginTop: 16 }}>
            {templates.length === 0 ? (
              <p className="subtitle">{t('templates_empty')}</p>
            ) : (
              templates.map((tpl) => (
                <div key={tpl.id} className="journal-entry-card">
                  <strong>{tpl.name}</strong>
                  {tpl.notes && <p className="journal-entry-preview">{tpl.notes}</p>}
                  <button type="button" className="btn btn-danger btn-sm mt-1" onClick={() => deleteTemplate(tpl.id)}>
                    {t('delete')}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : tab === 'archive' ? (
        <div className="journal-side game-panel" style={{ padding: 16 }}>
          <h3>{t('pgn_archive_title')}</h3>
          <div className="journal-entries-list">
            {pgnArchive.length === 0 ? (
              <p className="subtitle">{t('pgn_archive_empty')}</p>
            ) : (
              pgnArchive.map((item) => (
                <div key={item.id} className="journal-entry-card">
                  <strong>{item.title || item.lesson_date}</strong>
                  <div className="subtitle">{item.lesson_date}</div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm mt-1"
                    onClick={() => {
                      navigator.clipboard.writeText(item.pgn || '');
                      Swal.fire({ icon: 'success', title: t('study_pgn_copied'), timer: 1200, showConfirmButton: false });
                    }}
                  >
                    {t('study_copy_pgn')}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
      <div className="journal-layout game-panel">
        <div className="journal-calendar">
          <div className="game-panel__head">
            <span className="game-panel__head-icon">📅</span>
            {t('schedule_week')}
          </div>
          <div style={{ padding: '0 16px 16px' }}>
          <div className="journal-cal-nav">
            <button
              type="button"
              onClick={() => setCursor(new Date(range.year, range.month - 1, 1))}
            >
              ‹
            </button>
            <span>
              {cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => setCursor(new Date(range.year, range.month + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="journal-cal-grid">
            {t('days_short').map((d) => (
              <div key={d} className="journal-cal-dow">
                {d}
              </div>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e-${i}`} className="journal-cal-cell empty" />
            ))}
            {Array.from({ length: dim }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${range.year}-${String(range.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasEntry = entryDates.has(dateStr);
              const hasPlan = planDates.has(dateStr);
              return (
                <button
                  key={dateStr}
                  type="button"
                  className={`journal-cal-cell${hasEntry ? ' has-entry' : ''}${hasPlan ? ' has-plan' : ''}`}
                  onClick={() => openNewEntry(dateStr)}
                >
                  <span>{day}</span>
                  <div className="journal-cal-dots">
                    {hasEntry && <i className="dot entry" />}
                    {hasPlan && <i className="dot plan" />}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        </div>

        <div className="journal-side">
          {tab === 'entries' ? (
            <>
              <div className="journal-side-head">
                <h3>{t('journal_entries_tab')}</h3>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openNewEntry()}>
                  {t('journal_new_entry')}
                </button>
              </div>
              <div className="journal-entries-list">
                {entries.length === 0 ? (
                  <p className="subtitle">{t('journal_no_entries')}</p>
                ) : (
                  entries.map((entry) => (
                    <div key={entry.id} className="journal-entry-card">
                      <div className="journal-entry-top">
                        <strong>{entry.lesson_date}</strong>
                        <span>{entry.title}</span>
                      </div>
                      <p className="journal-entry-preview">{entry.content?.slice(0, 120)}</p>
                      {entry.topics_done?.length > 0 && (
                        <div className="journal-tags done">
                          {entry.topics_done.map((topic) => (
                            <span key={topic}>✓ {topic}</span>
                          ))}
                        </div>
                      )}
                      {entry.topics_planned?.length > 0 && (
                        <div className="journal-tags planned">
                          {entry.topics_planned.map((topic) => (
                            <span key={topic}>○ {topic}</span>
                          ))}
                        </div>
                      )}
                      <div className="journal-entry-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditEntry(entry)}>
                          ✎
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => sendToParents(entry)}>
                          {t('journal_send_parents')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <h3>{t('journal_plan_tab')}</h3>
              <div className="journal-plan-form">
                <input
                  className="form-input"
                  type="date"
                  value={planForm.planDate}
                  onChange={(e) => setPlanForm((f) => ({ ...f, planDate: e.target.value }))}
                />
                <input
                  className="form-input mt-1"
                  placeholder={t('journal_entry_title')}
                  value={planForm.title}
                  onChange={(e) => setPlanForm((f) => ({ ...f, title: e.target.value }))}
                />
                <textarea
                  className="form-input mt-1"
                  rows={2}
                  placeholder={t('journal_content')}
                  value={planForm.description}
                  onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
                />
                <button type="button" className="btn btn-primary btn-sm mt-2" onClick={addPlanItem}>
                  {t('journal_plan_add')}
                </button>
              </div>
              <div className="journal-plan-list">
                {planItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`journal-plan-item status-${item.status}`}
                    onClick={() => togglePlanStatus(item)}
                  >
                    <span className="journal-plan-date">{item.plan_date}</span>
                    <strong>{item.title}</strong>
                    <span className="journal-plan-status">
                      {t(`journal_plan_status_${item.status}`)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} dark>
        <h3>{form.id ? t('save') : t('journal_new_entry')}</h3>
        <label className="journal-label">{t('journal_lesson_date')}</label>
        <input
          className="form-input"
          type="date"
          value={form.lessonDate}
          onChange={(e) => setForm((f) => ({ ...f, lessonDate: e.target.value }))}
        />
        <input
          className="form-input mt-2"
          placeholder={t('journal_entry_title')}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          className="form-input mt-2"
          rows={4}
          placeholder={t('journal_content')}
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
        />
        <div className="journal-topic-row mt-2">
          <input
            className="form-input"
            placeholder={t('journal_topics_done')}
            value={form.topicInputDone}
            onChange={(e) => setForm((f) => ({ ...f, topicInputDone: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && form.topicInputDone.trim()) {
                setForm((f) => ({
                  ...f,
                  topicsDone: [...f.topicsDone, f.topicInputDone.trim()],
                  topicInputDone: '',
                }));
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (!form.topicInputDone.trim()) return;
              setForm((f) => ({
                ...f,
                topicsDone: [...f.topicsDone, f.topicInputDone.trim()],
                topicInputDone: '',
              }));
            }}
          >
            +
          </button>
        </div>
        <div className="journal-tags done">
          {form.topicsDone.map((topic, i) => (
            <span key={topic}>
              {topic}{' '}
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, topicsDone: f.topicsDone.filter((_, j) => j !== i) }))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="journal-topic-row mt-2">
          <input
            className="form-input"
            placeholder={t('journal_topics_planned')}
            value={form.topicInputPlanned}
            onChange={(e) => setForm((f) => ({ ...f, topicInputPlanned: e.target.value }))}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (!form.topicInputPlanned.trim()) return;
              setForm((f) => ({
                ...f,
                topicsPlanned: [...f.topicsPlanned, f.topicInputPlanned.trim()],
                topicInputPlanned: '',
              }));
            }}
          >
            +
          </button>
        </div>
        <textarea
          className="form-input mt-2"
          rows={2}
          placeholder={t('journal_parent_msg')}
          value={form.parentMessage}
          onChange={(e) => setForm((f) => ({ ...f, parentMessage: e.target.value }))}
        />
        <input
          className="form-input mt-2"
          placeholder={t('journal_parent_email')}
          value={form.parentEmail}
          onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))}
        />
        <button type="button" className="btn btn-primary btn-block mt-2" onClick={saveEntry}>
          {t('journal_save_entry')}
        </button>
      </Modal>
    </div>
  );
}
