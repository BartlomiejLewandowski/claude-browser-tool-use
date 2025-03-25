import {Tool} from "./tool";

export const toolRegistry : Record<string, Tool> = {};

export function registerTool(tool: Tool) {
    console.log('Registering tool:', tool.getTagName());
    toolRegistry[tool.getTagName()] = tool;
}

export function findFirstMatching(messageContent: string) : Tool | null {
    return Object.values(toolRegistry).find(v => messageContent.includes("<" + v.getTagName())) || null;
}
