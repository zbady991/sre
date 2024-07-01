import { uid } from '@sre/utils';
import { parseCLIArgs } from '@sre/utils/cli.utils';
import path from 'path';
import fs from 'fs';
import * as FileType from 'file-type';
import mime from 'mime';
import { SmythFile } from '@sre/IO/Storage/SmythFile.class';

export default class AgentRequest {
    public headers: any;
    public body: any;
    public query: any;
    public params: any;
    public method: string = 'GET';
    public path: string = '';
    public sessionID: string = '';
    public res: Response | null = null;
    public req: Request | null = null;
    public files: any[] = [];
    public _agent_authinfo: any;
    constructor(req?: AgentRequest | string[] | any) {
        if (Array.isArray(req)) {
            this.parseCLI(req);
        } else {
            this.parseRequest(req);
        }

        this.req = req instanceof AgentRequest ? req?.req : req;
        this.res = req?.res || null;
    }
    header(name: string) {
        return this.headers[name.toLowerCase()];
    }

    private parseRequest(req: AgentRequest | any) {
        this.headers = JSON.parse(JSON.stringify(req.headers || {}));
        this.body = JSON.parse(JSON.stringify(req.body || {}));
        this.query = JSON.parse(JSON.stringify(req.query || {}));
        this.params = JSON.parse(JSON.stringify(req.params || {}));
        this.method = req.method;
        this.path = req.path;
        this.sessionID = req.sessionID;
        this.files = req.files || [];
        this._agent_authinfo = req._agent_authinfo;
    }

    private parseCLI(argList: Array<string>) {
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
        const cli = parseCLIArgs(['endpoint', 'post', 'get', 'put', 'delete', 'patch', 'head', 'options', 'headers', 'session'], argList);
        const usedMethod = methods.find((method) => cli[method]);
        this.method = usedMethod?.toUpperCase() || 'GET';
        this.body = {};
        this.query = {};

        switch (usedMethod) {
            case 'get':
            case 'delete':
            case 'head':
            case 'options':
                this.query = cli[usedMethod];
                break;
            case 'post':
            case 'put':
            case 'patch':
                this.body = cli[usedMethod];
                break;
        }

        this.path = `/api/${cli.endpoint}`;
        this.params = cli.endpoint?.split('/');

        this.headers = cli.headers || {};

        this.sessionID = cli.session || uid();

        this.files = [];
        if (this.body) {
            for (let entry in this.body) {
                let value = this.body[entry];
                const filePath = path.join(process.cwd(), value);
                if (!fs.existsSync(filePath)) continue;

                //read the file and create a file object

                try {
                    // Read the file content
                    const fileBuffer = fs.readFileSync(filePath);
                    const ext: any = filePath.split('.').pop();

                    const fileObj = {
                        fieldname: entry,
                        buffer: fileBuffer,
                        mimetype: mime.getType(ext) || 'application/octet-stream',
                    };
                    this.body[entry] = new SmythFile(fileObj.buffer, fileObj.mimetype);
                    this.files.push(fileObj);

                    // Try to determine the MIME type from the file content
                    FileType.fileTypeFromBuffer(fileBuffer).then((fileType) => {
                        if (fileType) {
                            fileObj.mimetype = fileType.mime;
                        }
                    });
                } catch (error) {
                    console.warn('Coud not read file', filePath, error.message);
                }
            }
        }
    }
}
