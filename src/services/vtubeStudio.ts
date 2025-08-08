

import { getVTubeStudioSettings, saveVTubeStudioAuth, clearVTubeStudioAuth } from '../db';

export interface VTubeStudioExpression {
  name: string;
  file: string;
  active: boolean;
}

export interface VTubeStudioConnection {
  connected: boolean;
  modelLoaded: boolean;
  modelName?: string;
}

export class VTubeStudioService {
  private static instance: VTubeStudioService;
  private wsUrl = 'ws://localhost:8001';
  private socket: WebSocket | null = null;
  private connected = false;
  private authToken: string | null = null;

  static getInstance(): VTubeStudioService {
    if (!VTubeStudioService.instance) {
      VTubeStudioService.instance = new VTubeStudioService();
    }
    return VTubeStudioService.instance;
  }

  async connect(): Promise<boolean> {
    try {
      // Check if we have existing authentication
      const { authAccepted, authToken } = await getVTubeStudioSettings();
      if (authAccepted && authToken) {
        this.authToken = authToken;
        console.log('Using stored VTube Studio authentication token');
      }

      return new Promise((resolve, reject) => {
        this.socket = new WebSocket(this.wsUrl);

        this.socket.onopen = () => {
          console.log('Connected to VTube Studio');
          this.connected = true;
          this.authenticate().then(() => resolve(true)).catch(reject);
        };

        this.socket.onerror = (error) => {
          console.error('VTube Studio connection error:', error);
          this.connected = false;
          reject(error);
        };

        this.socket.onclose = () => {
          console.log('Disconnected from VTube Studio');
          this.connected = false;
        };
      });
    } catch (error) {
      console.error('Failed to connect to VTube Studio:', error);
      this.connected = false;
      return false;
    }
  }

  private async authenticate(): Promise<void> {
    // If we already have an auth token, try to use it first
    if (this.authToken) {
      try {
        await this.validateAuthToken();
        console.log('Existing VTube Studio authentication token is valid');
        return;
      } catch (error) {
        console.log('Stored auth token is invalid, requesting new one');
        this.authToken = null;
        await clearVTubeStudioAuth();
      }
    }

    // Request authentication token
    const authRequest = {
      apiName: "VTubeStudioPublicAPI",
      apiVersion: "1.0",  
      requestID: "AuthTokenRequest",
      messageType: "AuthenticationTokenRequest",
      data: {
        pluginName: "OpenAI Expression Controller",
        pluginDeveloper: "Nia Chat Assistant",
        pluginIcon: ""
      }
    };

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const messageHandler = async (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.requestID === "AuthTokenRequest") {
          this.socket!.removeEventListener('message', messageHandler);
          
          if (response.data.authenticationToken) {
            this.authToken = response.data.authenticationToken;
            // Save the auth token and mark as accepted
            await saveVTubeStudioAuth(true, this.authToken);
            console.log('VTube Studio authentication successful and saved');
            resolve();
          } else {
            await clearVTubeStudioAuth();
            reject(new Error('Authentication failed'));
          }
        }
      };

      this.socket.addEventListener('message', messageHandler);
      this.socket.send(JSON.stringify(authRequest));
    });
  }

  private async validateAuthToken(): Promise<void> {
    if (!this.socket || !this.authToken) {
      throw new Error('Socket not connected or no auth token');
    }

    const validationRequest = {
      apiName: "VTubeStudioPublicAPI",
      apiVersion: "1.0",
      requestID: "AuthTokenValidation",
      messageType: "AuthenticationRequest",
      data: {
        pluginName: "OpenAI Expression Controller",
        pluginDeveloper: "Nia Chat Assistant",
        authenticationToken: this.authToken
      }
    };

    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.requestID === "AuthTokenValidation") {
          if (this.socket) {
            this.socket.removeEventListener('message', messageHandler);
          }
          
          if (response.data.authenticated) {
            resolve();
          } else {
            reject(new Error('Auth token validation failed'));
          }
        }
      };

      if (this.socket) {
        this.socket.addEventListener('message', messageHandler);
        this.socket.send(JSON.stringify(validationRequest));
      }
    });
  }

  async clearAuth(): Promise<void> {
    this.authToken = null;
    await clearVTubeStudioAuth();
    console.log('VTube Studio authentication cleared');
  }

  async getExpressions(): Promise<VTubeStudioExpression[]> {
    if (!this.connected || !this.socket || !this.authToken) {
      throw new Error('Not connected to VTube Studio');
    }

    const request = {
      apiName: "VTubeStudioPublicAPI",
      apiVersion: "1.0",
      requestID: "ExpressionStateRequest",
      messageType: "ExpressionStateRequest",
      data: {
        details: true,
        expressionFile: ""
      }
    };

    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.requestID === "ExpressionStateRequest") {
          this.socket!.removeEventListener('message', messageHandler);
          
          if (response.data && response.data.expressions) {
            resolve(response.data.expressions);
          } else {
            reject(new Error('Failed to get expressions'));
          }
        }
      };

      this.socket!.addEventListener('message', messageHandler);
      this.socket!.send(JSON.stringify(request));
    });
  }

  async activateExpression(expressionName: string, duration?: number): Promise<boolean> {
    if (!this.connected || !this.socket || !this.authToken) {
      throw new Error('Not connected to VTube Studio');
    }

    // First, get available expressions to find the correct file name
    const expressions = await this.getExpressions();
    const expression = expressions.find(exp => 
      exp.name.toLowerCase().includes(expressionName.toLowerCase()) ||
      exp.file.toLowerCase().includes(expressionName.toLowerCase())
    );

    if (!expression) {
      throw new Error(`Expression "${expressionName}" not found`);
    }

    const request = {
      apiName: "VTubeStudioPublicAPI",
      apiVersion: "1.0",
      requestID: "ExpressionActivationRequest",
      messageType: "ExpressionActivationRequest",
      data: {
        expressionFile: expression.file,
        active: true
      }
    };

    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.requestID === "ExpressionActivationRequest") {
          this.socket!.removeEventListener('message', messageHandler);
          
          if (response.data && !response.data.errorID) {
            console.log(`Activated expression: ${expressionName}`);
            
            // Auto-deactivate after duration if specified
            if (duration && duration > 0) {
              setTimeout(() => {
                this.deactivateExpression(expressionName).catch(console.error);
              }, duration * 1000);
            }
            
            resolve(true);
          } else {
            reject(new Error(`Failed to activate expression: ${response.data?.errorID || 'Unknown error'}`));
          }
        }
      };

      this.socket!.addEventListener('message', messageHandler);
      this.socket!.send(JSON.stringify(request));
    });
  }

  async deactivateExpression(expressionName: string): Promise<boolean> {
    if (!this.connected || !this.socket || !this.authToken) {
      throw new Error('Not connected to VTube Studio');
    }

    const expressions = await this.getExpressions();
    const expression = expressions.find(exp => 
      exp.name.toLowerCase().includes(expressionName.toLowerCase()) ||
      exp.file.toLowerCase().includes(expressionName.toLowerCase())
    );

    if (!expression) {
      throw new Error(`Expression "${expressionName}" not found`);
    }

    const request = {
      apiName: "VTubeStudioPublicAPI",
      apiVersion: "1.0",
      requestID: "ExpressionDeactivationRequest", 
      messageType: "ExpressionActivationRequest",
      data: {
        expressionFile: expression.file,
        active: false
      }
    };

    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.requestID === "ExpressionDeactivationRequest") {
          this.socket!.removeEventListener('message', messageHandler);
          
          if (response.data && !response.data.errorID) {
            console.log(`Deactivated expression: ${expressionName}`);
            resolve(true);
          } else {
            reject(new Error(`Failed to deactivate expression: ${response.data?.errorID || 'Unknown error'}`));
          }
        }
      };

      this.socket!.addEventListener('message', messageHandler);
      this.socket!.send(JSON.stringify(request));
    });
  }

  async getConnectionStatus(): Promise<VTubeStudioConnection> {
    return {
      connected: this.connected,
      modelLoaded: false, // We'd need to check this separately
    };
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.authToken = null;
  }
}

// Expression mapping for common emotions/reactions
export const EXPRESSION_MAPPINGS = {
  happy: ['happy', 'smile', 'joy', 'cheerful'],
  sad: ['sad', 'cry', 'tear', 'sorrow'],
  angry: ['angry', 'mad', 'rage', 'upset'],
  surprised: ['surprised', 'shock', 'wow', 'amazed'],
  confused: ['confused', 'puzzled', 'question', 'thinking'],
  excited: ['excited', 'energetic', 'hyper', 'enthusiastic'],
  sleepy: ['sleepy', 'tired', 'yawn', 'drowsy'],
  wink: ['wink', 'flirt', 'playful'],
  neutral: ['neutral', 'normal', 'default', 'idle']
};

export function findBestExpressionMatch(emotion: string, availableExpressions: VTubeStudioExpression[]): string | null {
  const emotionLower = emotion.toLowerCase();
  
  // Direct match first
  let match = availableExpressions.find(exp => 
    exp.name.toLowerCase().includes(emotionLower)
  );
  
  if (match) return match.name;
  
  // Try mapped alternatives
  for (const [, alternatives] of Object.entries(EXPRESSION_MAPPINGS)) {
    if (alternatives.includes(emotionLower)) {
      match = availableExpressions.find(exp => 
        alternatives.some(alt => exp.name.toLowerCase().includes(alt))
      );
      if (match) return match.name;
    }
  }
  
  return null;
}
