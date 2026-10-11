import jsPDF from 'jspdf';

export const generateQuizPdf = (questions, includeAnswers = false, includeExplanations = false, title = "Quiz Questions") => {
  const doc = new jsPDF();
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;

  doc.setFontSize(16);
  doc.text(title, margin, yPos);
  yPos += 15;

  doc.setFontSize(12);
  
  questions.forEach((q, index) => {
    // Check page break
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }
    
    // Question Text
    const qText = `${index + 1}. ${q.questionText}`;
    const splitQText = doc.splitTextToSize(qText, maxWidth);
    doc.setFont("helvetica", "bold");
    doc.text(splitQText, margin, yPos);
    yPos += splitQText.length * 7;
    
    // Options
    doc.setFont("helvetica", "normal");
    q.options.forEach(opt => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      const optText = `${opt.label}. ${opt.text}`;
      const splitOptText = doc.splitTextToSize(optText, maxWidth - 10);
      doc.text(splitOptText, margin + 5, yPos);
      yPos += splitOptText.length * 7;
    });
    
    if (includeAnswers) {
      yPos += 3;
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      const correctOpt = q.options.find(o => o.id === q.correctOptionId);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 100, 0); // dark green
      doc.text(`Answer: ${correctOpt ? correctOpt.label : 'Unknown'}`, margin, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 8;
      
      if (includeExplanations && q.explanation) {
        doc.setFont("helvetica", "italic");
        const expText = `Explanation: ${q.explanation}`;
        const splitExpText = doc.splitTextToSize(expText, maxWidth);
        doc.text(splitExpText, margin, yPos);
        yPos += splitExpText.length * 7;
      }
    }
    
    yPos += 8; // spacing before next question
  });
  
  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
};

export const generateReportPdf = (quizData, questions) => {
  const doc = new jsPDF();
  let yPos = 20;
  const margin = 20;

  doc.setFontSize(18);
  doc.text("Quiz Performance Report", margin, yPos);
  yPos += 15;

  doc.setFontSize(14);
  doc.text(`Score: ${quizData.score} / ${quizData.totalQuestions} (${Math.round((quizData.score / quizData.totalQuestions) * 100)}%)`, margin, yPos);
  yPos += 10;
  doc.text(`Time Taken: ${quizData.timeTaken || 'N/A'}`, margin, yPos);
  yPos += 20;

  doc.setFontSize(12);
  
  questions.forEach((q, index) => {
    // Basic implementation for report, similar to generation logic
    const selectedAnswerId = quizData.answers[q.id];
    const isCorrect = selectedAnswerId === q.correctOptionId;
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(isCorrect ? 0 : 200, isCorrect ? 100 : 0, 0);
    doc.text(`Q${index + 1}. [${isCorrect ? 'Correct' : 'Incorrect'}]`, margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 7;
  });

  doc.save("Quiz_Report.pdf");
};
