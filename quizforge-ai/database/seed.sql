USE quizforge_ai;

-- Optional Seed Data

INSERT INTO documents (id, original_filename, file_type, file_size, processing_status, total_questions) 
VALUES ('doc-seed-1', 'OperatingSystems101.pdf', 'pdf', 1048576, 'completed', 2);

INSERT INTO quizzes (id, document_id, title, description) 
VALUES ('quiz-seed-1', 'doc-seed-1', 'Operating Systems 101 Quiz', 'A basic quiz on OS concepts generated from seed data.');

-- Question 1
INSERT INTO questions (id, quiz_id, question_text, question_order, explanation, verification_status)
VALUES ('q-seed-1', 'quiz-seed-1', 'What is the main purpose of an operating system?', 0, 'An operating system acts as an intermediary between the user of a computer and computer hardware.', 'verified');

INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order)
VALUES 
('opt-1-A', 'q-seed-1', 'A', 'To act as a web browser', 0, 0),
('opt-1-B', 'q-seed-1', 'B', 'To manage computer hardware and software resources', 1, 1),
('opt-1-C', 'q-seed-1', 'C', 'To compile code into machine language', 0, 2),
('opt-1-D', 'q-seed-1', 'D', 'To provide antivirus protection', 0, 3);

-- Question 2
INSERT INTO questions (id, quiz_id, question_text, question_order, explanation, verification_status)
VALUES ('q-seed-2', 'quiz-seed-1', 'Which of the following is not an operating system?', 1, 'Microsoft Office is an application suite, not an operating system.', 'verified');

INSERT INTO question_options (id, question_id, option_label, option_text, is_correct, option_order)
VALUES 
('opt-2-A', 'q-seed-2', 'A', 'Linux', 0, 0),
('opt-2-B', 'q-seed-2', 'B', 'Windows', 0, 1),
('opt-2-C', 'q-seed-2', 'C', 'macOS', 0, 2),
('opt-2-D', 'q-seed-2', 'D', 'Microsoft Office', 1, 3);
