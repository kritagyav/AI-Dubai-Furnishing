/**
 * File Upload/Storage Service — wraps S3-compatible object storage.
 *
 * Dev fallback: when S3 credentials are not configured, returns mock
 * URLs so local development works without an S3 bucket.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_EXPIRY = 3600; // 1 hour

interface PresignedUrlResult {
  url: string;
  key: string;
}

export class StorageClient {
  private s3: S3Client | null;
  private devMode: boolean;

  constructor() {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const region = process.env.S3_REGION ?? "me-south-1";

    this.devMode = !accessKeyId || !secretAccessKey;

    if (!this.devMode) {
      this.s3 = new S3Client({
        region,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      });
    } else {
      this.s3 = null;
      console.warn("[StorageClient] No S3 credentials set — running in dev mode (mock URLs)");
    }
  }

  /**
   * Generate a presigned PUT URL for uploading a file.
   */
  async generateUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<PresignedUrlResult> {
    if (this.devMode) {
      const devId = crypto.randomUUID();
      const ext = key.split(".").pop() ?? "bin";
      return {
        url: `/dev/placeholder-${devId}.${ext}`,
        key,
      };
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3!, command, {
      expiresIn: expiresIn ?? DEFAULT_EXPIRY,
    });

    return { url, key };
  }

  /**
   * Generate a presigned GET URL for downloading a file.
   */
  async generateDownloadUrl(
    bucket: string,
    key: string,
    expiresIn?: number,
  ): Promise<string> {
    if (this.devMode) {
      const devId = crypto.randomUUID();
      const ext = key.split(".").pop() ?? "bin";
      return `/dev/placeholder-${devId}.${ext}`;
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.s3!, command, {
      expiresIn: expiresIn ?? DEFAULT_EXPIRY,
    });
  }

  /**
   * Delete an object from the bucket.
   */
  async deleteObject(bucket: string, key: string): Promise<void> {
    if (this.devMode) {
      console.log("[StorageClient DEV] deleteObject:", { bucket, key });
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.s3!.send(command);
  }

  /**
   * Generate a standardized S3 key for product photos.
   * Format: retailers/{retailerId}/products/{productId}/{filename}
   */
  getProductPhotoKey(retailerId: string, productId: string, filename: string): string {
    return `retailers/${retailerId}/products/${productId}/${filename}`;
  }

  /**
   * Generate a standardized S3 key for floor plans.
   * Format: projects/{projectId}/floor-plans/{filename}
   */
  getFloorPlanKey(projectId: string, filename: string): string {
    return `projects/${projectId}/floor-plans/${filename}`;
  }

  /**
   * Generate a standardized S3 key for room photos.
   * Format: rooms/{roomId}/photos/{filename}
   */
  getRoomPhotoKey(roomId: string, filename: string): string {
    return `rooms/${roomId}/photos/${filename}`;
  }
}

/** Singleton storage client instance. */
export const storageClient = new StorageClient();
