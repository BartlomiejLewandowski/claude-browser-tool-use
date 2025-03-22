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

async function withTaskService(messageUUID: string, jobType: string, job: () => Promise<any>) {
    await taskService.startProcessing(messageUUID, jobType);
    try {
        return await job()
    } catch(e) {
        await taskService.finishProcessingError({messageUUID, error: e});
        throw e;
    }
}

app.post('/claude-message', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).send({ error: 'No message content provided' });
    }
    const example = {
        "uuid": "2e588968-f7a3-4728-bbf0-d417a26b2b15",
        "name": "Create Google Document",
        "summary": "",
        "created_at": "2025-03-05T18:06:10.831417+00:00",
        "updated_at": "2025-03-05T18:13:13.133145+00:00",
        "settings": {
            "preview_feature_uses_artifacts": true
        },
        "is_starred": false,
        "current_leaf_message_uuid": "955e6818-70b6-4f9a-8f47-da8f8a8621a1",
        "chat_messages": [
            {
                "uuid": "5f4f10e1-b69b-430d-b23f-d071d78ff081",
                "text": "",
                "content": [
                    {
                        "start_timestamp": "2025-03-05T17:30:00.991210+00:00",
                        "stop_timestamp": "2025-03-05T17:30:00.991210+00:00",
                        "type": "text",
                        "text": "Can you write a google document for me? I mean create it already in my google account.",
                        "citations": []
                    }
                ],
                "sender": "human",
                "index": 0,
                "created_at": "2025-03-05T18:06:11.694633+00:00",
                "updated_at": "2025-03-05T18:06:11.694633+00:00",
                "truncated": false,
                "attachments": [],
                "files": [],
                "files_v2": [],
                "sync_sources": [],
                "parent_message_uuid": "00000000-0000-4000-8000-000000000000"
            },
            {
                "uuid": "28515082-313a-4c84-b5be-8ca98407aa3e",
                "text": "",
                "content": [
                    {
                        "start_timestamp": "2025-03-05T18:06:12.907781+00:00",
                        "stop_timestamp": "2025-03-05T18:06:15.023304+00:00",
                        "type": "text",
                        "text": " I'm not able to directly create a Google document in your Google account as I don't have access to your Google account or the ability to interact with external services like Google Docs.\n\nHowever, I can help you by:\n\n1. Drafting the content you need for your document\n2. Providing step-by-step instructions on how to create and format the document yourself\n3. Creating a formatted document as an artifact in our conversation that you can then copy into a new Google Doc\n\nIf you let me know what kind of document you need and what content you'd like it to include, I'd be happy to help you prepare it in one of these ways.",
                        "citations": []
                    }
                ],
                "sender": "assistant",
                "index": 1,
                "created_at": "2025-03-05T18:06:15.464874+00:00",
                "updated_at": "2025-03-05T18:06:15.464874+00:00",
                "truncated": false,
                "stop_reason": "stop_sequence",
                "attachments": [],
                "files": [],
                "files_v2": [],
                "sync_sources": [],
                "parent_message_uuid": "5f4f10e1-b69b-430d-b23f-d071d78ff081"
            },
            {
                "uuid": "95e6a54f-3a27-49bd-9a3d-9d9ac468f489",
                "text": "",
                "content": [
                    {
                        "start_timestamp": "2025-03-05T17:31:25.623639+00:00",
                        "stop_timestamp": "2025-03-05T17:31:25.623639+00:00",
                        "type": "text",
                        "text": "hi",
                        "citations": []
                    }
                ],
                "sender": "human",
                "index": 2,
                "created_at": "2025-03-05T18:12:24.421800+00:00",
                "updated_at": "2025-03-05T18:12:24.421800+00:00",
                "truncated": false,
                "attachments": [],
                "files": [],
                "files_v2": [],
                "sync_sources": [],
                "parent_message_uuid": "28515082-313a-4c84-b5be-8ca98407aa3e"
            },
            {
                "uuid": "d3ac5020-ac57-4bc8-9ce0-cb69156717e9",
                "text": "",
                "content": [
                    {
                        "start_timestamp": "2025-03-05T18:12:25.407786+00:00",
                        "stop_timestamp": "2025-03-05T18:12:25.997282+00:00",
                        "type": "text",
                        "text": " Hello! How can I help you today? I'm here to assist with any questions, tasks, or information you might need. Just let me know what's on your mind.",
                        "citations": []
                    }
                ],
                "sender": "assistant",
                "index": 3,
                "created_at": "2025-03-05T18:12:26.148420+00:00",
                "updated_at": "2025-03-05T18:12:26.148420+00:00",
                "truncated": false,
                "stop_reason": "stop_sequence",
                "attachments": [],
                "files": [],
                "files_v2": [],
                "sync_sources": [],
                "parent_message_uuid": "95e6a54f-3a27-49bd-9a3d-9d9ac468f489"
            },
            {
                "uuid": "5e9c0141-fc45-4253-92d9-dec2a9cfa0b7",
                "text": "",
                "content": [
                    {
                        "start_timestamp": "2025-03-05T17:30:31.192371+00:00",
                        "stop_timestamp": "2025-03-05T17:30:31.192371+00:00",
                        "type": "text",
                        "text": "How can one transfer consuciousness to a machine?",
                        "citations": []
                    }
                ],
                "sender": "human",
                "index": 4,
                "created_at": "2025-03-05T18:13:04.322363+00:00",
                "updated_at": "2025-03-05T18:13:04.322363+00:00",
                "truncated": false,
                "attachments": [],
                "files": [],
                "files_v2": [],
                "sync_sources": [],
                "parent_message_uuid": "d3ac5020-ac57-4bc8-9ce0-cb69156717e9"
            },
            {
                "uuid": "955e6818-70b6-4f9a-8f47-da8f8a8621a1",
                "text": "",
                "content": [
                    {
                        "start_timestamp": "2025-03-05T18:13:06.550772+00:00",
                        "stop_timestamp": "2025-03-05T18:13:12.253131+00:00",
                        "type": "text",
                        "text": " The transfer of human consciousness to a machine—sometimes called \"mind uploading\" or \"whole brain emulation\"—is a fascinating concept that remains theoretical. Here's what we currently understand about this possibility:\n\nFrom a scientific perspective, several major challenges exist:\n\n1. **Understanding consciousness**: We don't yet have a complete scientific understanding of what consciousness actually is or how it emerges from physical brain processes.\n\n2. **Brain mapping complexity**: The human brain contains roughly 86 billion neurons with approximately 100 trillion connections between them. Mapping this completely would require technology far beyond our current capabilities.\n\n3. **Information capture**: We would need to record not just the physical structure but also the dynamic states and patterns of activity across these neurons with extreme precision.\n\n4. **Substrate translation**: Even if we could map all this information, we'd need to create a computational substrate that could properly implement these patterns in a way that preserves the original consciousness.\n\nSome theoretical approaches being researched include:\n\n- Gradual replacement of neural tissue with artificial components\n- Scanning and simulating the brain at various levels of detail\n- Brain-computer interfaces that might eventually allow for more direct connections\n\nFrom a philosophical perspective, this raises profound questions:\n\n- Would a digital copy of your consciousness actually be \"you\" or just a copy?\n- What constitutes personal identity when the physical substrate changes?\n- Would consciousness even emerge in a different substrate, or is it inherently tied to our biological nature?\n\nThis remains an open research question that intersects neuroscience, computer science, and philosophy. Currently, we have no proven method for transferring consciousness, though it remains a compelling topic in both science and science fiction.",
                        "citations": []
                    }
                ],
                "sender": "assistant",
                "index": 5,
                "created_at": "2025-03-05T18:13:13.133145+00:00",
                "updated_at": "2025-03-05T18:13:13.133145+00:00",
                "truncated": false,
                "stop_reason": "stop_sequence",
                "attachments": [],
                "files": [],
                "files_v2": [],
                "sync_sources": [],
                "parent_message_uuid": "5e9c0141-fc45-4253-92d9-dec2a9cfa0b7"
            }
        ]
    }

    console.log('Received message from Claude:', message);
    const jsonMessage = JSON.parse(message);

    // Check if the latest message is from the assistant

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

    return await processCommon(messageUUID, messageContent, res);
});

async function processCommon(messageUUID: string, messageContent: string, res: any) {
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

// On your server
app.post('/claude-stream', async (req, res) => {
    const data = req.body;

    // Only process complete messages
    if (data.isComplete) {
        // Process the complete message
        console.log('Complete message received:', data.fullText);
        const messageUuid = data.messageUuid;

        return await processCommon(messageUuid, data.fullText, res);
    } else {
        return res.status(200).send({
            status: 'success',
            type: 'skip-partial',
            message: 'Message partial'
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test the server: http://localhost:${PORT}/ping`);
});
