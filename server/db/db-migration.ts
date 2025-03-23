import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import {sourcePackageDirectory} from "../config";

// Create db directory if it doesn't exist
const dbDir = path.join(sourcePackageDirectory);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
    console.log('Created db directory');
}

const dbPath = path.join(dbDir, 'tasks.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the tasks database for migration.');
});

// Run migrations in order
const runMigrations = async (): Promise<void> => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create tasks table
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

    // Create an index on message_uuid for faster lookups
    const createMessageUuidIndex = `
        CREATE INDEX IF NOT EXISTS idx_tasks_message_uuid ON tasks(message_uuid)
    `;

    // Create an index on status for quicker filtering
    const createStatusIndex = `
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)
    `;

    // Create an index on type for quicker filtering
    const createTypeIndex = `
        CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type)
    `;

    // Create an index on conversation_id for quicker filtering
    const createConversationIdIndex = `
        CREATE INDEX IF NOT EXISTS idx_tasks_conversation_id ON tasks(conversation_id)
    `;

    // Create an index on acknowledged for quicker filtering
    const createAcknowledgedIndex = `
        CREATE INDEX IF NOT EXISTS idx_tasks_acknowledged ON tasks(acknowledged)
    `;

    // Function to run SQL as a promise
    const runSQL = (sql: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            db.run(sql, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    };

    try {
        // Run migrations in sequence
        console.log('Creating tasks table...');
        await runSQL(createTasksTable);

        console.log('Creating message_uuid index...');
        await runSQL(createMessageUuidIndex);

        console.log('Creating status index...');
        await runSQL(createStatusIndex);

        console.log('Creating type index...');
        await runSQL(createTypeIndex);

        console.log('Creating conversation_id index...');
        await runSQL(createConversationIdIndex);

        console.log('Creating acknowledged index...');
        await runSQL(createAcknowledgedIndex);

        console.log('All migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', (error as Error).message);
    } finally {
        // Close the database connection
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
};

// Run migrations
runMigrations();
