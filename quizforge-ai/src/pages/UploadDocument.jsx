import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, File, AlertCircle, Loader2, FileCheck, Sparkles, Download } from 'lucide-react';
import { parseDocument } from '../utils/documentParser';
import { extractQuestions } from '../utils/questionExtractor';
import { useQuiz } from '../contexts/QuizContext';
import { v4 as uuidv4 } from 'uuid';
import { fetchApi } from '../services/api';

export default function UploadDocument() {
  const [mode, setMode] = useState(null); // 'extract' | 'generate'
  const [file, setFile] = useState(null);
  const [config, setConfig] = useState({
    title: '',
    numQuestions: 5,
    numOptions: 4,
    difficulty: 'Medium',
    topic: ''
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [processingState, setProcessingState] = useState(null); // null, 'reading', 'identifying', 'generating'
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { setCurrentQuiz } = useQuiz();

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleFileSelect = (selectedFile) => {
    setError('');
    const validTypes = ['pdf', 'docx', 'doc', 'pptx', 'ppt'];
    const extension = selectedFile.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(extension)) {
      setError('Unsupported file type. Please upload PDF, DOCX, or PPTX.');
      return;
    }
    
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File is too large. Maximum size is 20MB.');
      return;
    }

    setFile(selectedFile);
    setConfig(prev => ({ ...prev, title: selectedFile.name.replace(/\.[^/.]+$/, "") }));
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const startProcessing = async () => {
    setError('');
    try {
      setProcessingState('reading');
      const text = await parseDocument(file);
      
      if (!text || text.trim().length < 50) {
        throw new Error("We could not extract readable text from this document. Check that its contents are selectable or that the file is not corrupted.");
      }
      
      setProcessingState('identifying');
      
      if (mode === 'extract') {
        const questions = extractQuestions(text);
        if (questions.length === 0) {
          setError("No MCQs found. This document contains learning material but no recognizable existing MCQs. Generate a new quiz from its content or upload a question paper.");
          setProcessingState(null);
          return;
        }
        
        const newQuiz = {
          id: uuidv4(),
          title: config.title,
          sourceFile: file.name,
          createdAt: new Date().toISOString(),
          questions: questions
        };
        setCurrentQuiz(newQuiz);
        navigate('/verify');
        
      } else if (mode === 'generate') {
        setProcessingState('generating');
        
        try {
          const response = await fetchApi('/tutor/generate', {
            method: 'POST',
            body: JSON.stringify({
              content: text,
              num_questions: parseInt(config.numQuestions),
              num_options: parseInt(config.numOptions),
              difficulty: config.difficulty,
              topic: config.topic
            })
          });
          
          if (!response.questions || response.questions.length === 0) {
            throw new Error("The AI failed to generate valid questions. Try reducing the number of requested questions or use a different document.");
          }
          
          const generatedQuestions = response.questions.map(q => {
            const options = q.options.map(opt => ({
              id: uuidv4(),
              label: opt.label,
              text: opt.text
            }));
            
            const correctOpt = options.find(o => o.label === q.correctOptionLabel) || options[0];
            
            return {
              id: uuidv4(),
              originalIdentifier: null,
              questionText: q.questionText,
              options: options,
              correctOptionId: correctOpt.id,
              originalAnswerText: q.correctOptionLabel,
              explanation: q.explanation,
              source: { filename: file.name, pageOrSlide: null },
              verificationStatus: 'needs_review',
              extractionConfidence: 0.5
            };
          });
          
          const newQuiz = {
            id: uuidv4(),
            title: config.title,
            sourceFile: file.name,
            createdAt: new Date().toISOString(),
            questions: generatedQuestions
          };
          setCurrentQuiz(newQuiz);
          navigate('/verify');
          
        } catch (apiErr) {
          throw new Error("The local AI tutor is currently unavailable or failed to process the text. You can retry or use the existing-MCQ extraction workflow. Details: " + apiErr.message);
        }
      }
      
    } catch (err) {
      console.error(err);
      if (err.message.toLowerCase().includes('worker') || err.message.toLowerCase().includes('pdfjs')) {
        setError('The PDF reader could not initialize. Please retry. If the problem continues, check the application configuration.');
      } else {
        setError(err.message || "An unexpected error occurred during processing.");
      }
    } finally {
      setProcessingState(null);
    }
  };

  const downloadTemplate = () => {
    const templateContent = `Question 1: What does HTML stand for?\nA. HyperText Markup Language\nB. HighText Machine Language\nC. HyperTransfer Markup Language\nD. Home Tool Markup Language\nCorrect Answer: A\nExplanation: HTML stands for HyperText Markup Language.\n\nQuestion 2: Which HTML tag is used to create a hyperlink?\nA. <p>\nB. <a>\nC. <img>\nD. <table>\nCorrect Answer: B\nExplanation: The <a> element creates a hyperlink using its href attribute.`;
    
    const blob = new Blob([templateContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'QuizForge_MCQ_Template.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-foreground">Create Your Quiz</h1>
        <p className="mt-2 text-muted-foreground text-lg">Turn your educational documents into interactive multiple-choice quizzes.</p>
      </div>

      {/* Step 1: Mode Selection */}
      {!mode && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Step 1 — Choose how to create the quiz</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <button 
              onClick={() => setMode('extract')}
              className="text-left bg-card border-[1.5px] border-border hover:border-primary/50 hover:shadow-md transition-all rounded-xl p-6 group cursor-pointer flex flex-col items-start"
            >
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <FileCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Extract Existing MCQs</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Your document already contains questions, options, and answer keys. Extract them into a playable quiz.
              </p>
            </button>

            <button 
              onClick={() => setMode('generate')}
              className="text-left bg-card border-[1.5px] border-border hover:border-primary/50 hover:shadow-md transition-all rounded-xl p-6 group cursor-pointer flex flex-col items-start"
            >
              <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Sparkles className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Generate MCQs From Study Material</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Upload lecture slides, class notes, chapters, or learning material to create new practice questions using AI.
              </p>
            </button>
          </div>

          <div className="mt-8 bg-secondary/30 border border-border rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-foreground">Have an existing MCQ question paper? Use our template.</h4>
              <p className="text-sm text-muted-foreground mt-1">Documents with clearly identifiable questions and correct answers work best. We can also generate MCQs without it!</p>
            </div>
            <button 
              onClick={downloadTemplate}
              className="flex items-center whitespace-nowrap bg-white text-foreground border border-border hover:bg-secondary px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download MCQ Template
            </button>
          </div>
        </div>
      )}

      {/* Step 2: File Upload */}
      {mode && !file && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Step 2 — Upload the document</h2>
            <button onClick={() => setMode(null)} className="text-sm text-muted-foreground hover:text-foreground">Change Mode</button>
          </div>
          
          <div 
            className={`relative border-2 border-dashed rounded-xl p-16 text-center transition-all ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              onChange={handleChange}
              accept=".pdf,.doc,.docx,.ppt,.pptx"
            />
            
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4 border border-border shadow-sm">
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Click or drag document here</h3>
              <p className="text-sm text-muted-foreground mt-2 mb-4">Supports PDF, DOCX, and PPTX (Max 20MB)</p>
              
              <div className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium shadow-sm hover:bg-primary/90 transition-colors cursor-pointer">
                Browse Files
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            Note: Scanned PDFs must be OCR-processed to extract text. 
            {mode === 'generate' && " Quiz generation uses your local AI service safely."}
            {mode === 'extract' && " The original document's answer keys are preserved."}
          </p>
        </div>
      )}

      {/* Step 3: Configuration */}
      {mode && file && !processingState && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Step 3 — Configure the quiz</h2>
            <div className="flex space-x-3">
              <button onClick={() => setFile(null)} className="text-sm text-muted-foreground hover:text-foreground">Change File</button>
              <button onClick={() => { setFile(null); setMode(null); }} className="text-sm text-muted-foreground hover:text-foreground">Change Mode</button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center mb-6 p-3 bg-secondary/50 rounded-lg border border-border">
              <File className="h-5 w-5 text-primary mr-3" />
              <div>
                <p className="font-semibold text-sm text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Quiz Title</label>
                <input 
                  type="text" 
                  value={config.title}
                  onChange={(e) => setConfig({...config, title: e.target.value})}
                  className="w-full border border-border bg-background rounded-md p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {mode === 'generate' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Number of Questions</label>
                    <div className="flex space-x-2">
                      <select 
                        value={config.customCount ? 'custom' : config.numQuestions}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setConfig({...config, customCount: true});
                          } else {
                            setConfig({...config, numQuestions: parseInt(e.target.value), customCount: false});
                          }
                        }}
                        className="w-full border border-border bg-background rounded-md p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                      >
                        <option value="5">5 Questions</option>
                        <option value="10">10 Questions</option>
                        <option value="20">20 Questions</option>
                        <option value="30">30 Questions</option>
                        <option value="50">50 Questions</option>
                        <option value="custom">Custom...</option>
                      </select>
                      {config.customCount && (
                        <input 
                          type="number"
                          min="1"
                          max="100"
                          value={config.numQuestions}
                          onChange={(e) => {
                            let val = parseInt(e.target.value) || 1;
                            if (val > 100) val = 100;
                            setConfig({...config, numQuestions: val});
                          }}
                          className="w-20 border border-border bg-background rounded-md p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">Max 100 limit based on model constraints</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Difficulty</label>
                    <select 
                      value={config.difficulty}
                      onChange={(e) => setConfig({...config, difficulty: e.target.value})}
                      className="w-full border border-border bg-background rounded-md p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                      <option value="Mixed">Mixed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Answer Options</label>
                    <select 
                      value={config.numOptions}
                      onChange={(e) => setConfig({...config, numOptions: parseInt(e.target.value)})}
                      className="w-full border border-border bg-background rounded-md p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="3">3 Options (A, B, C)</option>
                      <option value="4">4 Options (A, B, C, D)</option>
                      <option value="5">5 Options (A, B, C, D, E)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Topic Focus (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. HTML forms"
                      value={config.topic}
                      onChange={(e) => setConfig({...config, topic: e.target.value})}
                      className="w-full border border-border bg-background rounded-md p-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={startProcessing}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md font-medium hover:bg-primary/90 transition shadow-sm"
              >
                {mode === 'extract' ? 'Extract Questions' : 'Generate Quiz with AI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {processingState && (
        <div className="mt-12 flex flex-col items-center justify-center p-12 bg-card border border-border rounded-xl shadow-sm animate-in fade-in duration-300">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-6" />
          <h3 className="text-xl font-bold text-foreground">
            {processingState === 'reading' && "Reading Document..."}
            {processingState === 'identifying' && "Extracting content..."}
            {processingState === 'generating' && "AI is generating your quiz..."}
          </h3>
          <p className="text-muted-foreground mt-2 text-center max-w-md">
            {processingState === 'reading' && "Analyzing structural data from your file."}
            {processingState === 'identifying' && mode === 'extract' && "Searching for questions, options, and answer keys."}
            {processingState === 'identifying' && mode === 'generate' && "Preparing study material for the AI tutor."}
            {processingState === 'generating' && "This may take a minute or two depending on your local hardware. Generating meaningful questions..."}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && !processingState && (
        <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-start space-x-3 text-destructive animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm">
              {error.toLowerCase().includes('no mcqs found') ? 'No MCQs Found' : 'Processing Failed'}
            </h4>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <div className="flex flex-col space-y-2">
            <button 
              onClick={() => setError('')} 
              className="text-xs bg-white px-3 py-1.5 rounded border border-destructive/20 hover:bg-destructive/5 transition-colors font-medium text-destructive"
            >
              Retry
            </button>
            {error.toLowerCase().includes('no mcqs found') && (
               <button 
                 onClick={() => { setError(''); setMode('generate'); }} 
                 className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded transition-colors font-medium whitespace-nowrap"
               >
                 Switch to AI Generation
               </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
