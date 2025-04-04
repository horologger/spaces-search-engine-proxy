declare module '@spacesprotocol/fabric' {
  export class AnchorStore {
    static create(options: {
      localPath?: string;
      remoteUrls?: string[];
      staticAnchors?: Array<{
        root: string;
        block: {
          hash: string;
          height: number;
        };
      }>;
      checkIntervalMs?: number;
    }): Promise<AnchorStore>;
  }

  export class Fabric {
    constructor(options: {
      bootstrap?: Array<{ host: string; port: number }>;
      anchor: AnchorStore;
    });
    
    ready(): Promise<void>;
    eventGet(space: string, kind: number, dTag: string, options: { latest: boolean }): Promise<{
      event?: {
        content: any;
        binary_content?: boolean;
      };
    }>;
    destroy(): Promise<void>;
  }
}

declare module '@spacesprotocol/fabric/dist/anchor' {
  export class AnchorStore {
    static create(options: {
      localPath?: string;
      remoteUrls?: string[];
      staticAnchors?: Array<{
        root: string;
        block: {
          hash: string;
          height: number;
        };
      }>;
      checkIntervalMs?: number;
    }): Promise<AnchorStore>;
  }
} 