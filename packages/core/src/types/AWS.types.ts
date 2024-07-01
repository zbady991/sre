//==[ SRE: AWS Types ]======================
export type AWSCredentials = {
    accessKeyId: string;
    secretAccessKey: string;
};

export type AWSRegionConfig = {
    region: string;
};

export type S3Config = AWSCredentials & AWSRegionConfig;
