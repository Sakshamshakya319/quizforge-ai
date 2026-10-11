import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export const createDocument = async (req, res, next) => {
    try {
        const { original_filename, file_type, file_size, total_questions } = req.body;
        
        if (!original_filename || !file_type || file_size === undefined) {
            return res.status(400).json({ error: 'Missing required document fields.' });
        }

        const id = uuidv4();
        const query = `
            INSERT INTO documents (id, user_id, original_filename, file_type, file_size, processing_status, total_questions) 
            VALUES (?, NULL, ?, ?, ?, 'completed', ?)
        `;
        
        await pool.execute(query, [id, original_filename, file_type, file_size, total_questions || 0]);
        
        res.status(201).json({ id, original_filename, processing_status: 'completed', total_questions });
    } catch (err) {
        next(err);
    }
};

export const getDocuments = async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM documents ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

export const getDocument = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute('SELECT * FROM documents WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Document not found.' });
        }
        
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
};

export const updateDocument = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { processing_status, total_questions } = req.body;
        
        const query = 'UPDATE documents SET processing_status = ?, total_questions = ? WHERE id = ?';
        const [result] = await pool.execute(query, [processing_status, total_questions, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Document not found.' });
        }
        
        res.json({ message: 'Document updated successfully.' });
    } catch (err) {
        next(err);
    }
};

export const deleteDocument = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [result] = await pool.execute('DELETE FROM documents WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Document not found.' });
        }
        
        res.json({ message: 'Document deleted successfully.' });
    } catch (err) {
        next(err);
    }
};
