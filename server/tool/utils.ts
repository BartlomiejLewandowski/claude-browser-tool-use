/**
 * Extract XML tag content from message
 */
export function extractXmlContent(message: string, tagName: string) {
    const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's');
    const match = message.match(regex);
    return match ? match[1].trim() : null;
}
