import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QuizProvider } from './contexts/QuizContext';
import { Layout } from './components/layout/Layout';

import Dashboard from './pages/Dashboard';
import MyQuizzes from './pages/MyQuizzes';
import UploadDocument from './pages/UploadDocument';
import VerifyQuiz from './pages/VerifyQuiz';
import QuizPlayer from './pages/QuizPlayer';
import Results from './pages/Results';
import QuizHistory from './pages/QuizHistory';
import ReviewErrors from './pages/ReviewErrors';

function App() {
  return (
    <QuizProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/quizzes" element={<MyQuizzes />} />
            <Route path="/history" element={<QuizHistory />} />
            <Route path="/review-errors" element={<ReviewErrors />} />
            <Route path="/upload" element={<UploadDocument />} />
            <Route path="/verify" element={<VerifyQuiz />} />
            <Route path="/quiz/:quizId" element={<QuizPlayer />} />
            <Route path="/results/:quizId/:attemptId" element={<Results />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QuizProvider>
  );
}

export default App;
