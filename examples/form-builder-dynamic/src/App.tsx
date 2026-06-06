import { useState, useMemo } from 'react';
import { useSnapshot } from 'jotai-state-tree/react';
import { getSnapshot } from 'jotai-state-tree';
import { FormStore, IFormStore } from './store';

export function App() {
  // Initialize form store once
  const store = useMemo(() => {
    return FormStore.create({
      title: 'Customer Feedback Survey',
      rootSection: {
        id: 'root_sec',
        title: 'General Feedback',
        questions: [
          { id: 'q1', type: 'text', label: 'What is your name?', required: true, placeholder: 'Jane Doe' },
          { id: 'q2', type: 'number', label: 'Overall Rating (1-10)', required: true, min: 1, max: 10 },
          { id: 'q3', type: 'choice', label: 'How did you hear about us?', required: false, options: ['Search Engine', 'Friend Reference', 'Social Media'] },
        ],
        subsections: [
          {
            id: 'sub1',
            title: 'Technical Support Quality',
            questions: [
              { id: 'q4', type: 'toggle', label: 'Did the agent resolve your issue?', required: true }
            ],
            subsections: []
          }
        ]
      }
    });
  }, []);

  useSnapshot(store);
  const [optionInputs, setOptionInputs] = useState<Record<string, string>>({});

  return (
    <div className="container-builder">
      <header>
        <h1>Dynamic Form Builder</h1>
        <p className="subtitle">Union types, recursive late-bound models, and validation views</p>
      </header>

      <div className="builder-layout">
        {/* Left: Form Editor */}
        <div>
          <div className="panel">
            <div className="form-group">
              <label>Form Title</label>
              <input
                type="text"
                value={store.title}
                onChange={(e) => store.setTitle(e.target.value)}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Structure Editor</div>
            <SectionEditor
              section={store.rootSection}
              optionInputs={optionInputs}
              setOptionInputs={setOptionInputs}
              path="Root"
            />
          </div>
        </div>

        {/* Right: Preview & Validation */}
        <div>
          {/* Validation Report */}
          <div className="panel">
            <div className="panel-title">Validation Engine</div>
            {store.validationErrors.length > 0 ? (
              <div className="validation-box">
                {store.validationErrors.map((err: string, i: number) => (
                  <div key={i} className="validation-error">
                    <span>⚠️</span> {err}
                  </div>
                ))}
              </div>
            ) : (
              <div className="validation-box" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}>
                ✓ Form schema structure is fully valid.
              </div>
            )}
          </div>

          {/* Render Preview */}
          <div className="panel">
            <div className="panel-title">Live Form Preview</div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>{store.title}</h2>
            <FormPreview section={store.rootSection} />
          </div>

          {/* Snapshot Schema Box */}
          <div className="panel">
            <div className="panel-title">Exported Snapshot Schema</div>
            <div className="json-box">
              {JSON.stringify(getSnapshot(store), null, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Recursive component for editing sections
function SectionEditor({ section, optionInputs, setOptionInputs, path, onRemove }: any) {
  const handleAddQuestion = (type: 'text' | 'number' | 'choice' | 'toggle') => {
    section.addQuestion(type);
  };

  const handleAddSub = () => {
    section.addSubsection('New Sub-section');
  };

  return (
    <div style={{ marginLeft: path === 'Root' ? 0 : '16px', borderLeft: path === 'Root' ? 'none' : '1px solid var(--border-color)', paddingLeft: path === 'Root' ? 0 : '12px' }}>
      <div className="form-group" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            style={{ fontWeight: 600, fontSize: '14px' }}
            value={section.title}
            onChange={(e) => section.setTitle(e.target.value)}
            placeholder="Section Title..."
          />
          {path !== 'Root' && onRemove && (
            <button className="danger" onClick={onRemove} style={{ padding: '6px 8px' }}>
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Edit Questions */}
      {section.questions.map((q: any) => {
        return (
          <div key={q.id} className="question-edit-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="question-number">{q.type} Field</span>
              <button
                className="icon-btn"
                onClick={() => section.removeQuestion(q.id)}
                title="Remove Question"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="form-group">
              <label>Question Label</label>
              <input
                type="text"
                value={q.label}
                onChange={(e) => q.setLabel(e.target.value)}
                placeholder="Question Text..."
              />
            </div>

            <div className="checkbox-group" style={{ marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => q.setRequired(e.target.checked)}
              />
              <label>Field Required</label>
            </div>

            {/* Type-specific inputs */}
            {q.type === 'text' && (
              <div className="form-group">
                <label>Placeholder text</label>
                <input
                  type="text"
                  value={q.placeholder}
                  onChange={(e) => q.setPlaceholder(e.target.value)}
                  placeholder="Helper prompt..."
                />
              </div>
            )}

            {q.type === 'number' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Min value</label>
                  <input
                    type="number"
                    value={q.min ?? ''}
                    onChange={(e) => q.setMin(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Max value</label>
                  <input
                    type="number"
                    value={q.max ?? ''}
                    onChange={(e) => q.setMax(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>
              </div>
            )}

            {q.type === 'choice' && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'block', marginBottom: '4px' }}>Choice Options</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                  {q.options.map((opt: string, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        value={opt}
                        onChange={(e) => q.updateOption(idx, e.target.value)}
                      />
                      <button
                        className="icon-btn"
                        style={{ padding: '2px' }}
                        onClick={() => q.removeOption(idx)}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    placeholder="Add option..."
                    value={optionInputs[q.id] || ''}
                    onChange={(e) => setOptionInputs({ ...optionInputs, [q.id]: e.target.value })}
                  />
                  <button
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => {
                      q.addOption(optionInputs[q.id]);
                      setOptionInputs({ ...optionInputs, [q.id]: '' });
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Edit Subsections */}
      {section.subsections.map((sub: any) => {
        return (
          <div key={sub.id} style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <SectionEditor
              section={sub}
              optionInputs={optionInputs}
              setOptionInputs={setOptionInputs}
              path={`${path} > ${sub.title}`}
              onRemove={() => section.removeSubsection(sub.id)}
            />
          </div>
        );
      })}

      {/* Adding controls */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
        <button onClick={() => handleAddQuestion('text')}>+ Text</button>
        <button onClick={() => handleAddQuestion('number')}>+ Number</button>
        <button onClick={() => handleAddQuestion('choice')}>+ Choice</button>
        <button onClick={() => handleAddQuestion('toggle')}>+ Toggle</button>
        <button onClick={handleAddSub} style={{ marginLeft: 'auto' }}>+ Section</button>
      </div>
    </div>
  );
}

// Recursive preview component
function FormPreview({ section }: any) {
  return (
    <div style={{ borderLeft: '2px solid var(--color-gray-100)', paddingLeft: '14px', marginBottom: '14px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-gray-800)', margin: '0 0 12px 0' }}>{section.title}</h3>
      
      {section.questions.map((q: any) => (
        <div key={q.id} className="form-group" style={{ marginBottom: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {q.label} {q.required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>

          {q.type === 'text' && (
            <input type="text" placeholder={q.placeholder} />
          )}

          {q.type === 'number' && (
            <input type="number" min={q.min ?? undefined} max={q.max ?? undefined} />
          )}

          {q.type === 'choice' && (
            <select>
              <option value="">Select option...</option>
              {q.options.map((opt: string, i: number) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {q.type === 'toggle' && (
            <div className="checkbox-group" style={{ flexDirection: 'row' }}>
              <input type="checkbox" />
              <span>Yes / Confirm</span>
            </div>
          )}
        </div>
      ))}

      {section.subsections.map((sub: any) => (
        <FormPreview key={sub.id} section={sub} />
      ))}
    </div>
  );
}
