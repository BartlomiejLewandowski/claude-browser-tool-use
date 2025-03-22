export interface Tool {
    getTagName(): string;

    run(messageContent: any): Promise<ToolResult>
}

export interface ToolResult {
    message: string;
    success: boolean;
}
