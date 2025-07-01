import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from './error';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'invenage-files';

export class S3Service {
  static async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
    try {
      const key = `${folder}/${Date.now()}-${file.originalname}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      }));

      return key;
    } catch (error) {
      throw new AppError('Failed to upload file to S3', 500);
    }
  }

  static async deleteFile(key: string): Promise<void> {
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      }));
    } catch (error) {
      throw new AppError('Failed to delete file from S3', 500);
    }
  }

  static async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      throw new AppError('Failed to generate signed URL', 500);
    }
  }
} 