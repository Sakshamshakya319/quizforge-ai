import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../contexts/QuizContext';
import { CheckCircle2, AlertTriangle, ArrowRight, Edit3 } from 'lucide-react';

export default function VerifyQuiz() {
  const { currentQuiz, setCurrentQuiz, addQuiz } = useQuiz();
  const navigate = useNavigate();
  
  const [workingQuiz, setWorkingQuiz] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!currentQuiz) {
      navigate('/');
    } else {
      setWorkingQuiz(JSON.parse(JSON.stringify(currentQuiz)));
    }
  }, [currentQuiz, navigate]);

  if (!workingQuiz) return null;

  const handleQuestionEdit = (qId, field, value) => {
    setWorkingQuiz(prev => {
      const copy = { ...prev };
      const qIndex = copy.questions.findIndex(q => q.id === qId);
      if (qIndex !== -1) {
        copy.questions[qIndex][field] = value;
      }
      return copy;
    });
  };

  const saveChanges = async () => {
    setSaveError('');
    const unverifiedCount = workingQuiz.questions.filter(q => q.verificationStatus !== 'verified').length;
    if (unverifiedCount > 0) {
       // Optional: block saving if unverified, but we can let them save
    }

    setIsSaving(true);
    try {
      const savedQuiz = await addQuiz(workingQuiz);
      navigate(`/quiz/${savedQuiz.id}`);
    } catch (err) {
      console.error(err);
      setSaveError(err.message || 'Your quiz could not be saved. Your current question edits have been preserved. Retry saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalQuestions = workingQuiz.questions.length;
  const verifiedCount = workingQuiz.questions.filter(q => q.verificationStatus === 'verified').length;
  const reviewCount = totalQuestions - verifiedCount;
  const completeOptionsCount = workingQuiz.questions.filter(q => q.options.length === 4).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Verify Extracted Assessment</h1>
          <p className="text-muted-foreground mt-1 text-sm">Reviewing structural data extracted from <span className="font-semibold text-foreground">{workingQuiz.sourceFile}</span></p>
          
          <div className="mt-4 bg-secondary/30 border border-border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-muted-foreground mb-1">Questions Found</span>
              <span className="font-bold text-foreground text-lg">{totalQuestions}</span>
            </div>
            <div>
              <span className="block text-muted-foreground mb-1">Complete Options (4)</span>
              <span className="font-bold text-foreground text-lg">{completeOptionsCount}</span>
            </div>
            <div>
              <span className="block text-muted-foreground mb-1">Verified Keys</span>
              <span className="font-bold text-emerald-600 text-lg">{verifiedCount}</span>
            </div>
            <div>
              <span className="block text-muted-foreground mb-1">Needs Review</span>
              <span className={`font-bold text-lg ${reviewCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{reviewCount}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center space-x-3">
            <button 
              onClick={saveChanges}
              disabled={isSaving}
              className={`flex items-center px-4 py-2 font-medium rounded-md transition shadow-sm ${
                isSaving ? 'bg-primary/50 text-white cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {isSaving ? 'Saving...' : 'Finalize & Publish'} <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
          {saveError && (
            <div className="text-sm text-destructive font-medium bg-destructive/10 px-3 py-1.5 rounded-md border border-destructive/20 animate-in fade-in">
              {saveError}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {workingQuiz.questions.map((q, index) => (
          <div key={q.id} className={`bg-card border-[1.5px] rounded-xl overflow-hidden ${
            q.verificationStatus === 'verified' ? 'border-border' : 'border-amber-400/60 shadow-[0_0_0_4px_rgba(251,191,36,0.1)]'
          }`}>
            <div className={`px-6 py-3 border-b flex justify-between items-center ${
              q.verificationStatus === 'verified' ? 'bg-secondary/30 border-border' : 'bg-amber-50/50 border-amber-200/50'
            }`}>
              <div className="flex items-center space-x-2">
                {q.verificationStatus === 'verified' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                <span className={`font-semibold text-sm ${q.verificationStatus === 'verified' ? 'text-foreground' : 'text-amber-800'}`}>
                  Item {index + 1}
                  {q.verificationStatus !== 'verified' && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-bold uppercase">Manual Review Required</span>}
                </span>
              </div>
              <button 
                onClick={() => setEditingId(editingId === q.id ? null : q.id)}
                className="text-muted-foreground hover:text-primary transition flex items-center text-sm font-medium"
              >
                <Edit3 className="h-4 w-4 mr-1.5" />
                {editingId === q.id ? 'Save & Close' : 'Edit Structure'}
              </button>
            </div>
            
            <div className="p-6">
              {editingId === q.id ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">Prompt Statement</label>
                    <textarea 
                      className="w-full border border-border bg-card rounded-md p-3 text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm transition-all shadow-sm"
                      rows={3}
                      value={q.questionText}
                      onChange={(e) => handleQuestionEdit(q.id, 'questionText', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Choices & Correct Key</label>
                    <div className="space-y-2.5">
                      {q.options.map(opt => (
                        <div key={opt.id} className="flex items-center space-x-3">
                          <input 
                            type="radio" 
                            name={`correct-${q.id}`} 
                            checked={q.correctOptionId === opt.id}
                            onChange={() => {
                              handleQuestionEdit(q.id, 'correctOptionId', opt.id);
                              handleQuestionEdit(q.id, 'verificationStatus', 'verified');
                            }}
                            className="h-4 w-4 text-primary focus:ring-primary border-border cursor-pointer"
                          />
                          <span className="font-semibold text-foreground w-6 text-sm">{opt.label}.</span>
                          <input 
                            type="text" 
                            value={opt.text}
                            onChange={(e) => {
                              const newOpts = [...q.options];
                              const optIndex = newOpts.findIndex(o => o.id === opt.id);
                              newOpts[optIndex].text = e.target.value;
                              handleQuestionEdit(q.id, 'options', newOpts);
                            }}
                            className="flex-1 border border-border bg-card rounded-md p-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-foreground mb-4">{q.questionText}</h3>
                  <div className="space-y-2 mb-4">
                    {q.options.map(opt => (
                      <div 
                        key={opt.id} 
                        className={`p-3 rounded-md border text-sm transition-colors ${
                          q.correctOptionId === opt.id 
                            ? 'bg-primary/5 border-primary/30 text-foreground shadow-sm' 
                            : 'bg-card border-border text-muted-foreground'
                        }`}
                      >
                        <span className={`font-semibold mr-2 ${q.correctOptionId === opt.id ? 'text-primary' : ''}`}>{opt.label}.</span>
                        {opt.text}
                        {q.correctOptionId === opt.id && (
                          <span className="ml-3 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase border border-primary/20">
                            Verified Key
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <div className="mt-5 bg-secondary/50 border border-border p-4 rounded-md text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground block mb-1">Extracted Rationale:</span>
                      {q.explanation}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
