import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

interface StoredDocument {
  body: Uint8Array;
  contentType: string;
  fileName: string;
  bucket: string;
  objectKey: string;
}

const DOCUMENT_BUCKET =
  "finora-documents";

function getS3Client() {
  const endpoint =
    process.env.MINIO_ENDPOINT ??
    "http://localhost:9000";

  const accessKeyId =
    process.env.MINIO_ACCESS_KEY;

  const secretAccessKey =
    process.env.MINIO_SECRET_KEY;

  if (
    !accessKeyId ||
    !secretAccessKey
  ) {
    throw new Error(
      "MinIO credentials are not configured.",
    );
  }

  return new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,

    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function buildAccountStatementObjectKey(
  customerId: string,
  requestId: string,
): string {
  return [
    "customers",
    customerId,
    "account-statements",
    requestId,
    `account-statement-${requestId}.pdf`,
  ].join("/");
}

async function streamToUint8Array(
  body: unknown,
): Promise<Uint8Array> {
  if (
    body &&
    typeof body === "object" &&
    "transformToByteArray" in body &&
    typeof (
      body as {
        transformToByteArray?: unknown;
      }
    ).transformToByteArray ===
      "function"
  ) {
    return (
      body as {
        transformToByteArray: () =>
          Promise<Uint8Array>;
      }
    ).transformToByteArray();
  }

  throw new Error(
    "Unsupported MinIO response body.",
  );
}

export async function getAccountStatementPdf(
  customerId: string,
  requestId: string,
): Promise<StoredDocument | null> {
  const objectKey =
    buildAccountStatementObjectKey(
      customerId,
      requestId,
    );

  const client =
    getS3Client();

  try {
    const response =
      await client.send(
        new GetObjectCommand({
          Bucket:
            DOCUMENT_BUCKET,

          Key:
            objectKey,
        }),
      );

    if (!response.Body) {
      return null;
    }

    const body =
      await streamToUint8Array(
        response.Body,
      );

    return {
      body,

      contentType:
        response.ContentType ??
        "application/pdf",

      fileName:
        `account-statement-${requestId}.pdf`,

      bucket:
        DOCUMENT_BUCKET,

      objectKey,
    };
  } catch (error) {
    const errorName =
      error instanceof Error
        ? error.name
        : "";

    if (
      errorName ===
        "NoSuchKey" ||
      errorName ===
        "NotFound"
    ) {
      return null;
    }

    throw error;
  }
}