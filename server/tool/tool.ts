export interface Tool {
    getTagName(): string;
    run(messageContent: any): Promise<ToolResult>;

    checkSetupStatus(): Promise<ToolSetupStatus>;
    setupCredentials(): Promise<boolean>;
    authenticate(): Promise<boolean>;
}

export enum ToolSetupState {
    REGISTERED = 'registered',
    CONFIGURED = 'configured',
    AUTHENTICATED = 'authenticated'
}

export interface ToolSetupStatus {
    state: ToolSetupState;
    credentialsPath?: string;
    tokenPath?: string;
    additionalInfo?: string;
}

export interface ToolResult {
    message: string;
    success: boolean;
}
