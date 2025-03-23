import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {sourcePackageDirectory} from "../config";

interface Task {
    id?: number;
    message_uuid: string;
    conversation_id: string;
    status: string;
    type?: string;
    created_at?: string;
    updated_at?: string;
    result?: string;
    error?: string;
    acknowledged: boolean;
}

class TaskService {
    private dbPath: string;
    private db: sqlite3.Database;

    constructor() {
        const dbDir = sourcePackageDirectory;
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir);
        }

        this.dbPath = path.join(dbDir, 'tasks.db');
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to the tasks database.');
                this.initDatabase();
            }
        });
    }

    private initDatabase(): void {
        const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_uuid TEXT UNIQUE NOT NULL,
        conversation_id TEXT NOT NULL,
        status TEXT NOT NULL,
        type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        result TEXT,
        error TEXT,
        acknowledged BOOLEAN DEFAULT FALSE
      )
    `;

        this.db.run(createTasksTable, (err) => {
            if (err) {
                console.error('Error creating tasks table:', err.message);
            } else {
                console.log('Tasks table initialized.');
            }
        });
    }

    public wasAlreadyProcessed(messageUUID: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM tasks WHERE message_uuid = ?';
            this.db.get(query, [messageUUID], (err, row) => {
                if (err) {
                    console.error('Error checking task status:', err.message);
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    public markAsNonActionable(messageUUID: string, conversationId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString();
            const query = `
        INSERT INTO tasks (message_uuid, conversation_id, status, created_at, updated_at, acknowledged)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(message_uuid) DO UPDATE SET
        status = ?,
        conversation_id = ?,
        updated_at = ?,
        acknowledged = ?
      `;
            this.db.run(
                query,
                [messageUUID, conversationId, 'non_actionable', timestamp, timestamp, false,
                    'non_actionable', conversationId, timestamp, false],
                function (err) {
                    if (err) {
                        console.error('Error marking task as non-actionable:', err.message);
                        reject(err);
                    } else {
                        console.log(`Marked task as non-actionable for message ${messageUUID}`);
                        resolve();
                    }
                }
            );
        });
    }

    public startProcessing(messageUUID: string, conversationId: string, jobType: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString();
            const query = `
        INSERT INTO tasks (message_uuid, conversation_id, status, type, created_at, updated_at, acknowledged)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(message_uuid) DO UPDATE SET
        status = ?,
        conversation_id = ?,
        type = ?,
        updated_at = ?,
        acknowledged = ?
      `;
            this.db.run(
                query,
                [messageUUID, conversationId, 'processing', jobType, timestamp, timestamp, false,
                    'processing', conversationId, jobType, timestamp, false],
                function (err) {
                    if (err) {
                        console.error('Error starting task processing:', err.message);
                        reject(err);
                    } else {
                        console.log(`Started processing task for message ${messageUUID}`);
                        resolve();
                    }
                }
            );
        });
    }

    public finishProcessing(payload: { messageUUID: string; result: any }): Promise<void> {
        return new Promise((resolve, reject) => {
            const { messageUUID, result } = payload;
            const timestamp = new Date().toISOString();
            const resultJSON = JSON.stringify(result);

            const query = `
        UPDATE tasks
        SET status = ?,
            result = ?,
            updated_at = ?,
            acknowledged = ?
        WHERE message_uuid = ?
      `;

            this.db.run(
                query,
                ['completed', resultJSON, timestamp, false, messageUUID],
                function (err) {
                    if (err) {
                        console.error('Error completing task:', err.message);
                        reject(err);
                    } else {
                        console.log(`Completed task for message ${messageUUID}`);
                        resolve();
                    }
                }
            );
        });
    }

    public finishProcessingError(payload: { messageUUID: string; error: any }): Promise<void> {
        return new Promise((resolve, reject) => {
            const { messageUUID, error } = payload;
            const timestamp = new Date().toISOString();
            const errorMessage = error instanceof Error ? error.message : String(error);

            const query = `
        UPDATE tasks
        SET status = ?,
            error = ?,
            updated_at = ?,
            acknowledged = ?
        WHERE message_uuid = ?
      `;

            this.db.run(
                query,
                ['error', errorMessage, timestamp, false, messageUUID],
                function (err) {
                    if (err) {
                        console.error('Error updating task error status:', err.message);
                        reject(err);
                    } else {
                        console.log(`Task error recorded for message ${messageUUID}`);
                        resolve();
                    }
                }
            );
        });
    }

    public getTaskStatus(messageUUID: string): Promise<Task | null> {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM tasks WHERE message_uuid = ?';
            this.db.get<any>(query, [messageUUID], (err, row) => {
                if (err) {
                    console.error('Error getting task status:', err.message);
                    reject(err);
                } else {
                    if (row && row.result) {
                        try {
                            row.result = JSON.parse(row.result);
                        } catch (e: any) {
                            console.warn('Failed to parse task result JSON:', e.message);
                        }
                    }
                    if (row) {
                        row.acknowledged = !!row.acknowledged;
                    }
                    resolve(row || null);
                }
            });
        });
    }

    public getAllTasks(filters: { status?: string; type?: string; acknowledged?: boolean; conversation_id?: string } = {}): Promise<Task[]> {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM tasks';
            const params: any[] = [];

            const whereConditions: string[] = [];
            if (filters.status) {
                whereConditions.push('status = ?');
                params.push(filters.status);
            }

            if (filters.type) {
                whereConditions.push('type = ?');
                params.push(filters.type);
            }

            if (filters.acknowledged !== undefined) {
                whereConditions.push('acknowledged = ?');
                params.push(filters.acknowledged ? 1 : 0);
            }

            if (filters.conversation_id) {
                whereConditions.push('conversation_id = ?');
                params.push(filters.conversation_id);
            }

            if (whereConditions.length > 0) {
                query += ' WHERE ' + whereConditions.join(' AND ');
            }

            query += ' ORDER BY created_at DESC';

            this.db.all<any>(query, params, (err, rows) => {
                if (err) {
                    console.error('Error getting tasks:', err.message);
                    reject(err);
                } else {
                    rows.forEach((row) => {
                        if (row.result) {
                            try {
                                row.result = JSON.parse(row.result);
                            } catch (e: any) {
                                console.warn(`Failed to parse result JSON for task ${row.id}:`, e.message);
                            }
                        }
                        // Convert SQLite integer to boolean
                        row.acknowledged = !!row.acknowledged;
                    });
                    resolve(rows);
                }
            });
        });
    }

    public getUnacknowledgedTasksByConversation(conversationId: string): Promise<Task[]> {
        return this.getAllTasks({
            acknowledged: false,
            conversation_id: conversationId,
            status: 'completed'
        });
    }

    public acknowledgeTask(messageUUID: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString();
            const query = `
        UPDATE tasks
        SET acknowledged = ?,
            updated_at = ?
        WHERE message_uuid = ?
      `;

            this.db.run(
                query,
                [true, timestamp, messageUUID],
                function (err) {
                    if (err) {
                        console.error('Error acknowledging task:', err.message);
                        reject(err);
                    } else {
                        console.log(`Task acknowledged for message ${messageUUID}`);
                        resolve();
                    }
                }
            );
        });
    }

    public close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                    reject(err);
                } else {
                    console.log('Database connection closed.');
                    resolve();
                }
            });
        });
    }
}

export const taskService = new TaskService();
