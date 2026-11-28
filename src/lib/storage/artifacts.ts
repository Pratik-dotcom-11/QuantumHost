import fs from "node:fs/promises";
import path from "node:path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMimeType } from "@/lib/mime";
import type { StorageProviderType } from "@/types/database";

export function resolveStorageProvider(): StorageProviderType {
  const raw = process.env.ARTIFACT_STORAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "s3" || raw === "supabase" || raw === "local") {
    return raw;
  }
  return "local";
}

function getLocalStorageRoot(): string {
  const configured = process.env.LOCAL_STORAGE_DIR?.trim() || ".quantumhost-storage";
  return path.resolve(process.cwd(), configured);
}

function getS3Client(): { client: S3Client; bucket: string } {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when ARTIFACT_STORAGE_PROVIDER=s3."
    );
  }

  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return { client, bucket };
}

async function walkDirectory(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.isSymbolicLink()) continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(rootDir, fullPath)));
    } else if (entry.isFile()) {
      files.push(path.relative(rootDir, fullPath).replace(/\\/g, "/"));
    }
  }

  return files;
}

export interface UploadArtifactResult {
  provider: StorageProviderType;
  artifactKey: string;
  sizeBytes: number;
  fileCount: number;
}

export async function uploadArtifactDirectory(
  projectId: string,
  deploymentId: string,
  outputDir: string,
  maxBytes = 52_428_800
): Promise<UploadArtifactResult> {
  const provider = resolveStorageProvider();
  const artifactKey = `${projectId}/${deploymentId}`;
  const files = await walkDirectory(outputDir);

  if (files.length === 0) {
    throw new Error("Build output directory contains no files to deploy.");
  }

  let totalBytes = 0;
  const manifest: Record<string, { size: number; contentType: string }> = {};

  for (const relPath of files) {
    const absPath = path.join(outputDir, relPath);
    const stat = await fs.stat(absPath);
    totalBytes += stat.size;
    if (totalBytes > maxBytes) {
      throw new Error(
        `Artifact size exceeds limit (${maxBytes} bytes). Reduce bundle output size.`
      );
    }
    manifest[relPath] = {
      size: stat.size,
      contentType: getMimeType(relPath),
    };
  }

  const manifestBuffer = Buffer.from(JSON.stringify({ files: manifest }, null, 2), "utf8");

  if (provider === "local") {
    const targetRoot = path.join(getLocalStorageRoot(), artifactKey);
    await fs.mkdir(targetRoot, { recursive: true });
    for (const relPath of files) {
      const src = path.join(outputDir, relPath);
      const dest = path.join(targetRoot, relPath);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
    }
    await fs.writeFile(path.join(targetRoot, "__qh_manifest.json"), manifestBuffer);
    return { provider, artifactKey, sizeBytes: totalBytes, fileCount: files.length };
  }

  if (provider === "s3") {
    const { client, bucket } = getS3Client();
    for (const relPath of files) {
      const body = await fs.readFile(path.join(outputDir, relPath));
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `${artifactKey}/${relPath}`,
          Body: body,
          ContentType: getMimeType(relPath),
        })
      );
    }
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${artifactKey}/__qh_manifest.json`,
        Body: manifestBuffer,
        ContentType: "application/json",
      })
    );
    return { provider, artifactKey, sizeBytes: totalBytes, fileCount: files.length };
  }

  // Supabase Storage ("deployments" private bucket)
  const admin = createAdminClient();
  for (const relPath of files) {
    const body = await fs.readFile(path.join(outputDir, relPath));
    const { error } = await admin.storage
      .from("deployments")
      .upload(`${artifactKey}/${relPath}`, body, {
        contentType: getMimeType(relPath),
        upsert: true,
      });
    if (error) {
      throw new Error(`Supabase Storage upload failed for ${relPath}: ${error.message}`);
    }
  }
  await admin.storage
    .from("deployments")
    .upload(`${artifactKey}/__qh_manifest.json`, manifestBuffer, {
      contentType: "application/json",
      upsert: true,
    });

  return { provider, artifactKey, sizeBytes: totalBytes, fileCount: files.length };
}

function sanitizeRequestPath(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) return "index.html";
  const joined = segments
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");
  return joined || "index.html";
}

async function readSingleObject(
  provider: StorageProviderType,
  artifactKey: string,
  relPath: string
): Promise<Uint8Array | null> {
  if (provider === "local") {
    const root = path.resolve(getLocalStorageRoot(), artifactKey);
    const candidate = path.resolve(root, relPath);
    if (!candidate.startsWith(root + path.sep) && candidate !== root) {
      return null;
    }
    try {
      const data = await fs.readFile(candidate);
      return new Uint8Array(data);
    } catch {
      return null;
    }
  }

  if (provider === "s3") {
    const { client, bucket } = getS3Client();
    try {
      const res = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `${artifactKey}/${relPath}`,
        })
      );
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return bytes;
    } catch {
      return null;
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("deployments")
    .download(`${artifactKey}/${relPath}`);
  if (error || !data) return null;
  const buf = await data.arrayBuffer();
  return new Uint8Array(buf);
}

export async function readArtifactAsset(
  provider: StorageProviderType,
  artifactKey: string,
  pathSegments: string[] | undefined
): Promise<{ bytes: Uint8Array; contentType: string; resolvedPath: string } | null> {
  const requested = sanitizeRequestPath(pathSegments);
  const candidates = [requested];

  if (!path.extname(requested)) {
    candidates.push(`${requested}/index.html`);
    candidates.push(`${requested}.html`);
    candidates.push("index.html");
  }

  for (const candidate of candidates) {
    const bytes = await readSingleObject(provider, artifactKey, candidate);
    if (bytes) {
      return {
        bytes,
        contentType: getMimeType(candidate),
        resolvedPath: candidate,
      };
    }
  }

  return null;
}
