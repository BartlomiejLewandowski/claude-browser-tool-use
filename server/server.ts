import {findFirstMatching} from "./tool/registry";
import {taskService} from "./task/task-service"; // Import the task service
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import './tool';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.get('/ping', (req, res) => {
    res.status(200).send({ status: 'ok', message: 'Server is running' });
});

// Endpoint to get unacknowledged tasks for a specific conversation
app.get('/unacknowledged-tasks/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (!conversationId) {
            return res.status(400).send({ error: 'Conversation ID is required' });
        }

        const tasks = await taskService.getUnacknowledgedTasksByConversation(conversationId);
        return res.status(200).send({
            status: 'success',
            tasks
        });
    } catch (err: any) {
        console.error('Error fetching unacknowledged tasks:', err);
        return res.status(500).send({
            status: 'error',
            message: 'Failed to fetch unacknowledged tasks',
            error: err.message
        });
    }
});

// Endpoint to acknowledge a specific task
app.post('/acknowledge-task/:messageUUID', async (req, res) => {
    try {
        const { messageUUID } = req.params;

        if (!messageUUID) {
            return res.status(400).send({ error: 'Message UUID is required' });
        }

        await taskService.acknowledgeTask(messageUUID);
        return res.status(200).send({
            status: 'success',
            message: 'Task acknowledged successfully'
        });
    } catch (err: any) {
        console.error('Error acknowledging task:', err);
        return res.status(500).send({
            status: 'error',
            message: 'Failed to acknowledge task',
            error: err.message
        });
    }
});

// Update the existing processCommon function to include conversationId
async function processCommon(messageUUID: string, conversationId: string, messageContent: string, res: any) {
    console.log('Processing message:', messageUUID);
    const wasProcessed = await taskService.wasAlreadyProcessed(messageUUID);

    if (wasProcessed) {
        console.log('Message was already processed');
        return res.status(200).send({
            status: 'success',
            type: 'already-processed',
            message: 'Message was already processed'
        });
    }
    const tool = findFirstMatching(messageContent);

    if (!tool) {
        console.log('No actionable tags found in message');
        await taskService.markAsNonActionable(messageUUID, conversationId);
        return res.status(200).send({
            status: 'success',
            type: 'unknown',
            message: 'No actionable tags found in message'
        });
    }

    console.log('Found tool:', tool.getTagName());

    try {
        const taskResult = await withTaskService(
            messageUUID,
            conversationId,
            tool.getTagName(),
            () => tool.run(messageContent));

        if (!taskResult) {
            console.log('Failed to process message');
            return res.status(500).send({
                status: 'error',
                message: 'Failed to process message'
            });
        }

        return res.status(200).send({
            status: 'success',
            type: 'tool',
            message: 'Message processed successfully',
            result: taskResult
        });
    } catch (e: any) {
        console.error('Error processing message:', e);
        return res.status(500).send({
            status: 'error',
            message: 'Error processing message',
            error: e.message
        });
    }
}

// Update the withTaskService function to include conversationId
async function withTaskService(messageUUID: string, conversationId: string, jobType: string, job: () => Promise<any>) {
    await taskService.startProcessing(messageUUID, conversationId, jobType);
    try {
        const result = await job();
        await taskService.finishProcessing({ messageUUID, result });
        return result;
    } catch(e) {
        await taskService.finishProcessingError({messageUUID, error: e});
        throw e;
    }
}

// Update the claude-stream endpoint to pass conversationId to processCommon
app.post('/claude-stream', async (req, res) => {
    const data = req.body;

    // Only process complete messages
    if (data.isComplete) {
        // Process the complete message
        console.log('Complete message received:', data.fullText);
        const messageUuid = data.messageUuid;
        const conversationId = data.conversationId;

        return await processCommon(messageUuid, conversationId, data.fullText, res);
    } else {
        return res.status(200).send({
            status: 'success',
            type: 'skip-partial',
            message: 'Message partial'
        });
    }
});

// Update the claude-message endpoint to pass conversationId to processCommon
app.post('/claude-message', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).send({ error: 'No message content provided' });
    }

    console.log('Received message from Claude:', message);
    const jsonMessage = JSON.parse(message);

    // Extract the current leaf message
    const currentLeafMessage = jsonMessage.chat_messages.filter(msg => msg.uuid === jsonMessage.current_leaf_message_uuid);

    if (currentLeafMessage.length === 0 || currentLeafMessage[0].sender !== 'assistant') {
        console.log('Latest message is not from assistant');
        return res.status(200).send({
            status: 'success',
            type: 'non-assistant',
            message: 'Latest message is not from assistant'
        });
    }

    const messageContent = currentLeafMessage[0].content[0].text;
    const messageUUID = currentLeafMessage[0].uuid;
    const conversationId = jsonMessage.uuid; // Extract the conversation ID

    return await processCommon(messageUUID, conversationId, messageContent, res);
});
// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test the server: http://localhost:${PORT}/ping`);
});
