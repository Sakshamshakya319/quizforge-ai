import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, BookOpen, Clock, AlertTriangle, Search, Bell, HelpCircle } from 'lucide-react';

export const Layout = ({ children }) => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="h-5 w-5" /> },
    { name: 'Create Quiz', path: '/upload', icon: <PlusCircle className="h-5 w-5" /> },
    { name: 'My Quizzes', path: '/quizzes', icon: <BookOpen className="h-5 w-5" /> },
    { name: 'Quiz History', path: '/history', icon: <Clock className="h-5 w-5" /> },
    { name: 'Review Errors', path: '/review-errors', icon: <AlertTriangle className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-[260px] bg-card border-r border-border fixed h-full flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/logo-mark.svg" alt="QuizForge AI Logo" className="h-8 w-8" />
            <span className="text-xl font-bold text-foreground tracking-tight">QuizForge <span className="text-primary">AI</span></span>
          </Link>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.name}
                to={item.path} 
                className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-md"></div>}
                <div className={`mr-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {item.icon}
                </div>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Top Navigation */}
        <header className="h-16 bg-card border-b border-border sticky top-0 z-10 flex items-center justify-between px-8">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold text-foreground">
              {location.pathname === '/' ? 'Dashboard' : 
               location.pathname === '/upload' ? 'Create Quiz' : 
               location.pathname === '/quizzes' ? 'My Quizzes' :
               location.pathname === '/history' ? 'Quiz History' :
               location.pathname === '/review-errors' ? 'Review Errors' :
               location.pathname.startsWith('/quiz') ? 'Quiz Player' : 
               location.pathname.startsWith('/results') ? 'Results' : 'QuizForge AI'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link to="/upload" className="flex items-center space-x-1 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
              <PlusCircle className="h-4 w-4" />
              <span>Create Quiz</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
