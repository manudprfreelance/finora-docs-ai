import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

interface StoredDocument {
  body: Uint8Array;
  contentType: string;
  fileName: string;
  bucket: string;
  objectKey: string;
}

export interface StoredManualDocumentMetadata {
  bucket: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  size: number;
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

function buildLoanAmortizationObjectKey(
  customerId: string,
  requestId: string,
): string {
  return [
    "customers",
    customerId,
    "loan-amortizations",
    requestId,
    `loan-amortization-${requestId}.pdf`,
  ].join("/");
}

function buildSwiftConfirmationObjectKey(
  customerId: string,
  requestId: string,
): string {
  return [
    "customers",
    customerId,
    "swift-confirmations",
    requestId,
    `swift-confirmation-${requestId}.pdf`,
  ].join("/");
}

function buildManualDocumentObjectKey(
  customerId: string,
  requestId: string,
): string {
  return [
    "customers",
    customerId,
    "manual-documents",
    requestId,
    `manual-document-${requestId}.pdf`,
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

async function getStoredPdf(
  objectKey: string,
  fileName: string,
): Promise<StoredDocument | null> {
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

      fileName,

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
      errorName === "NoSuchKey" ||
      errorName === "NotFound"
    ) {
      return null;
    }

    throw error;
  }
}

export async function storeManualDocumentPdf(
  customerId: string,
  requestId: string,
  body: Uint8Array,
): Promise<StoredManualDocumentMetadata> {
  if (!customerId.trim()) {
    throw new Error(
      "Customer ID is required.",
    );
  }

  if (!requestId.trim()) {
    throw new Error(
      "Request ID is required.",
    );
  }

  if (body.byteLength === 0) {
    throw new Error(
      "The manual document is empty.",
    );
  }

  const objectKey =
    buildManualDocumentObjectKey(
      customerId,
      requestId,
    );

  const fileName =
    `manual-document-${requestId}.pdf`;

  const client =
    getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket:
        DOCUMENT_BUCKET,

      Key:
        objectKey,

      Body:
        body,

      ContentType:
        "application/pdf",

      ContentLength:
        body.byteLength,

      Metadata: {
        customerId,
        requestId,
        processingMode: "manual",
      },
    }),
  );

  return {
    bucket:
      DOCUMENT_BUCKET,

    objectKey,

    fileName,

    contentType:
      "application/pdf",

    size:
      body.byteLength,
  };
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

  return getStoredPdf(
    objectKey,
    `account-statement-${requestId}.pdf`,
  );
}

export async function getLoanAmortizationPdf(
  customerId: string,
  requestId: string,
): Promise<StoredDocument | null> {
  const objectKey =
    buildLoanAmortizationObjectKey(
      customerId,
      requestId,
    );

  return getStoredPdf(
    objectKey,
    `loan-amortization-${requestId}.pdf`,
  );
}

export async function getSwiftConfirmationPdf(
  customerId: string,
  requestId: string,
): Promise<StoredDocument | null> {
  const objectKey =
    buildSwiftConfirmationObjectKey(
      customerId,
      requestId,
    );

  return getStoredPdf(
    objectKey,
    `swift-confirmation-${requestId}.pdf`,
  );
}

export async function getManualDocumentPdf(
  customerId: string,
  requestId: string,
): Promise<StoredDocument | null> {
  const objectKey =
    buildManualDocumentObjectKey(
      customerId,
      requestId,
    );

  return getStoredPdf(
    objectKey,
    `manual-document-${requestId}.pdf`,
  );
}